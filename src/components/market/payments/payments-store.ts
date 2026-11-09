"use client";

/**
 * Session state of the "Pay with USDC" section that must outlive the section:
 * the section remounts on every market switch, while a paid request may still
 * be in flight and its receipt must land in the right market.
 *
 * - Paid request records per market (newest first, capped), persisted in
 *   `localStorage` so real on-chain receipts survive a reload.
 * - The one paid request in flight (the payer wallet allows one at a time).
 * - The rate-limit retry time after a 429.
 * - Base Sepolia USDC balances of the payer and the payees.
 */
import { useSyncExternalStore } from "react";
import type { MarketId } from "@/lib/tender";
import type { PaymentReceipt } from "@/lib/payments/types";
import { parseBalances, parseRecords, type BalancesSnapshot, type PaidRequestRecord } from "./payment-records";

export const RECORDS_STORAGE_KEY = "tender:v1:paid-requests";
export const RECORDS_LIMIT = 20;

export interface InFlightPayment {
  marketId: MarketId;
  startedAt: number;
}

export type BalancesStatus = "idle" | "loading" | "ready" | "error";

export interface PaymentsState {
  records: Partial<Record<MarketId, PaidRequestRecord[]>>;
  inFlight: InFlightPayment | null;
  /** Epoch ms before which a new paid request would hit the rate limit. */
  retryAt: number | null;
  balances: BalancesSnapshot | null;
  balancesStatus: BalancesStatus;
  /** Epoch ms of the last successful balance read. */
  balancesAt: number | null;
}

const EMPTY: PaymentsState = {
  records: {},
  inFlight: null,
  retryAt: null,
  balances: null,
  balancesStatus: "idle",
  balancesAt: null,
};

const BALANCES_RETRY_MS = 1_500;

async function readBalances(): Promise<BalancesSnapshot | null> {
  try {
    const response = await fetch("/api/payments/balances", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return parseBalances(await response.json());
  } catch {
    return null;
  }
}

let state: PaymentsState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: PaymentsState) {
  state = next;
  for (const listener of listeners) listener();
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const records = parseRecords(window.localStorage.getItem(RECORDS_STORAGE_KEY), RECORDS_LIMIT);
    if (Object.keys(records).length > 0) emit({ ...state, records: { ...records, ...state.records } });
  } catch {
    // Storage can be unavailable (privacy mode); the session log still works.
  }
}

function persist(records: PaymentsState["records"]) {
  try {
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify({ version: 1, records }));
  } catch {
    // Ignore quota and privacy-mode errors.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;

/** Payments session state. Server render and hydration use an empty snapshot. */
export function usePaymentsState(): PaymentsState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const paymentsStore = {
  getState: () => state,

  start(marketId: MarketId, at: number) {
    emit({ ...state, inFlight: { marketId, startedAt: at } });
  },

  finish() {
    if (state.inFlight) emit({ ...state, inFlight: null });
  },

  addRecord(marketId: MarketId, receipt: PaymentReceipt, summary: string | null, at: number) {
    load();
    const current = state.records[marketId] ?? [];
    if (current.some((record) => record.receipt.txHash === receipt.txHash)) return;
    const record: PaidRequestRecord = { id: receipt.txHash, marketId, at, receipt, summary };
    const records = { ...state.records, [marketId]: [record, ...current].slice(0, RECORDS_LIMIT) };
    emit({ ...state, records });
    persist(records);
  },

  setRetryAt(retryAt: number | null) {
    emit({ ...state, retryAt });
  },

  /** Read balances now. Concurrent calls share one request. */
  refreshBalances: (() => {
    let inFlight: Promise<void> | null = null;
    return function refreshBalances(): Promise<void> {
      if (inFlight) return inFlight;
      emit({ ...state, balancesStatus: "loading" });
      inFlight = (async () => {
        try {
          // One retry: the public Base Sepolia RPC occasionally rejects a burst of reads.
          let balances = await readBalances();
          if (!balances) {
            await new Promise((resolve) => setTimeout(resolve, BALANCES_RETRY_MS));
            balances = await readBalances();
          }
          if (balances) emit({ ...state, balances, balancesStatus: "ready", balancesAt: Date.now() });
          else emit({ ...state, balancesStatus: "error" });
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    };
  })(),

  /** Test helper: reset to the initial state. */
  reset() {
    loaded = false;
    emit(EMPTY);
  },
};
