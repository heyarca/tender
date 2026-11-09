import { isAddress } from "viem";
import { getPayee } from "./payees";
import type { PaymentQuote, SettlementAmounts, ValidatedPaymentQuote } from "./types";

export const ROUNDING_NOTE = "Rounded up to the USDC minimum unit (0.000001)";

/** Decimal arithmetic avoids floating-point ceil errors at whole atomic units. */
function ceilDecimal(value: number, decimalShift: number): { atomic: bigint; rounded: boolean } {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Payment price must be finite and positive");
  const [coefficient, exponent = "0"] = value.toString().toLowerCase().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = BigInt(whole + fraction);
  const shift = Number(exponent) - fraction.length + decimalShift;
  const divisor = shift < 0 ? BigInt(10) ** BigInt(-shift) : BigInt(1);
  const numerator = shift >= 0 ? digits * BigInt(10) ** BigInt(shift) : digits;
  const rounded = numerator % divisor !== BigInt(0);
  const atomic = (numerator + divisor - BigInt(1)) / divisor;
  if (atomic > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Payment price exceeds safe precision");
  return { atomic, rounded };
}

export function bidToAtomic(bidPerMillion: number): string {
  return ceilDecimal(bidPerMillion, 0).atomic.toString();
}

export function settlementAmounts(amountUsd: number): SettlementAmounts {
  const { atomic, rounded } = ceilDecimal(amountUsd, 6);
  return {
    price_usd: amountUsd,
    settled_usd: Number(atomic) / 1_000_000,
    settled_atomic: atomic.toString(),
    ...(rounded ? { settlement_note: ROUNDING_NOTE } : {}),
  };
}

export function validateQuote<T extends PaymentQuote>(quote: T): T & SettlementAmounts {
  if (!quote || typeof quote !== "object") throw new Error("Invalid payment quote");
  const amounts = settlementAmounts(quote.amountUsd);
  if (!isAddress(quote.payTo) || quote.payTo.toLowerCase() !== getPayee(quote.providerId).toLowerCase()) {
    throw new Error("Payment recipient does not match provider");
  }
  if (typeof quote.description !== "string" || !quote.description.trim() || quote.description.length > 500) {
    throw new Error("Invalid payment description");
  }
  return { ...quote, ...amounts };
}

export function quoteFromBid(providerId: string, bidPerMillion: number, description: string): ValidatedPaymentQuote {
  // Validate the original bid before dividing; avoid underflow becoming a free request.
  bidToAtomic(bidPerMillion);
  return validateQuote({ amountUsd: bidPerMillion / 1_000_000, payTo: getPayee(providerId), providerId, description });
}
