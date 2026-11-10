import { describe, expect, it } from "vitest";

import { BTC_USD, getInitialMarketView, SF_WEATHER, type ProviderConditions } from "@/lib/tender";

import { roleBadge, roleSummary, scenarioActions, statusTone } from "./conditions-helpers";

const base: ProviderConditions = {
  bidPrice: 18,
  p95LatencyMs: 210,
  dataAgeMs: 6 * 60_000,
  errorRate: 0.0006,
  available: true,
};

describe("scenarioActions", () => {
  it("builds weather patches within the market's steps", () => {
    const byId = Object.fromEntries(scenarioActions(SF_WEATHER, { conditions: base }).map((s) => [s.id, s]));
    expect(byId["raise-bid"]).toMatchObject({ label: "Raise bid 50%", patch: { bidPrice: 27 } });
    expect(byId["cut-bid"]).toMatchObject({ label: "Cut bid 50%", patch: { bidPrice: 9 } });
    expect(byId["add-latency"]).toMatchObject({ label: "Add 300 ms latency", patch: { p95LatencyMs: 510 } });
    expect(byId["delay-data"]).toMatchObject({ label: "Delay data 15 min", patch: { dataAgeMs: 21 * 60_000 } });
    expect(byId.availability).toMatchObject({ label: "Take offline", patch: { available: false } });
  });

  it("builds BTC patches in milliseconds and dollar cents", () => {
    const btc: ProviderConditions = {
      bidPrice: 0.7,
      p95LatencyMs: 87,
      dataAgeMs: 220,
      errorRate: 0.0003,
      available: false,
    };
    const byId = Object.fromEntries(scenarioActions(BTC_USD, { conditions: btc }).map((s) => [s.id, s]));
    expect(byId["raise-bid"].patch).toEqual({ bidPrice: 1.05 });
    expect(byId["cut-bid"].patch).toEqual({ bidPrice: 0.35 });
    expect(byId["add-latency"]).toMatchObject({ label: "Add 100 ms latency", patch: { p95LatencyMs: 187 } });
    expect(byId["delay-data"]).toMatchObject({ label: "Delay data 1 s", patch: { dataAgeMs: 1_220 } });
    expect(byId.availability).toMatchObject({ label: "Bring online", patch: { available: true } });
  });

  it("disables actions that would not change anything at a range limit", () => {
    const maxed: ProviderConditions = { ...base, bidPrice: 200, p95LatencyMs: 3000, dataAgeMs: 240 * 60_000 };
    const byId = Object.fromEntries(scenarioActions(SF_WEATHER, { conditions: maxed }).map((s) => [s.id, s]));
    expect(byId["raise-bid"].patch).toBeNull();
    expect(byId["add-latency"].patch).toBeNull();
    expect(byId["delay-data"].patch).toBeNull();
    expect(byId["cut-bid"].patch).toEqual({ bidPrice: 100 });
  });

  it("never cuts a bid below the market minimum", () => {
    const cheap: ProviderConditions = { ...base, bidPrice: 0.5 };
    const cut = scenarioActions(SF_WEATHER, { conditions: cheap }).find((s) => s.id === "cut-bid");
    expect(cut?.patch).toBeNull();
  });
});

describe("status and role badges", () => {
  it("maps statuses to tones", () => {
    expect(statusTone("eligible")).toBe("positive");
    expect(statusTone("too-slow")).toBe("warning");
    expect(statusTone("stale-data")).toBe("warning");
    expect(statusTone("over-budget")).toBe("warning");
    expect(statusTone("unavailable")).toBe("negative");
    expect(statusTone("unreliable")).toBe("negative");
  });

  it("labels route roles", () => {
    expect(roleBadge({ role: "active" })).toEqual({ label: "Active", tone: "active" });
    expect(roleBadge({ role: "pinned-failing" })).toEqual({ label: "Pinned, failing", tone: "negative" });
    expect(roleBadge({ role: "excluded" })).toEqual({ label: "Excluded", tone: "neutral" });
  });

  it("summarizes the default weather providers", () => {
    const view = getInitialMarketView("sf-weather");
    expect(roleSummary(view.providersById.fernline, "lowest-cost")).toBe(
      "Serving requests. Ranked 1st for lowest cost.",
    );
    expect(roleSummary(view.providersById.kitefin, "lowest-cost")).toBe(
      "Standby. Qualifies and ranks 2nd for lowest cost.",
    );
    expect(roleSummary(view.providersById.slatework, "lowest-cost")).toBe("Excluded: P95 640 ms exceeds 400 ms.");
    expect(roleSummary(view.providersById.kelpwave, "lowest-cost")).toBe("Excluded: Provider is not responding.");
  });
});
