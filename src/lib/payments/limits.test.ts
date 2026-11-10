import { describe, expect, it } from "vitest";
import type { PaymentRequirements } from "@x402/core/types";
import { assertSafePayment, BalancesRateLimiter, PaymentRateLimiter, PaymentSafetyError } from "./limits";
import { PAYMENT_NETWORK, USDC_ADDRESS } from "./config";
import { PAYEES } from "./payees";

const safe: PaymentRequirements = { scheme: "exact", network: PAYMENT_NETWORK, asset: USDC_ADDRESS, amount: "18", payTo: PAYEES.fernline, maxTimeoutSeconds: 60, extra: { providerId: "fernline" } };
describe("payer controls", () => {
  it("accepts the cap but never exceeds it", () => {
    expect(() => assertSafePayment({ ...safe, amount: "100" })).not.toThrow();
    for (const amount of ["101", "0", "-1", "0.1", "1e2", "NaN"]) expect(() => assertSafePayment({ ...safe, amount })).toThrow();
  });
  it("rejects mainnet, foreign assets and unknown recipients", () => {
    expect(() => assertSafePayment({ ...safe, network: "eip155:8453" })).toThrow();
    expect(() => assertSafePayment({ ...safe, asset: PAYEES.fernline })).toThrow();
    expect(() => assertSafePayment({ ...safe, payTo: PAYEES["the-zone-bio"] })).toThrow();
    expect(() => assertSafePayment({ ...safe, extra: {} })).toThrow();
    expect(() => assertSafePayment({ ...safe, extra: { ...safe.extra, paymentFlow: "escrow" } })).toThrow();
  });
  it("rejects unknown provider ids with a typed safety error", () => {
    expect(() => assertSafePayment({ ...safe, extra: { providerId: "nosuch" } })).toThrow(PaymentSafetyError);
    expect(() => assertSafePayment({ ...safe, payTo: PAYEES["the-zone-bio"], extra: { providerId: "nosuch" } })).toThrow(PaymentSafetyError);
    expect(() => assertSafePayment({ ...safe, extra: { providerId: "nosuch" } })).toThrow("Untrusted payment recipient");
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
  it("allows 30 balance misses per minute and reports the retry delay", () => {
    const limiter = new BalancesRateLimiter();
    for (let index = 0; index < 30; index++) expect(limiter.acquire(index)).toBe(true);
    expect(limiter.acquire(30)).toBe(false);
    expect(limiter.retryAfterSeconds(30)).toBe(60);
    expect(limiter.acquire(59_999)).toBe(false);
    expect(limiter.retryAfterSeconds(59_999)).toBe(1);
    expect(limiter.acquire(60_000)).toBe(true);
    expect(limiter.retryAfterSeconds(90_000)).toBe(30);
    expect(limiter.retryAfterSeconds(120_000)).toBe(60);
  });
});
