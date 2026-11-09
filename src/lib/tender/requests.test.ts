import { describe, expect, it } from "vitest";
import { FIXTURE_EPOCH } from "./constants";
import { createRng, seedFromString } from "./random";
import {
  anchoredBtcPriceAt,
  sampleDataAge,
  sampleLatency,
  sampleRequest,
  signalReference,
  weatherPayload,
} from "./requests";
import { executeSelection, getDefaultConditions, routeRequest, selectRoute } from "./selection";
import { btcPriceAt, BTC_BASELINE_PRICE, weatherAt } from "./signals";

const E = FIXTURE_EPOCH;

describe("latency sampling", () => {
  it("keeps about 95% of draws within P95, the rest ≤ 1.35×, median ≈ 0.6×", () => {
    const rng = createRng(12345);
    const p95 = 200;
    const draws = Array.from({ length: 20_000 }, () => sampleLatency(rng, p95));
    const within = draws.filter((d) => d <= p95).length / draws.length;
    expect(within).toBeGreaterThan(0.93);
    expect(within).toBeLessThan(0.97);
    expect(Math.max(...draws)).toBeLessThanOrEqual(Math.round(p95 * 1.35));
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(1);
    const sorted = [...draws].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    expect(median / p95).toBeGreaterThan(0.55);
    expect(median / p95).toBeLessThan(0.65);
  });

  it("keeps data age within ±20%", () => {
    const rng = createRng(7);
    for (let i = 0; i < 2_000; i += 1) {
      const age = sampleDataAge(rng, 220, "btc-usd");
      expect(age).toBeGreaterThanOrEqual(176);
      expect(age).toBeLessThanOrEqual(264);
    }
  });
});

describe("sampleRequest", () => {
  const base = { marketId: "btc-usd" as const, providerId: "the-zone-bio", requestId: "req_000010", now: E, seed: 99 };

  it("is deterministic for the same input", () => {
    expect(sampleRequest(base)).toEqual(sampleRequest(base));
    expect(sampleRequest(base).result).not.toEqual(sampleRequest({ ...base, seed: 100 }).result);
  });

  it("rejects without a route and does not draw", () => {
    const { result, rng } = sampleRequest({ ...base, providerId: null });
    expect(result).toMatchObject({ status: "rejected", reason: "No eligible provider", providerId: null, cost: 0 });
    expect(rng).toBe(99);
  });

  it("fails unavailable providers with 503", () => {
    const conditions = { ...getDefaultConditions("btc-usd").the-zone-bio, available: false };
    const { result } = sampleRequest({ ...base, conditions });
    expect(result).toMatchObject({ status: "failed", error: { code: 503, message: "Service Unavailable" }, cost: 0 });
  });

  it("fails at about the error rate", () => {
    const conditions = { ...getDefaultConditions("btc-usd").wafer, errorRate: 0.1 };
    let seed = 1;
    let failed = 0;
    const n = 5_000;
    for (let i = 0; i < n; i += 1) {
      const { result, rng } = sampleRequest({ ...base, providerId: "wafer", conditions, seed });
      seed = rng;
      if (result.status === "failed") failed += 1;
    }
    expect(failed / n).toBeGreaterThan(0.085);
    expect(failed / n).toBeLessThan(0.115);
  });

  it("returns a normalized BTC payload near the signal with per-request cost", () => {
    const { result } = sampleRequest({ ...base, previousPriceUsd: 75_200 });
    if (result.status !== "ok" || result.marketId !== "btc-usd") throw new Error("expected a served BTC result");
    expect(result.cost).toBeCloseTo(0.7e-6, 12);
    expect(result.payload.sourceTimestamp).toBe(E - result.dataAgeMs);
    expect(Math.abs(result.payload.priceUsd - btcPriceAt(result.payload.sourceTimestamp, E))).toBeLessThanOrEqual(1.5);
    expect(result.payload.changeUsd).toBeCloseTo(result.payload.priceUsd - 75_200, 2);
  });

  it("starts the BTC walk at the baseline and drifts about $7 per second", () => {
    expect(btcPriceAt(E, E)).toBe(BTC_BASELINE_PRICE);
    const steps = Array.from({ length: 2_000 }, (_, i) => btcPriceAt(E + (i + 1) * 1_000, E) - btcPriceAt(E + i * 1_000, E));
    const sigma = Math.sqrt(steps.reduce((sum, d) => sum + d * d, 0) / steps.length);
    expect(sigma).toBeGreaterThan(4);
    expect(sigma).toBeLessThan(10);
  });

  it("drifts weather slowly from the baseline", () => {
    const start = weatherAt(E, E);
    expect(start.temperatureF).toBe(61);
    expect(start.humidityPct).toBe(86);
    const later = weatherAt(E + 10 * 60_000, E);
    expect(Math.abs(later.temperatureF - 61)).toBeLessThan(3);
    const payload = weatherPayload(E, E, 1);
    expect(payload).toMatchObject({ temperatureF: 61.5, humidityPct: 84, condition: "Overcast", windDirection: "W", pressureHpa: 1018 });
  });
});

describe("upstream references", () => {
  it("anchors weather to the reference and keeps provider timestamps", () => {
    const selection = selectRoute("sf-weather");
    const reference = { kind: "weather" as const, at: E - 600_000, temperatureF: 55, humidityPct: 93, condition: "Light rain" };
    const exec = executeSelection(selection, { now: E, seed: 5, reference });
    if (exec.result.status !== "ok" || exec.result.marketId !== "sf-weather") throw new Error("expected served weather");
    const p = exec.result.payload;
    expect(p.condition).toBe("Light rain");
    expect(Math.abs(p.temperatureF - 55)).toBeLessThan(1.5);
    expect(p.dewPointF).toBeLessThanOrEqual(p.temperatureF);
    expect(p.observedAt).toBe(E - exec.result.dataAgeMs);
    expect(exec.reference).toEqual({ source: "upstream", at: E - 600_000, value: reference });
  });

  it("anchors BTC to the reference price", () => {
    expect(anchoredBtcPriceAt(E, E, { kind: "btc", at: E, priceUsd: 98_000 })).toBe(98_000);
    const exec = routeRequest("btc-usd", { now: E, seed: 3, reference: { kind: "btc", priceUsd: 98_000 } });
    if (exec.result.status !== "ok" || exec.result.marketId !== "btc-usd") throw new Error("expected served BTC");
    expect(Math.abs(exec.result.payload.priceUsd - 98_000)).toBeLessThan(30);
    expect(exec.reference.source).toBe("upstream");
  });

  it("ignores a reference for the other market and falls back to the signal", () => {
    const exec = routeRequest("btc-usd", { now: E, seed: 3, reference: { kind: "weather", temperatureF: 10 } });
    expect(exec.reference).toEqual({ source: "signal", at: E, value: signalReference("btc-usd", E) });
  });
});

describe("selectRoute", () => {
  it("selects rank 1 with candidates, ranking, and price", () => {
    const s = selectRoute("sf-weather");
    expect(s).toMatchObject({
      kind: "recommended",
      providerId: "together",
      bidPrice: 18,
      requestPrice: 18e-6,
      recommendedId: "together",
      bestPriceId: "together",
      ranking: ["together", "deepinfra", "fireworks", "digitalocean"],
      policyViolation: false,
      summary: "Together is the lowest-priced provider that meets your policy.",
    });
    expect(s.candidates.map((c) => c.id)).toEqual([
      "together",
      "deepinfra",
      "fireworks",
      "digitalocean",
      "nebius",
      "mistral",
      "cloudflare",
      "modal",
    ]);
    expect(s.candidates.find((c) => c.id === "cloudflare")!.reasons[0].message).toBe("P95 640 ms exceeds 400 ms");
  });

  it("applies policy overrides and conditions", () => {
    expect(selectRoute("btc-usd", { policy: { preference: "lowest-latency" } }).providerId).toBe("coreweave");
    const conditions = { novita: { ...getDefaultConditions("btc-usd").novita, p95LatencyMs: 90 } };
    expect(selectRoute("btc-usd", { conditions }).providerId).toBe("novita");
  });

  it("pins a provider and reports violations", () => {
    const s = selectRoute("btc-usd", { pin: "wafer" });
    expect(s).toMatchObject({ kind: "pinned-failing", providerId: "wafer", recommendedId: "the-zone-bio", policyViolation: true });
    expect(s.summary).toBe("Pinned provider Wafer fails your policy: Success 99.15% is below 99.90%. Requests still go to Wafer.");
    expect(selectRoute("btc-usd", { pin: "coreweave" }).kind).toBe("pinned");
    expect(selectRoute("btc-usd", { pin: "unknown" })).toMatchObject({ kind: "no-eligible", providerId: null });
    expect(selectRoute("btc-usd", { policy: { mode: { kind: "pinned", providerId: "baseten" } }, pin: null }).kind).toBe(
      "recommended",
    );
  });

  it("rejects requests when nothing qualifies", () => {
    const exec = routeRequest("sf-weather", { policy: { maxPrice: 5 }, now: E, seed: 1, requestId: "req_000001" });
    expect(exec.selection.kind).toBe("no-eligible");
    expect(exec.result).toMatchObject({ status: "rejected", requestId: "req_000001" });
  });

  it("executes the frozen selection deterministically", () => {
    const s = selectRoute("sf-weather", { policy: { preference: "freshest-data" } });
    const seed = seedFromString("req_000123");
    const a = executeSelection(s, { now: E, seed, requestId: "req_000123" });
    const b = executeSelection(s, { now: E, seed, requestId: "req_000123" });
    expect(a).toEqual(b);
    expect(a.result.status === "ok" && a.result.providerId).toBe("deepinfra");
  });
});
