import { MAX_PAYMENT_ATOMIC, PAYMENT_NETWORK, USDC_ADDRESS } from "./config";
import { getPayee } from "./payees";
import type { PaymentRequirements } from "@x402/core/types";

export class PaymentSafetyError extends Error {}

export function assertSafePayment(requirements: PaymentRequirements): void {
  const providerId = requirements.extra.providerId;
  if (requirements.scheme !== "exact" || requirements.network !== PAYMENT_NETWORK ||
      requirements.asset.toLowerCase() !== USDC_ADDRESS.toLowerCase() ||
      requirements.extra.assetTransferMethod && requirements.extra.assetTransferMethod !== "eip3009" ||
      requirements.extra.paymentFlow && requirements.extra.paymentFlow !== "authorization") {
    throw new PaymentSafetyError("Only exact Base Sepolia USDC payments are allowed");
  }
  if (!/^\d+$/.test(requirements.amount) || BigInt(requirements.amount) <= BigInt(0) || BigInt(requirements.amount) > MAX_PAYMENT_ATOMIC) {
    throw new PaymentSafetyError("Payment exceeds the 100 atomic USDC per-request spend cap");
  }
  if (typeof providerId !== "string" || requirements.payTo.toLowerCase() !== getPayee(providerId).toLowerCase()) {
    throw new PaymentSafetyError("Untrusted payment recipient");
  }
}

/** Global to this warm instance, not keyed by spoofable client IP headers. */
export class PaymentRateLimiter {
  private attempts: number[] = [];
  private active = false;
  acquire(now = Date.now()): (() => void) | null {
    this.attempts = this.attempts.filter((time) => now - time < 3_600_000);
    if (this.active || this.attempts.length >= 60 || this.attempts.filter((time) => now - time < 60_000).length >= 6) return null;
    this.attempts.push(now);
    this.active = true;
    return () => { this.active = false; };
  }
}
export const paymentRateLimiter = new PaymentRateLimiter();
