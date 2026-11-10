import { describe, expect, it } from "vitest";
import { FIXTURE_EPOCH } from "./constants";
import { createInitialState, reduce } from "./engine";
import { getInitialMarketView } from "./sample-state";
import { selectMarketView } from "./selectors";

const E = FIXTURE_EPOCH;

describe("selectMarketView", () => {
  it("orders providers: active, qualified by rank, excluded by status priority then price", () => {
    const state = createInitialState();
    expect(selectMarketView(state.markets["sf-weather"]).providers.map((p) => p.id)).toEqual([
      "fernline",
      "kitefin",
      "cinderlane",
      "saltmarsh",
      "kelpwave",
      "owlbridge",
      "slatework",
      "mossgate",
    ]);
    expect(selectMarketView(state.markets["btc-usd"]).providers.map((p) => p.id)).toEqual([
      "the-zone-bio",
      "arca-labs",
      "bramblecore",
      "quarrystone",
      "heronway",
      "basaltine",
      "brindlewood",
      "hollowbrook",
    ]);
  });

  it("keeps the active provider first while a switch is pending", () => {
    const state = [
      { type: "update-provider", marketId: "sf-weather", providerId: "fernline", patch: { p95LatencyMs: 640 }, now: E + 1_000 },
      { type: "update-provider", marketId: "sf-weather", providerId: "fernline", patch: { p95LatencyMs: 210 }, now: E + 2_000 },
    ].reduce((s, a) => reduce(s, a as Parameters<typeof reduce>[1]), createInitialState());
    const view = selectMarketView(state.markets["sf-weather"]);
    expect(view.providers.slice(0, 2).map((p) => p.id)).toEqual(["kitefin", "fernline"]);
    expect(view.providers[0].role).toBe("active");
    expect(view.providers[1]).toMatchObject({ isRecommended: true, isPendingTarget: true, role: "standby" });
  });

  it("derives rows, roles, markers, decision, and metrics", () => {
    const view = getInitialMarketView("sf-weather");
    const fernline = view.providersById.fernline;
    expect(fernline).toMatchObject({
      name: "Fernline",
      logo: "/providers/fernline.svg",
      status: "eligible",
      statusLabel: "Eligible",
      role: "active",
      isActive: true,
      isRecommended: true,
      isBestPrice: true,
      modified: false,
      requestPrice: 18e-6,
    });
    expect(fernline.history).toHaveLength(30);
    expect(view.providersById.slatework).toMatchObject({ role: "excluded", statusLabel: "Too slow", isBestPrice: false });
    expect(view.providersById.kitefin.role).toBe("standby");
    expect(view.qualifiedCount).toBe(4);
    expect(view.excludedCount).toBe(4);
    expect(view.decision).toMatchObject({
      kind: "routing",
      title: "Routing to Fernline",
      summary: "Fernline is the lowest-priced provider that meets your policy.",
    });
    expect(view.decision.details).toContain("Slatework is cheaper ($12.00 /M) but excluded: P95 640 ms exceeds 400 ms.");
    expect(view.metrics).toMatchObject({
      activeProviderId: "fernline",
      activeProviderName: "Fernline",
      bidPrice: 18,
      p95LatencyMs: 210,
      dataAgeMs: 360_000,
      requests: { total: 1, served: 1, failed: 0, rejected: 0 },
    });
    expect(view.metrics.successRate).toBeCloseTo(0.9994, 6);
    expect(view.lastResult?.status).toBe("ok");
    expect(view.lastServed?.providerId).toBe("fernline");
    expect(view.activity.length).toBeGreaterThan(0);
    expect(view.autoRun).toBe(false);
  });

  it("returns the same view object for the same market state", () => {
    const state = createInitialState();
    const view = selectMarketView(state.markets["btc-usd"]);
    expect(selectMarketView(state.markets["btc-usd"])).toBe(view);
    const ticked = reduce(state, { type: "tick", now: E + 1_000 });
    expect(selectMarketView(ticked.markets["btc-usd"])).toBe(view);
  });

  it("shows the best price separately when the preference is not cost", () => {
    const state = reduce(createInitialState(), {
      type: "set-policy",
      marketId: "btc-usd",
      patch: { preference: "lowest-latency" },
      now: E + 1_000,
    });
    const view = selectMarketView(state.markets["btc-usd"]);
    expect(view.recommended?.id).toBe("bramblecore");
    expect(view.bestPrice?.id).toBe("the-zone-bio");
    expect(view.decision.details).toContain("Best price: THE ZONE BIO at $0.70 /M.");
    expect(view.modifiedPolicyFields).toEqual(["preference"]);
  });
});
