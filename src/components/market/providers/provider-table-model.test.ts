import { describe, expect, it } from "vitest";

import {
  FIXTURE_EPOCH,
  createInitialState,
  getInitialMarketView,
  reduce,
  selectMarketView,
  type MarketId,
  type TenderAction,
  type TenderState,
} from "@/lib/tender";

import {
  failingMetrics,
  groupProviders,
  metricReason,
  nextSort,
  policyChips,
  providerTags,
  providerTrend,
  qualifyCountText,
  routeLabel,
  sortProviders,
  statusTone,
  trendMetric,
  trendScale,
  valueParts,
} from "./provider-table-model";

const E = FIXTURE_EPOCH;

/** A reducer action without its timestamp (distributes over the action union). */
type ActionInput = TenderAction extends infer A ? (A extends TenderAction ? Omit<A, "now"> : never) : never;

/** Apply actions (each stamped 1 s apart) to a fresh initial state and return the market view. */
function viewAfter(marketId: MarketId, ...actions: ActionInput[]) {
  let state: TenderState = createInitialState();
  actions.forEach((action, index) => {
    state = reduce(state, { ...action, now: E + (index + 1) * 1_000 } as TenderAction);
  });
  return selectMarketView(state.markets[marketId]);
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe("policyChips", () => {
  it("summarizes the weather defaults in the policy form units", () => {
    const chips = policyChips(getInitialMarketView("sf-weather"));
    expect(chips.map((c) => c.label)).toEqual(["Max $40.00 /M", "P95 ≤ 400 ms", "Age ≤ 15 min", "Success ≥ 99.50%", "Auto"]);
    expect(chips.every((c) => !c.modified && !c.failing)).toBe(true);
    expect(chips[0].description).toBe("Max price $40.00 /M req");
  });

  it("uses milliseconds for Bitcoin data age", () => {
    const chips = policyChips(getInitialMarketView("btc-usd"));
    expect(chips.map((c) => c.label)).toEqual(["Max $2.00 /M", "P95 ≤ 150 ms", "Age ≤ 1,000 ms", "Success ≥ 99.90%", "Auto"]);
  });

  it("marks edited limits and a failing pin", () => {
    const view = viewAfter(
      "sf-weather",
      { type: "set-policy", marketId: "sf-weather", patch: { maxP95LatencyMs: 300 } },
      { type: "set-routing-mode", marketId: "sf-weather", mode: { kind: "pinned", providerId: "slatework" } },
    );
    const chips = policyChips(view);
    expect(chips.find((c) => c.key === "maxP95LatencyMs")).toMatchObject({ label: "P95 ≤ 300 ms", modified: true });
    expect(chips.find((c) => c.key === "maxPrice")?.modified).toBe(false);
    expect(chips.find((c) => c.key === "mode")).toMatchObject({ label: "Pinned: Slatework", modified: true, failing: true });
  });
});

describe("qualifyCountText", () => {
  it("agrees with the count", () => {
    expect(qualifyCountText(4, 8)).toBe("4 of 8 qualify");
    expect(qualifyCountText(1, 8)).toBe("1 of 8 qualifies");
    expect(qualifyCountText(0, 8)).toBe("0 of 8 qualify");
  });
});

describe("groupProviders", () => {
  it("keeps routing order and splits off excluded providers", () => {
    const { routed, excluded } = groupProviders(getInitialMarketView("sf-weather").providers);
    expect(ids(routed)).toEqual(["fernline", "kitefin", "cinderlane", "saltmarsh"]);
    expect(ids(excluded)).toEqual(["kelpwave", "owlbridge", "slatework", "mossgate"]);
  });

  it("keeps a failing pinned provider in the routed group, first", () => {
    const view = viewAfter("sf-weather", {
      type: "set-routing-mode",
      marketId: "sf-weather",
      mode: { kind: "pinned", providerId: "slatework" },
    });
    const { routed, excluded } = groupProviders(view.providers);
    expect(routed[0]).toMatchObject({ id: "slatework", role: "pinned-failing" });
    expect(ids(excluded)).not.toContain("slatework");
  });

  it("moves a provider that fails over into the excluded group", () => {
    const view = viewAfter("sf-weather", {
      type: "update-provider",
      marketId: "sf-weather",
      providerId: "fernline",
      patch: { p95LatencyMs: 520 },
    });
    const { routed, excluded } = groupProviders(view.providers);
    expect(routed[0]).toMatchObject({ id: "kitefin", role: "active" });
    expect(ids(excluded)).toContain("fernline");
  });

  it("sorts inside each group", () => {
    const { routed, excluded } = groupProviders(getInitialMarketView("sf-weather").providers, { key: "bid", direction: "desc" });
    expect(ids(routed)).toEqual(["saltmarsh", "cinderlane", "kitefin", "fernline"]);
    expect(ids(excluded)).toEqual(["owlbridge", "kelpwave", "mossgate", "slatework"]);
  });
});

describe("sorting", () => {
  const rows = getInitialMarketView("sf-weather").providers;

  it("cycles natural direction, reversed, then routing order", () => {
    expect(nextSort(null, "bid")).toEqual({ key: "bid", direction: "asc" });
    expect(nextSort({ key: "bid", direction: "asc" }, "bid")).toEqual({ key: "bid", direction: "desc" });
    expect(nextSort({ key: "bid", direction: "desc" }, "bid")).toBeNull();
    expect(nextSort(null, "success")).toEqual({ key: "success", direction: "desc" });
    expect(nextSort({ key: "success", direction: "desc" }, "success")).toEqual({ key: "success", direction: "asc" });
    expect(nextSort({ key: "bid", direction: "asc" }, "latency")).toEqual({ key: "latency", direction: "asc" });
  });

  it("sorts by each column and puts unavailable providers last by success", () => {
    expect(ids(sortProviders(rows, { key: "latency", direction: "asc" })).slice(0, 3)).toEqual(["owlbridge", "cinderlane", "kitefin"]);
    expect(ids(sortProviders(rows, { key: "dataAge", direction: "asc" }))[0]).toBe("owlbridge");
    expect(ids(sortProviders(rows, { key: "name", direction: "asc" }))[0]).toBe("cinderlane");
    expect(ids(sortProviders(rows, { key: "success", direction: "desc" })).at(-1)).toBe("kelpwave");
    expect(ids(sortProviders(rows, null))).toEqual(ids(rows));
  });
});

describe("failing metrics", () => {
  const weather = getInitialMarketView("sf-weather").providersById;
  const btc = getInitialMarketView("btc-usd").providersById;

  it("tints the metric that fails, amber for limits and red for reliability", () => {
    expect(failingMetrics(weather.slatework)).toEqual({ latency: "warning" });
    expect(failingMetrics(weather.mossgate)).toEqual({ dataAge: "warning" });
    expect(failingMetrics(weather.owlbridge)).toEqual({ bid: "warning" });
    expect(failingMetrics(weather.kelpwave)).toEqual({});
    expect(failingMetrics(btc.heronway)).toEqual({ success: "negative" });
    expect(failingMetrics(weather.fernline)).toEqual({});
  });

  it("explains the tinted cell with the engine's reason copy", () => {
    expect(metricReason(weather.slatework, "latency")).toBe("P95 640 ms exceeds 400 ms");
    expect(metricReason(weather.owlbridge, "bid")).toBe("Bid $58.00 exceeds $40.00 /M");
    expect(metricReason(btc.heronway, "success")).toBe("Success 99.15% is below 99.90%");
    expect(metricReason(weather.slatework, "bid")).toBeNull();
  });

  it("maps statuses to badge tones", () => {
    expect(statusTone("eligible")).toBe("positive");
    expect(statusTone("too-slow")).toBe("warning");
    expect(statusTone("stale-data")).toBe("warning");
    expect(statusTone("over-budget")).toBe("warning");
    expect(statusTone("unavailable")).toBe("negative");
    expect(statusTone("unreliable")).toBe("negative");
  });
});

describe("route labels and tags", () => {
  it("names the route of every role", () => {
    const view = getInitialMarketView("sf-weather");
    expect(routeLabel(view.providersById.fernline)).toEqual({ text: "Active", tone: "active" });
    expect(routeLabel(view.providersById.kitefin)).toEqual({ text: "#2 standby", tone: "neutral" });
    expect(routeLabel(view.providersById.slatework)).toEqual({ text: "Excluded", tone: "faint" });
    expect(providerTags(view.providersById.fernline)).toEqual(["active", "best-price"]);
    expect(providerTags(view.providersById.kitefin)).toEqual([]);
  });

  it("labels pins and the pending switch target", () => {
    const pinned = viewAfter("sf-weather", {
      type: "set-routing-mode",
      marketId: "sf-weather",
      mode: { kind: "pinned", providerId: "slatework" },
    });
    expect(routeLabel(pinned.providersById.slatework)).toEqual({ text: "Pinned, failing", tone: "negative" });
    expect(providerTags(pinned.providersById.slatework)).toEqual(["pinned"]);

    // Failover to Kitefin, then Fernline recovers inside the cooldown: switching back waits.
    const pending = viewAfter(
      "sf-weather",
      { type: "update-provider", marketId: "sf-weather", providerId: "fernline", patch: { p95LatencyMs: 640 } },
      { type: "update-provider", marketId: "sf-weather", providerId: "fernline", patch: { p95LatencyMs: 210 } },
    );
    expect(pending.decision.kind).toBe("pending-switch");
    expect(routeLabel(pending.providersById.fernline)).toEqual({ text: "Next route", tone: "warning" });
    expect(providerTags(pending.providersById.fernline)).toEqual(["best-price"]);
    expect(providerTags(pending.providersById.kitefin)).toEqual(["active"]);
  });
});

describe("trend", () => {
  const view = getInitialMarketView("sf-weather");
  const btc = getInitialMarketView("btc-usd");

  it("follows the failing check, else the preference metric", () => {
    expect(trendMetric(view.providersById.slatework, view.policy)).toBe("latency");
    expect(trendMetric(view.providersById.mossgate, view.policy)).toBe("dataAge");
    expect(trendMetric(view.providersById.owlbridge, view.policy)).toBe("bid");
    expect(trendMetric(view.providersById.kelpwave, view.policy)).toBe("success");
    expect(trendMetric(btc.providersById.heronway, btc.policy)).toBe("success");
    expect(trendMetric(view.providersById.fernline, view.policy)).toBe("latency");
    expect(trendMetric(view.providersById.fernline, { preference: "freshest-data" })).toBe("dataAge");
    expect(trendMetric(view.providersById.fernline, { preference: "lowest-latency" })).toBe("latency");
  });

  it("returns the monitor series with the policy limit", () => {
    const trend = providerTrend(view.providersById.fernline, view.policy);
    expect(trend.values).toHaveLength(30);
    expect(trend.limit).toBe(400);
    expect(trend.description).toMatch(/^P95 latency, last 30 samples, now \d+ ms, limit 400 ms$/);
    const age = providerTrend(view.providersById.mossgate, view.policy);
    expect(age).toMatchObject({ metric: "dataAge", limit: 15 * 60_000 });
    expect(age.description).toContain("limit 15 min");
    const success = providerTrend(btc.providersById.heronway, btc.policy);
    expect(success.description).toContain("minimum 99.90%");
  });

  it("scales success rate to a window around the minimum", () => {
    expect(trendScale({ metric: "latency", values: [210], limit: 400 })).toEqual({ minSpanRatio: 1 });
    const scale = trendScale({ metric: "success", values: [0.9994, 0.9996], limit: 0.995 });
    expect(scale.domain?.[0]).toBeCloseTo(0.9835, 4);
    expect(scale.domain?.[1]).toBeCloseTo(1.0015, 4);
    expect(trendScale({ metric: "success", values: [0, 0], limit: 0.995 }).domain?.[0]).toBe(0);
  });
});

describe("valueParts", () => {
  it("splits numbers from units", () => {
    expect(valueParts("210 ms")).toEqual([
      { text: "210", unit: false },
      { text: " ms", unit: true },
    ]);
    expect(valueParts("1 h 12 min").map((p) => p.text)).toEqual(["1", " h ", "12", " min"]);
    expect(valueParts("2.4 s")[0]).toEqual({ text: "2.4", unit: false });
    expect(valueParts("1,000 ms")[0]).toEqual({ text: "1,000", unit: false });
  });
});
