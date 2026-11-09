import type { Address } from "viem";

export type PaymentMarket = "sf-weather" | "btc-usd";
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
  network: "base-sepolia";
  explorerUrl: string;
}
export interface PaidRequestResult {
  response: unknown;
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
}
