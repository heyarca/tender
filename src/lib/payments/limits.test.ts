import { describe, expect, it } from "vitest";
import type { PaymentRequirements } from "@x402/core/types";
import { assertSafePayment, PaymentRateLimiter } from "./limits";
import { PAYMENT_NETWORK, USDC_ADDRESS } from "./config";
import { PAYEES } from "./payees";

const safe: PaymentRequirements = { scheme: "exact", network: PAYMENT_NETWORK, asset: USDC_ADDRESS, amount: "18", payTo: PAYEES.together, maxTimeoutSeconds: 60, extra: { providerId: "together" } };
describe("payer controls", () => {
  it("accepts the cap but never exceeds it", () => {
    expect(() => assertSafePayment({ ...safe, amount: "100" })).not.toThrow();
    for (const amount of ["101", "0", "-1", "0.1", "1e2", "NaN"]) expect(() => assertSafePayment({ ...safe, amount })).toThrow();
  });
  it("rejects mainnet, foreign assets and unknown recipients", () => {
    expect(() => assertSafePayment({ ...safe, network: "eip155:8453" })).toThrow();
    expect(() => assertSafePayment({ ...safe, asset: PAYEES.together })).toThrow();
    expect(() => assertSafePayment({ ...safe, payTo: PAYEES["the-zone-bio"] })).toThrow();
    expect(() => assertSafePayment({ ...safe, extra: {} })).toThrow();
    expect(() => assertSafePayment({ ...safe, extra: { ...safe.extra, paymentFlow: "escrow" } })).toThrow();
  });
  it("allows one in-flight request and six attempts per minute", () => {
    const limiter = new PaymentRateLimiter();
    const release = limiter.acquire(0)!;
    expect(limiter.acquire(1)).toBeNull();
    release();
    for (let index = 1; index < 6; index++) limiter.acquire(index)!();
    expect(limiter.acquire(6)).toBeNull();
    expect(limiter.acquire(60_000)).not.toBeNull();
  });
  it("caps each warm instance at 60 attempts per hour", () => {
    const limiter = new PaymentRateLimiter();
    for (let minute = 0; minute < 10; minute++) for (let request = 0; request < 6; request++) limiter.acquire(minute * 60_000)!();
    expect(limiter.acquire(600_000)).toBeNull();
    expect(limiter.acquire(3_600_000)).not.toBeNull();
  });
});
