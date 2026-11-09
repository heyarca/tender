/**
 * State of a paid request: failure classification and the four-step progress
 * (Payment required (402) → USDC authorization signed → Settled on Base
 * Sepolia → Response served). Pure, so the UI and tests share it.
 */
import type { PaidRequestFailure, PaidRequestStage, PaymentReceipt } from "@/lib/payments/types";
import { atomicUnitsLabel, shortAddress, shortHash } from "./payment-model";

/** Progress stage reported by `usePaidRequest` (streamed from the payments API). */
export type PaidStage = PaidRequestStage;

/** Typed failure reported by `usePaidRequest`. */
export type PaidFailure = PaidRequestFailure;

export type FailureKind =
  | "rate-limit"
  | "spend-cap"
  | "payer-missing"
  | "no-eligible"
  | "provider-error"
  | "settlement"
  | "invalid"
  | "network"
  | "unknown";

export type StepId = "payment-required" | "signed" | "settled" | "served";

export interface PaymentFailureView {
  kind: FailureKind;
  title: string;
  description: string;
  /** Step that failed; `null` when the request was rejected before it started. */
  step: StepId | null;
  /** Seconds to wait before trying again (rate limit). */
  retryAfterSeconds: number | null;
  /** Transaction hash when the facilitator reported one for a failed settlement. */
  txHash: string | null;
  /** HTTP status of the failed provider response, when known. */
  providerStatus: number | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function errorCode(details: unknown): string | null {
  const response = record(record(details)?.response);
  const error = record(response?.error);
  return typeof error?.code === "string" ? error.code : null;
}

function settlementOf(details: unknown): { success?: boolean; txHash?: string } | null {
  const settlement = record(record(details)?.settlement);
  if (!settlement) return null;
  return {
    success: typeof settlement.success === "boolean" ? settlement.success : undefined,
    txHash: typeof settlement.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(settlement.txHash) ? settlement.txHash : undefined,
  };
}

const UNKNOWN_OUTCOME = "The transfer may still land on-chain. Check balances before trying again.";

/**
 * Classify a failed paid request. Uses the typed failure when the hook
 * provides one, otherwise the error message of the payments API.
 */
export function describeFailure(failure: PaidFailure | null, message: string | null): PaymentFailureView | null {
  if (!failure && !message) return null;
  const status = failure?.status ?? null;
  const text = failure?.message ?? message ?? "";
  const details = failure?.details;
  const code = errorCode(details);
  const settlement = settlementOf(details);
  const base = { retryAfterSeconds: null, txHash: settlement?.txHash ?? null, providerStatus: null };

  if (status === 429 || /limit reached/i.test(text)) {
    const seconds = failure?.retryAfterSeconds && failure.retryAfterSeconds > 0 ? Math.ceil(failure.retryAfterSeconds) : 60;
    return {
      ...base,
      kind: "rate-limit",
      title: "Payment request limit reached",
      description: "Paid requests are limited to six per minute. Nothing was paid.",
      step: null,
      retryAfterSeconds: seconds,
    };
  }
  if (status === 503 && /payer wallet/i.test(text) || /payer wallet is not configured/i.test(text)) {
    return {
      ...base,
      kind: "payer-missing",
      title: "Payer wallet is not configured",
      description: "Paid requests need a funded Base Sepolia payer wallet. Nothing was paid.",
      step: null,
    };
  }
  if (status === 422 || /spend cap|only exact|untrusted payment recipient/i.test(text)) {
    const cap = /spend cap/i.test(text);
    return {
      ...base,
      kind: "spend-cap",
      title: cap ? "Above the per-request spend cap" : "Payment requirements rejected",
      description: cap
        ? "The selected bid settles above 100 atomic USDC ($100.00 /M req). The authorization was not signed."
        : `${text} The authorization was not signed.`,
      step: "signed",
    };
  }
  if (status === 409 || code === "no_eligible_provider") {
    return {
      ...base,
      kind: "no-eligible",
      title: "No eligible provider",
      description: "No provider meets the routing policy, so no payment was requested.",
      step: "payment-required",
    };
  }
  if (code === "provider_error" || code === "unsupported_bid") {
    const response = record(record(details)?.response);
    const providerStatus = status && status >= 400 ? status : null;
    return {
      ...base,
      kind: "provider-error",
      title: code === "unsupported_bid" ? "Provider bid is not payable" : "Provider error",
      description:
        code === "unsupported_bid"
          ? "The selected bid cannot be settled in USDC. Nothing was paid."
          : `${typeof response?.provider === "string" ? "The provider" : "The provider"} returned ${providerStatus ?? "an error"}. Failed responses are not settled.`,
      step: "served",
      providerStatus,
    };
  }
  if (settlement && settlement.success === false) {
    return {
      ...base,
      kind: "settlement",
      title: "Settlement failed",
      description: UNKNOWN_OUTCOME,
      step: "settled",
    };
  }
  if (status === 400 || status === 415) {
    return { ...base, kind: "invalid", title: "Request rejected", description: text || "The request was invalid. Nothing was paid.", step: null };
  }
  if (status === 0) {
    return { ...base, kind: "network", title: "Connection lost", description: UNKNOWN_OUTCOME, step: "settled" };
  }
  if (/did not complete/i.test(text)) {
    return {
      ...base,
      kind: "provider-error",
      title: "Paid request did not complete",
      description: "The response failed, so it was not settled. Check balances before trying again.",
      step: "served",
      providerStatus: status && status >= 400 ? status : null,
    };
  }
  if (/check balances/i.test(text) || status === 502 || status === 504) {
    return { ...base, kind: "settlement", title: "Payment did not finish", description: UNKNOWN_OUTCOME, step: "settled" };
  }
  return { ...base, kind: "unknown", title: "Payment request failed", description: text || UNKNOWN_OUTCOME, step: null };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export type StepStatus = "upcoming" | "current" | "complete" | "failed" | "skipped";

export interface PaymentStep {
  id: StepId;
  label: string;
  status: StepStatus;
  /** One short line with the evidence for this step. */
  detail: string;
}

export const STEP_LABELS: Readonly<Record<StepId, string>> = {
  "payment-required": "Payment required (402)",
  signed: "USDC authorization signed",
  settled: "Settled on Base Sepolia",
  served: "Response served",
};

const STEP_ORDER: readonly StepId[] = ["payment-required", "signed", "settled", "served"];

const IDLE_DETAILS: Readonly<Record<StepId, string>> = {
  "payment-required": "The contract endpoint quotes the winning bid",
  signed: "The payer signs an EIP-3009 transfer",
  settled: "The facilitator submits the USDC transfer",
  served: "The provider's response is returned",
};

export interface StepsInput {
  /** A paid request is in flight. */
  pending: boolean;
  /** Streamed stage, when the hook reports one. */
  stage?: PaidStage | null;
  /** Quote of the in-flight request (from the 402 or the preview). */
  quote?: { settledAtomic: string; payTo: string | null } | null;
  /** Result of the most recent attempt. */
  receipt?: PaymentReceipt | null;
  latencyMs?: number | null;
  failure?: PaymentFailureView | null;
}

function steps(status: (id: StepId, index: number) => [StepStatus, string]): PaymentStep[] {
  return STEP_ORDER.map((id, index) => {
    const [stepStatus, detail] = status(id, index);
    return { id, label: STEP_LABELS[id], status: stepStatus, detail };
  });
}

function completeDetails(receipt: PaymentReceipt, latencyMs: number | null | undefined): Record<StepId, string> {
  return {
    "payment-required": `${atomicUnitsLabel(receipt.settled_atomic)} to ${shortAddress(receipt.payTo)}`,
    signed: `Signed by ${shortAddress(receipt.payer)}`,
    settled: `Transaction ${shortHash(receipt.txHash)}`,
    served: `${receipt.providerName} · ${latencyMs ?? receipt.latency_ms} ms`,
  };
}

/**
 * The four steps for the current attempt.
 * - Idle: all upcoming.
 * - In flight: stages reported by the API complete their steps; the next step is current.
 *   Without stage reports, the first step is current until the result arrives.
 * - Success: all complete, each with its evidence (amount, payer, tx, provider).
 * - Failure: steps before the failing one complete, the failing one failed, later ones skipped.
 */
export function deriveSteps(input: StepsInput): PaymentStep[] {
  const quoteDetail = input.quote
    ? `${atomicUnitsLabel(input.quote.settledAtomic)}${input.quote.payTo ? ` to ${shortAddress(input.quote.payTo)}` : ""}`
    : IDLE_DETAILS["payment-required"];

  if (input.pending) {
    const reached = input.stage === "signed" ? 2 : input.stage === "payment-required" ? 1 : 0;
    return steps((id, index) => {
      if (index < reached) return ["complete", id === "payment-required" ? quoteDetail : "Authorization sent with the retry"];
      if (index === reached) {
        const current: Record<StepId, string> = {
          "payment-required": "Requesting a quote",
          signed: "Signing the authorization",
          settled: "Waiting for the facilitator",
          served: "Waiting for the response",
        };
        return ["current", current[id]];
      }
      return ["upcoming", IDLE_DETAILS[id]];
    });
  }

  if (input.failure) {
    const failedIndex = input.failure.step ? STEP_ORDER.indexOf(input.failure.step) : -1;
    if (failedIndex < 0) return steps((id) => ["upcoming", IDLE_DETAILS[id]]);
    return steps((id, index) => {
      if (index < failedIndex) {
        return ["complete", id === "payment-required" ? quoteDetail : id === "signed" ? "Authorization sent with the retry" : IDLE_DETAILS[id]];
      }
      if (index === failedIndex) return ["failed", input.failure!.title];
      if (input.failure!.kind === "provider-error" && id === "settled") return ["skipped", "Not settled"];
      return ["skipped", "Not reached"];
    }).map((step) =>
      // A failed response is never settled: show "Not settled" on the settlement step.
      input.failure!.kind === "provider-error" && step.id === "settled" ? { ...step, status: "skipped", detail: "Not settled" } : step,
    );
  }

  if (input.receipt) {
    const details = completeDetails(input.receipt, input.latencyMs);
    return steps((id) => ["complete", details[id]]);
  }

  return steps((id) => ["upcoming", IDLE_DETAILS[id]]);
}
