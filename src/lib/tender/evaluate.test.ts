import { describe, expect, it } from "vitest";
import { evaluateMarket, evaluateProvider, STATUS_PRIORITY } from "./evaluate";
import { MARKETS, getDefaultPolicy } from "./fixtures";
import type { MarketId, ProviderConditions, RoutingPreference } from "./types";

const providersOf = (marketId: MarketId) =>
  MARKETS[marketId].providers.map((p) => ({ id: p.id, name: p.name, conditions: { ...p.defaults } }));

const evaluateDefaults = (marketId: MarketId, preference: RoutingPreference = "lowest-cost") =>
  evaluateMarket(providersOf(marketId), { ...getDefaultPolicy(marketId), preference });

describe("default statuses", () => {
  it("matches SPEC §3 for all 16 providers", () => {
    const weather = evaluateDefaults("sf-weather");
    const btc = evaluateDefaults("btc-usd");
    const statuses = {
      ...Object.fromEntries(Object.values(weather.byId).map((e) => [e.providerId, e.status])),
      ...Object.fromEntries(Object.values(btc.byId).map((e) => [e.providerId, e.status])),
    };
    expect(statuses).toEqual({
      together: "eligible",
      deepinfra: "eligible",
      fireworks: "eligible",
      digitalocean: "eligible",
      cloudflare: "too-slow",
      modal: "stale-data",
      mistral: "over-budget",
      nebius: "unavailable",
      parasail: "eligible",
      "inference-net": "eligible",
      coreweave: "eligible",
      baseten: "eligible",
      novita: "too-slow",
      crusoe: "stale-data",
      gmicloud: "over-budget",
      wafer: "unreliable",
    });
    expect(weather.recommendedId).toBe("together");
    expect(btc.recommendedId).toBe("parasail");
  });

  it("uses the exact short reason copy", () => {
    const weather = evaluateDefaults("sf-weather").byId;
    const btc = evaluateDefaults("btc-usd").byId;
    expect(weather.cloudflare.reasons.map((r) => r.message)).toEqual(["P95 640 ms exceeds 400 ms"]);
    expect(weather.mistral.reasons.map((r) => r.message)).toEqual(["Bid $58.00 exceeds $40.00 /M"]);
    expect(weather.modal.reasons.map((r) => r.message)).toEqual(["Data age 42 min exceeds 15 min"]);
    expect(weather.nebius.reasons.map((r) => r.message)).toEqual(["Provider is not responding"]);
    expect(btc.wafer.reasons.map((r) => r.message)).toEqual(["Success 99.15% is below 99.90%"]);
    expect(btc.crusoe.reasons.map((r) => r.message)).toEqual(["Data age 2.4 s exceeds 1 s"]);
  });
});

describe("status priority", () => {
  it("orders statuses and picks the first failing check", () => {
    expect(STATUS_PRIORITY).toEqual(["unavailable", "unreliable", "over-budget", "too-slow", "stale-data", "eligible"]);
    const policy = getDefaultPolicy("sf-weather");
    const worst: ProviderConditions = { bidPrice: 90, p95LatencyMs: 900, dataAgeMs: 3_600_000, errorRate: 0.02, available: false };
    const ev = evaluateProvider("x", worst, policy);
    expect(ev.status).toBe("unavailable");
    expect(ev.qualifies).toBe(false);
    expect(ev.reasons.map((r) => r.status)).toEqual(["unavailable", "unreliable", "over-budget", "too-slow", "stale-data"]);
    expect(ev.reasons.map((r) => r.message)).toEqual([
      "Provider is not responding",
      "Success 98.00% is below 99.50%",
      "Bid $90.00 exceeds $40.00 /M",
      "P95 900 ms exceeds 400 ms",
      "Data age 1 h exceeds 15 min",
    ]);
    expect(evaluateProvider("x", { ...worst, available: true }, policy).status).toBe("unreliable");
    expect(evaluateProvider("x", { ...worst, available: true, errorRate: 0 }, policy).status).toBe("over-budget");
    expect(evaluateProvider("x", { ...worst, available: true, errorRate: 0, bidPrice: 1 }, policy).status).toBe("too-slow");
    expect(
      evaluateProvider("x", { ...worst, available: true, errorRate: 0, bidPrice: 1, p95LatencyMs: 100 }, policy).status,
    ).toBe("stale-data");
  });

  it("treats limits as inclusive", () => {
    const policy = getDefaultPolicy("sf-weather");
    const atLimit: ProviderConditions = { bidPrice: 40, p95LatencyMs: 400, dataAgeMs: 900_000, errorRate: 0.005, available: true };
    expect(evaluateProvider("x", atLimit, policy).qualifies).toBe(true);
  });
});

describe("ranking", () => {
  it.each([
    ["sf-weather", "lowest-cost", "together", ["together", "deepinfra", "fireworks", "digitalocean"]],
    ["sf-weather", "lowest-latency", "fireworks", ["fireworks", "deepinfra", "together", "digitalocean"]],
    ["sf-weather", "freshest-data", "deepinfra", ["deepinfra", "fireworks", "together", "digitalocean"]],
    ["btc-usd", "lowest-cost", "parasail", ["parasail", "inference-net", "coreweave", "baseten"]],
    ["btc-usd", "lowest-latency", "coreweave", ["coreweave", "baseten", "inference-net", "parasail"]],
    ["btc-usd", "freshest-data", "baseten", ["baseten", "coreweave", "inference-net", "parasail"]],
  ] as const)("%s %s → %s", (marketId, preference, recommended, ranking) => {
    const ev = evaluateDefaults(marketId, preference);
    expect(ev.recommendedId).toBe(recommended);
    expect(ev.ranking).toEqual(ranking);
    expect(ev.byId[recommended].rank).toBe(1);
    expect(ev.byId[recommended].isRecommended).toBe(true);
  });

  it("marks the lowest-priced qualified provider as best price for every preference", () => {
    for (const preference of ["lowest-cost", "lowest-latency", "freshest-data"] as const) {
      expect(evaluateDefaults("sf-weather", preference).bestPriceId).toBe("together");
      expect(evaluateDefaults("btc-usd", preference).bestPriceId).toBe("parasail");
    }
    const ev = evaluateDefaults("sf-weather", "lowest-latency");
    expect(ev.byId.together.isBestPrice).toBe(true);
    expect(ev.byId.fireworks.isBestPrice).toBe(false);
    // Cheaper providers that fail the policy never get the marker.
    expect(ev.byId.cloudflare.isBestPrice).toBe(false);
  });

  it("breaks ties by the next keys, then by name", () => {
    const policy = { ...getDefaultPolicy("sf-weather") };
    const base: ProviderConditions = { bidPrice: 20, p95LatencyMs: 200, dataAgeMs: 300_000, errorRate: 0, available: true };
    const providers = [
      { id: "b", name: "Bravo", conditions: { ...base } },
      { id: "a", name: "Alpha", conditions: { ...base } },
      { id: "c", name: "Charlie", conditions: { ...base, p95LatencyMs: 150 } },
      { id: "d", name: "Delta", conditions: { ...base, dataAgeMs: 60_000 } },
      { id: "e", name: "Echo", conditions: { ...base, bidPrice: 10 } },
    ];
    // Cost: bid ↑, then P95 ↑, then data age ↑, then name.
    expect(evaluateMarket(providers, { ...policy, preference: "lowest-cost" }).ranking).toEqual(["e", "c", "d", "a", "b"]);
    // Latency: P95 ↑, then bid ↑, then data age ↑, then name.
    expect(evaluateMarket(providers, { ...policy, preference: "lowest-latency" }).ranking).toEqual(["c", "e", "d", "a", "b"]);
    // Freshness: data age ↑, then bid ↑, then P95 ↑, then name.
    expect(evaluateMarket(providers, { ...policy, preference: "freshest-data" }).ranking).toEqual(["d", "e", "c", "a", "b"]);
  });

  it("returns no recommendation when nothing qualifies", () => {
    const ev = evaluateMarket(providersOf("sf-weather"), { ...getDefaultPolicy("sf-weather"), maxPrice: 5 });
    expect(ev.recommendedId).toBeNull();
    expect(ev.bestPriceId).toBeNull();
    expect(ev.ranking).toEqual([]);
  });
});
