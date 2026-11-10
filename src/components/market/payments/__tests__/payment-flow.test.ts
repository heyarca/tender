import { describe, expect, it } from "vitest";
import type { PaymentReceipt } from "@/lib/payments/types";

import { deriveSteps, describeFailure, STEP_LABELS } from "../payment-flow";

const TX = `0x${"3f".repeat(32)}`;
const receipt: PaymentReceipt = {
  txHash: TX,
  amountUsd: 0.000022,
  amountAtomic: "22",
  asset: "USDC",
  payer: "0x1111111111111111111111111111111111111111",
  payTo: "0x463160c63D9306F684CE88DB65fF458A4Fe1b445",
  providerId: "kitefin",
  providerName: "Kitefin",
  latency_ms: 121,
  data_age_ms: 118_000,
  network: "base-sepolia",
  explorerUrl: `https://sepolia.basescan.org/tx/${TX}`,
  price_usd: 0.000022,
  settled_usd: 0.000022,
  settled_atomic: "22",
};

const statuses = (steps: ReturnType<typeof deriveSteps>) => steps.map((step) => step.status);

describe("describeFailure", () => {
  it("returns null without an error", () => {
    expect(describeFailure(null, null)).toBeNull();
  });

  it("classifies the rate limit with Retry-After", () => {
    const view = describeFailure({ status: 429, message: "Payment request limit reached", retryAfterSeconds: 42 }, null);
    expect(view).toMatchObject({ kind: "rate-limit", retryAfterSeconds: 42, step: null });
    expect(describeFailure(null, "Payment request limit reached")?.retryAfterSeconds).toBe(60);
  });

  it("classifies the spend cap before signing", () => {
    const view = describeFailure({ status: 422, message: "Payment exceeds the 100 atomic USDC per-request spend cap" }, null);
    expect(view).toMatchObject({ kind: "spend-cap", step: "signed", title: "Above the per-request spend cap" });
  });

  it("classifies a missing payer wallet", () => {
    expect(describeFailure({ status: 503, message: "Payer wallet is not configured" }, null)?.kind).toBe("payer-missing");
  });

  it("classifies no eligible provider from the status or the error code", () => {
    expect(describeFailure({ status: 409, message: "Paid request did not complete" }, null)).toMatchObject({ kind: "no-eligible", step: "payment-required" });
    const details = { response: { error: { code: "no_eligible_provider", message: "No eligible provider" } } };
    expect(describeFailure({ status: 502, message: "x", details }, null)?.kind).toBe("no-eligible");
  });

  it("classifies a provider error as served-failed and not settled", () => {
    const details = { response: { error: { code: "provider_error", message: "503 Service Unavailable" }, provider: "kelpwave" } };
    const view = describeFailure({ status: 503, message: "Paid request did not complete; inspect the response before trying again", details }, null);
    expect(view).toMatchObject({ kind: "provider-error", step: "served", providerStatus: 503 });
    expect(view?.description).toContain("503");
  });

  it("classifies a failed settlement and keeps the facilitator transaction", () => {
    const details = { settlement: { success: false, errorReason: "insufficient_funds", txHash: TX } };
    expect(describeFailure({ status: 402, message: "Paid request did not complete", details }, null)).toMatchObject({ kind: "settlement", step: "settled", txHash: TX });
  });

  it("treats network errors and generic failures as an unknown settlement outcome", () => {
    expect(describeFailure({ status: 0, message: "Failed to fetch" }, null)).toMatchObject({ kind: "network", step: "settled" });
    expect(describeFailure({ status: 502, message: "Payment request failed. Check balances before trying again." }, null)).toMatchObject({ kind: "settlement" });
    expect(describeFailure({ status: 400, message: "Unknown market" }, null)).toMatchObject({ kind: "invalid", description: "Unknown market" });
  });
});

describe("deriveSteps", () => {
  it("lists the four steps in order", () => {
    const steps = deriveSteps({ pending: false });
    expect(steps.map((step) => step.label)).toEqual([
      STEP_LABELS["payment-required"],
      STEP_LABELS.signed,
      STEP_LABELS.settled,
      STEP_LABELS.served,
    ]);
    expect(statuses(steps)).toEqual(["upcoming", "upcoming", "upcoming", "upcoming"]);
  });

  it("follows the streamed stages while in flight", () => {
    const quote = { settledAtomic: "22", payTo: receipt.payTo };
    expect(statuses(deriveSteps({ pending: true, stage: "idle", quote }))).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    const required = deriveSteps({ pending: true, stage: "payment-required", quote });
    expect(statuses(required)).toEqual(["complete", "current", "upcoming", "upcoming"]);
    expect(required[0].detail).toBe("22 atomic units to 0x4631…b445");
    expect(statuses(deriveSteps({ pending: true, stage: "signed", quote }))).toEqual(["complete", "complete", "current", "upcoming"]);
  });

  it("completes every step with evidence from the receipt", () => {
    const steps = deriveSteps({ pending: false, stage: "complete", receipt });
    expect(statuses(steps)).toEqual(["complete", "complete", "complete", "complete"]);
    expect(steps.map((step) => step.detail)).toEqual([
      "22 atomic units to 0x4631…b445",
      "Signed by 0x1111…1111",
      "Transaction 0x3f3f3f…3f3f3f",
      "Kitefin · 121 ms",
    ]);
  });

  it("marks the failing step and what was not reached", () => {
    const cap = describeFailure({ status: 422, message: "Payment exceeds the 100 atomic USDC per-request spend cap" }, null);
    expect(statuses(deriveSteps({ pending: false, failure: cap, receipt }))).toEqual(["complete", "failed", "skipped", "skipped"]);
    const provider = describeFailure({ status: 502, message: "x", details: { response: { error: { code: "provider_error" } } } }, null);
    const steps = deriveSteps({ pending: false, failure: provider });
    expect(statuses(steps)).toEqual(["complete", "complete", "skipped", "failed"]);
    expect(steps[2].detail).toBe("Not settled");
    const noEligible = describeFailure({ status: 409, message: "x" }, null);
    expect(statuses(deriveSteps({ pending: false, failure: noEligible }))).toEqual(["failed", "skipped", "skipped", "skipped"]);
  });

  it("keeps the steps idle for a rejection before the request started", () => {
    const limited = describeFailure({ status: 429, message: "Payment request limit reached" }, null);
    expect(statuses(deriveSteps({ pending: false, failure: limited, receipt }))).toEqual(["upcoming", "upcoming", "upcoming", "upcoming"]);
  });
});
