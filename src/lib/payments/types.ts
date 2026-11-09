import type { Address } from "viem";
import type { ConditionsPatch, MarketId } from "@/lib/tender/types";

export type PaymentConditions = Partial<Record<string, ConditionsPatch>>;

export type PaymentMarket = MarketId;
export interface SettlementAmounts {
  price_usd: number;
  settled_usd: number;
  settled_atomic: string;
  settlement_note?: string;
}
export interface PaymentQuote {
  /** Exact provider bid in USD per request, before USDC-unit rounding. */
  amountUsd: number;
  payTo: Address;
  providerId: string;
  description: string;
}
export type ValidatedPaymentQuote = PaymentQuote & SettlementAmounts;
export interface PaymentReceipt extends SettlementAmounts {
  txHash: string;
  amountUsd: number;
  amountAtomic: string;
  asset: "USDC";
  payer: string;
  payTo: string;
  providerId: string;
  providerName: string;
  latency_ms: number;
  data_age_ms: number;
  network: "base-sepolia";
  explorerUrl: string;
}
export interface PaidResponsePayload {
  provider: string;
  latency_ms: number;
  data_age_ms: number;
  [key: string]: unknown;
}
export interface PaidRequestResult {
  response: PaidResponsePayload;
  receipt: PaymentReceipt;
}
export interface PaymentPolicy {
  maxPrice?: number;
  maxP95LatencyMs?: number;
  maxDataAgeMs?: number;
  minSuccessRate?: number;
  preference?: "lowest-cost" | "lowest-latency" | "freshest-data";
  mode?: { kind: "auto" } | { kind: "pinned"; providerId: string };
}
export interface PaidRequestInput {
  market: PaymentMarket;
  policy?: PaymentPolicy;
  conditions?: PaymentConditions;
}
export type PaidRequestOptions = Omit<PaidRequestInput, "market">;
export interface BalanceEntry {
  /** "payer" or a provider id. */
  id: string;
  address: Address;
  amountAtomic: string;
  amountUsd: string;
}
/** Response of `GET /api/payments/balances`: a fresh snapshot, or a stale one after a failed fresh read. */
export interface BalancesResponse {
  network: "base-sepolia";
  asset: "USDC";
  tokenAddress: Address;
  payer: BalanceEntry | null;
  payees: BalanceEntry[];
  /** True only when a failed fresh read forced this last good snapshot to be served. */
  stale?: boolean;
  /** ISO time of the RPC read that produced this snapshot. */
  as_of?: string;
}

export interface PaidRequestFailure {
  status: number;
  message: string;
  retryAfterSeconds?: number;
  details?: unknown;
}
export type PaidRequestStage = "idle" | "payment-required" | "signed" | "complete" | "failed";
export type PaidRequestProgress =
  | { type: "payment-required"; providerId: string; payTo: string; settled_atomic: string }
  | { type: "signed" };
export type PaidRequestEvent = PaidRequestProgress
  | { type: "result"; result: PaidRequestResult }
  | { type: "error"; status: number; error: string; details?: unknown; retryAfterSeconds?: number };
