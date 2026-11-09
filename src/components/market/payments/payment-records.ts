/**
 * Records and balance snapshots of the "Pay with USDC" section: shapes and
 * validation of untrusted JSON (localStorage, the balances endpoint).
 */
import { MARKET_IDS, type MarketId } from "@/lib/tender";
import type { PaymentReceipt } from "@/lib/payments/types";

/** One settled paid request, as shown in the receipt card and the table. */
export interface PaidRequestRecord {
  /** Transaction hash. */
  id: string;
  marketId: MarketId;
  /** Epoch ms when the receipt arrived. */
  at: number;
  receipt: PaymentReceipt;
  /** One line from the paid response: "61°F Overcast" or "$75,230.75". */
  summary: string | null;
}

export interface UsdcBalance {
  /** "payer" or a provider id. */
  id: string;
  address: string;
  amountAtomic: string;
  amountUsd: string;
}

export interface BalancesSnapshot {
  network: string;
  asset: string;
  tokenAddress: string;
  payer: UsdcBalance | null;
  payees: UsdcBalance[];
}

const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DIGITS = /^\d+$/;
const MARKETS: readonly MarketId[] = MARKET_IDS;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === "string";

/** A receipt with every field the UI reads, or `null`. */
export function parseReceipt(value: unknown): PaymentReceipt | null {
  const r = record(value);
  if (!r) return null;
  if (!isString(r.txHash) || !HASH.test(r.txHash)) return null;
  if (!isString(r.payer) || !ADDRESS.test(r.payer) || !isString(r.payTo) || !ADDRESS.test(r.payTo)) return null;
  if (!isString(r.providerId) || !isString(r.providerName)) return null;
  if (!isString(r.settled_atomic) || !DIGITS.test(r.settled_atomic)) return null;
  if (!isNumber(r.price_usd) || !isNumber(r.settled_usd) || !isNumber(r.latency_ms) || !isNumber(r.data_age_ms)) return null;
  if (!isString(r.explorerUrl) || !r.explorerUrl.startsWith("https://sepolia.basescan.org/")) return null;
  return {
    txHash: r.txHash,
    amountUsd: isNumber(r.amountUsd) ? r.amountUsd : r.settled_usd,
    amountAtomic: isString(r.amountAtomic) && DIGITS.test(r.amountAtomic) ? r.amountAtomic : r.settled_atomic,
    asset: "USDC",
    payer: r.payer,
    payTo: r.payTo,
    providerId: r.providerId,
    providerName: r.providerName,
    latency_ms: r.latency_ms,
    data_age_ms: r.data_age_ms,
    network: "base-sepolia",
    explorerUrl: r.explorerUrl,
    price_usd: r.price_usd,
    settled_usd: r.settled_usd,
    settled_atomic: r.settled_atomic,
    ...(isString(r.settlement_note) ? { settlement_note: r.settlement_note } : {}),
  };
}

/** Persisted records (`{ version: 1, records }`); invalid entries are dropped. */
export function parseRecords(raw: string | null, limit: number): Partial<Record<MarketId, PaidRequestRecord[]>> {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  const root = record(data);
  const records = record(root?.records);
  if (root?.version !== 1 || !records) return {};
  const out: Partial<Record<MarketId, PaidRequestRecord[]>> = {};
  for (const marketId of MARKETS) {
    const list = records[marketId];
    if (!Array.isArray(list)) continue;
    const parsed: PaidRequestRecord[] = [];
    for (const item of list) {
      const entry = record(item);
      const receipt = parseReceipt(entry?.receipt);
      if (!entry || !receipt || !isNumber(entry.at)) continue;
      if (parsed.some((existing) => existing.id === receipt.txHash)) continue;
      parsed.push({
        id: receipt.txHash,
        marketId,
        at: entry.at,
        receipt,
        summary: isString(entry.summary) ? entry.summary : null,
      });
      if (parsed.length >= limit) break;
    }
    if (parsed.length > 0) out[marketId] = parsed;
  }
  return out;
}

function parseBalance(value: unknown): UsdcBalance | null {
  const r = record(value);
  if (!r || !isString(r.id) || !isString(r.address) || !ADDRESS.test(r.address)) return null;
  if (!isString(r.amountAtomic) || !DIGITS.test(r.amountAtomic) || !isString(r.amountUsd)) return null;
  return { id: r.id, address: r.address, amountAtomic: r.amountAtomic, amountUsd: r.amountUsd };
}

/** Response of `GET /api/payments/balances`, or `null` when malformed. */
export function parseBalances(value: unknown): BalancesSnapshot | null {
  const r = record(value);
  if (!r || !isString(r.network) || !isString(r.asset) || !isString(r.tokenAddress) || !Array.isArray(r.payees)) return null;
  const payer = r.payer === null ? null : parseBalance(r.payer);
  if (r.payer !== null && !payer) return null;
  const payees = r.payees.map(parseBalance);
  if (payees.some((balance) => balance === null)) return null;
  return { network: r.network, asset: r.asset, tokenAddress: r.tokenAddress, payer, payees: payees as UsdcBalance[] };
}

/** Payee balance of a provider in a snapshot. */
export function payeeBalance(balances: BalancesSnapshot | null, providerId: string | null): UsdcBalance | null {
  if (!balances || !providerId) return null;
  return balances.payees.find((balance) => balance.id === providerId) ?? null;
}
