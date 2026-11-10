/** Who moved the money. Stored in `ledger_entries.actor`. */
export type Actor = "user" | "agent" | "api_key" | "system";

export type LedgerKind = "topup" | "charge" | "refund" | "adjustment";

/** Spending limit an agent works within. `null` on an account means agents may not spend. */
export interface Mandate {
  weeklyCapMicros: number;
  /** Agent charges since the start of the ISO week (Monday 00:00 UTC). */
  spentThisWeekMicros: number;
  policy: unknown;
  hasVault: boolean;
  approvedAt: string;
}

export interface AccountSummary {
  id: string;
  balanceMicros: number;
  mandate: Mandate | null;
}

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  /** Positive for credits, negative for debits. */
  amountMicros: number;
  balanceAfterMicros: number;
  actor: Actor;
  marketId: string | null;
  providerId: string | null;
  requestId: string | null;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ApiKeySummary {
  id: string;
  prefix: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export type ChargeResult =
  | { ok: true; balanceMicros: number }
  | { ok: false; reason: "insufficient_credits" | "mandate_exceeded"; balanceMicros: number };
