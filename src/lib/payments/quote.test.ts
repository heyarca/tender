import { describe, expect, it } from "vitest";
import { isAddress } from "viem";
import { PAYEES, getPayee } from "./payees";
import { bidToAtomic, quoteFromBid, ROUNDING_NOTE, settlementAmounts, validateQuote } from "./quote";

describe("USDC quotes", () => {
  it.each([[18, "18"], [0.7, "1"], [0.95, "1"], [27.5, "28"], [1.4, "2"], [1, "1"]])("rounds %s/M up to %s atomic", (bid, atomic) => {
    expect(bidToAtomic(bid)).toBe(atomic);
    const quote = quoteFromBid("together", bid, "Weather");
    expect(quote.settled_atomic).toBe(atomic);
    expect(quote.price_usd).toBe(bid / 1e6);
    expect(Number(atomic) - bid).toBeLessThan(1);
    expect(Number(atomic)).toBeGreaterThanOrEqual(bid);
  });
  it("does not add a unit because of floating-point multiplication", () => {
    expect(settlementAmounts(0.000249).settled_atomic).toBe("249");
  });
  it("makes rounding explicit", () => {
    expect(quoteFromBid("parasail", 0.7, "Bitcoin")).toMatchObject({ price_usd: 0.0000007, settled_usd: 0.000001, settled_atomic: "1", settlement_note: ROUNDING_NOTE });
    expect(quoteFromBid("together", 18, "Weather").settlement_note).toBeUndefined();
  });
  it.each([0, -1, NaN, Infinity, Number.MAX_VALUE])("rejects invalid bid %s", (bid) => expect(() => bidToAtomic(bid)).toThrow());
  it("validates recipients and descriptions", () => {
    const quote = quoteFromBid("together", 18, "Weather");
    expect(() => validateQuote({ ...quote, payTo: PAYEES.parasail })).toThrow("recipient");
    expect(() => validateQuote({ ...quote, description: "" })).toThrow("description");
    expect(() => getPayee("__proto__")).toThrow();
    expect(() => getPayee("unknown")).toThrow();
  });
  it("has 16 distinct public addresses", () => {
    expect(new Set(Object.values(PAYEES)).size).toBe(16);
    expect(Object.values(PAYEES).every((address) => isAddress(address))).toBe(true);
  });
});
