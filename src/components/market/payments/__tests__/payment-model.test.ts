import { describe, expect, it } from "vitest";
import { settlementAmounts } from "@/lib/payments/quote";
import { PAYEES } from "@/lib/payments/payees";
import { getInitialMarketView, MARKETS, type MarketView, type ProviderConditions } from "@/lib/tender";

import {
  atomicUnitsLabel,
  buildPaymentQuote,
  formatUsdcAtomic,
  modifiedConditions,
  paymentPolicy,
  quoteAmounts,
  ROUNDING_NOTE,
  shortAddress,
  shortHash,
  summarizePayload,
  txUrl,
} from "../payment-model";

/** A view whose providers carry edited conditions (what the console store produces). */
function withConditions(view: MarketView, edits: Record<string, Partial<ProviderConditions>>): MarketView {
  return {
    ...view,
    providers: view.providers.map((row) => (edits[row.id] ? { ...row, conditions: { ...row.conditions, ...edits[row.id] } } : row)),
  };
}

describe("quoteAmounts", () => {
  it("converts a bid per 1M requests to exact and settled amounts", () => {
    expect(quoteAmounts(18)).toEqual({ priceUsd: 0.000018, settledAtomic: "18", settledUsd: 0.000018, rounded: false });
    expect(quoteAmounts(0.7)).toEqual({ priceUsd: 0.0000007, settledAtomic: "1", settledUsd: 0.000001, rounded: true });
    expect(quoteAmounts(27.5)).toMatchObject({ settledAtomic: "28", rounded: true });
    expect(quoteAmounts(0)).toBeNull();
    expect(quoteAmounts(-1)).toBeNull();
    expect(quoteAmounts(Number.NaN)).toBeNull();
  });

  it("matches the server settlement for every fixture bid and a sweep of cent bids", () => {
    const bids = Object.values(MARKETS).flatMap((market) => market.providers.map((provider) => provider.defaults.bidPrice));
    for (let cents = 1; cents <= 12_000; cents += 7) bids.push(cents / 100);
    for (const bid of bids) {
      const server = settlementAmounts(bid / 1_000_000);
      const client = quoteAmounts(bid)!;
      expect(client.settledAtomic, `bid ${bid}`).toBe(server.settled_atomic);
      expect(client.settledUsd).toBe(server.settled_usd);
      expect(client.rounded).toBe(server.settlement_note === ROUNDING_NOTE);
    }
  });
});

describe("USDC formatting", () => {
  it("formats atomic units with six decimals", () => {
    expect(formatUsdcAtomic("18")).toBe("0.000018");
    expect(formatUsdcAtomic("1")).toBe("0.000001");
    expect(formatUsdcAtomic(BigInt(19_999_820))).toBe("19.999820");
    expect(formatUsdcAtomic("1234567890000")).toBe("1,234,567.890000");
    expect(formatUsdcAtomic("not a number")).toBe("—");
  });

  it("labels atomic units", () => {
    expect(atomicUnitsLabel("1")).toBe("1 atomic unit");
    expect(atomicUnitsLabel("18")).toBe("18 atomic units");
  });

  it("shortens addresses and hashes", () => {
    expect(shortAddress("0xE2A9aA9271235E39394865e6e9b3d614e98F5f5D")).toBe("0xE2A9…5f5D");
    expect(shortHash(`0x${"ab".repeat(32)}`)).toBe("0xababab…ababab");
    expect(shortAddress("0x1234")).toBe("0x1234");
    expect(txUrl("0xabc")).toBe("https://sepolia.basescan.org/tx/0xabc");
  });
});

describe("request input", () => {
  it("sends only modified provider fields", () => {
    const view = getInitialMarketView("sf-weather");
    expect(modifiedConditions(view.providers)).toBeUndefined();
    const edited = withConditions(view, { together: { bidPrice: 45 }, nebius: { available: true, errorRate: 0.001 } });
    expect(modifiedConditions(edited.providers)).toEqual({
      together: { bidPrice: 45 },
      nebius: { errorRate: 0.001, available: true },
    });
  });

  it("maps the console policy to the wire policy", () => {
    const view = getInitialMarketView("btc-usd");
    expect(paymentPolicy(view.policy)).toEqual({
      maxPrice: 2,
      maxP95LatencyMs: 150,
      maxDataAgeMs: 1000,
      minSuccessRate: 0.999,
      preference: "lowest-cost",
      mode: { kind: "auto" },
    });
    expect(paymentPolicy({ ...view.policy, mode: { kind: "pinned", providerId: "novita" } }).mode).toEqual({ kind: "pinned", providerId: "novita" });
  });
});

describe("buildPaymentQuote", () => {
  it("quotes the default route with the provider's payee", () => {
    const quote = buildPaymentQuote(getInitialMarketView("sf-weather"));
    expect(quote).toMatchObject({
      providerId: "together",
      providerName: "Together",
      logo: "/providers/together.png",
      routeLabel: "Lowest cost",
      bidPrice: 18,
      payTo: PAYEES.together,
      blocker: null,
      violation: null,
      consoleProviderName: null,
    });
    expect(quote.amounts?.settledAtomic).toBe("18");
  });

  it("discloses rounding for a fractional atomic bid", () => {
    const quote = buildPaymentQuote(getInitialMarketView("btc-usd"));
    expect(quote.providerId).toBe("parasail");
    expect(quote.amounts).toMatchObject({ settledAtomic: "1", rounded: true });
  });

  it("follows edited conditions: Together above the max routes and pays DeepInfra", () => {
    const view = withConditions(getInitialMarketView("sf-weather"), { together: { bidPrice: 45 } });
    const quote = buildPaymentQuote(view);
    expect(quote.providerId).toBe("deepinfra");
    expect(quote.payTo).toBe(PAYEES.deepinfra);
    expect(quote.amounts?.settledAtomic).toBe("22");
    // The console store would have failed over too; the stale route in this view shows the hint.
    expect(quote.consoleProviderName).toBe("Together");
  });

  it("blocks when no provider qualifies", () => {
    const view = getInitialMarketView("sf-weather");
    const quote = buildPaymentQuote({ ...view, policy: { ...view.policy, maxPrice: 1 } });
    expect(quote.providerId).toBeNull();
    expect(quote.blocker?.kind).toBe("no-eligible");
    expect(quote.amounts).toBeNull();
  });

  it("blocks a selected bid above the 100-unit spend cap", () => {
    const view = getInitialMarketView("sf-weather");
    const quote = buildPaymentQuote({ ...view, policy: { ...view.policy, mode: { kind: "pinned", providerId: "mistral" } } });
    expect(quote.providerId).toBe("mistral");
    expect(quote.blocker).toBeNull();
    const expensive = withConditions(view, { mistral: { bidPrice: 120 } });
    const capped = buildPaymentQuote({ ...expensive, policy: { ...view.policy, maxPrice: 200, mode: { kind: "pinned", providerId: "mistral" } } });
    expect(capped.blocker?.kind).toBe("spend-cap");
    expect(capped.amounts?.settledAtomic).toBe("120");
  });

  it("surfaces a pinned provider that fails the policy and blocks an unavailable pin", () => {
    const view = getInitialMarketView("sf-weather");
    const slow = buildPaymentQuote({ ...view, policy: { ...view.policy, mode: { kind: "pinned", providerId: "cloudflare" } } });
    expect(slow.routeLabel).toBe("Pinned");
    expect(slow.providerId).toBe("cloudflare");
    expect(slow.violation).toContain("P95 640 ms exceeds 400 ms");
    expect(slow.blocker).toBeNull();
    const down = buildPaymentQuote({ ...view, policy: { ...view.policy, mode: { kind: "pinned", providerId: "nebius" } } });
    expect(down.blocker?.kind).toBe("unavailable");
  });
});

describe("summarizePayload", () => {
  it("summarizes weather and price responses", () => {
    expect(summarizePayload("sf-weather", { temperature_f: 61.2, condition: "Overcast" })).toBe("61°F Overcast");
    expect(summarizePayload("sf-weather", { temperature_f: -3.6 })).toBe("−4°F");
    expect(summarizePayload("btc-usd", { price: 75230.75 })).toBe("$75,230.75");
    expect(summarizePayload("btc-usd", { price: "x" })).toBeNull();
    expect(summarizePayload("sf-weather", null)).toBeNull();
  });
});
