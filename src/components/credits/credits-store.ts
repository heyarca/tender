"use client";

import { create } from "zustand";
import type { AccountResponse, LedgerEntryView } from "@/lib/ledger/types";

export type CreditsStatus = "idle" | "loading" | "ready" | "error";

interface CreditsState {
  status: CreditsStatus;
  hasAccount: boolean;
  balanceMicros: number;
  /** Latest ledger entries, newest first. */
  ledger: LedgerEntryView[];
  /** Bumps after every money change, so other views (transactions) read again. */
  revision: number;
  /** Bumps on "Start over": views of the old account reset. */
  generation: number;
  addFundsOpen: boolean;
}

export const useCreditsStore = create<CreditsState>(() => ({
  status: "idle",
  hasAccount: false,
  balanceMicros: 0,
  ledger: [],
  revision: 0,
  generation: 0,
  addFundsOpen: false,
}));

let inFlight: Promise<void> | null = null;

/** Reads `GET /api/account` (balance and the last 20 entries). Concurrent calls share one request. */
export function refreshAccount(): Promise<void> {
  inFlight ??= (async () => {
    if (useCreditsStore.getState().status !== "ready") useCreditsStore.setState({ status: "loading" });
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (!response.ok) throw new Error(`Account request failed (${response.status})`);
      const body = (await response.json()) as AccountResponse;
      useCreditsStore.setState({ status: "ready", hasAccount: body.has_account, balanceMicros: body.balance_micros, ledger: body.ledger });
    } catch {
      useCreditsStore.setState({ status: "error" });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** A response told us the new balance (a charge or a top-up). */
export function applyBalance(balanceMicros: number): void {
  useCreditsStore.setState((state) => ({ balanceMicros, hasAccount: true, status: "ready", revision: state.revision + 1 }));
  void refreshAccount();
}

export function setAddFundsOpen(open: boolean): void {
  useCreditsStore.setState({ addFundsOpen: open });
}

/** "Start over": a new empty account for this browser. */
export async function startOver(): Promise<void> {
  const response = await fetch("/api/account/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!response.ok) throw new Error("Could not start over. Try again.");
  useCreditsStore.setState((state) => ({
    status: "ready",
    hasAccount: false,
    balanceMicros: 0,
    ledger: [],
    revision: state.revision + 1,
    generation: state.generation + 1,
  }));
}

/** Error message of a JSON error response (`{ error: { message } }`). */
export async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } | string };
    if (typeof body.error === "string") return body.error;
    if (typeof body.error?.message === "string") return body.error.message;
  } catch {
    // Not JSON.
  }
  return fallback;
}
