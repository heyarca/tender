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

/** `GET /api/account` and the account part of other responses. */
export interface AccountResponse {
  has_account: boolean;
  balance_micros: number;
  mandate: MandateView | null;
  ledger: LedgerEntryView[];
}

export interface MandateView {
  weekly_cap_micros: number;
  spent_this_week_micros: number;
  policy: unknown;
  has_vault: boolean;
  approved_at: string;
}

export interface LedgerEntryView {
  id: string;
  kind: LedgerKind;
  amount_micros: number;
  balance_after_micros: number;
  actor: Actor;
  market_id: string | null;
  provider_id: string | null;
  request_id: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  /** A top-up Ask Tender made by itself from the saved PayPal. */
  auto_top_up: boolean;
  created_at: string;
}

export interface ApiKeyView {
  id: string;
  prefix: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

/** `POST /api/keys`: the secret appears only in this response. */
export interface CreatedApiKeyView extends ApiKeyView {
  secret: string;
}
