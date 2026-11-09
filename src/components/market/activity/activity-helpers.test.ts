import { describe, expect, it } from "vitest";

import { createInitialState, FIXTURE_EPOCH, reduce, selectMarketView, type ActivityEntry, type ActivityKind } from "@/lib/tender";

import {
  ACTIVITY_FILTERS,
  ACTIVITY_GROUP,
  countByFilter,
  filterActivity,
  parseRouteSwitchDetails,
  TRIGGER_LABELS,
} from "./activity-helpers";

function busyMarket(): ActivityEntry[] {
  let now = FIXTURE_EPOCH + 1_000;
  let state = reduce(createInitialState(), { type: "rebase", now });
  const step = (action: Parameters<typeof reduce>[1]) => {
    state = reduce(state, action);
  };
  step({ type: "update-provider", marketId: "sf-weather", providerId: "together", patch: { p95LatencyMs: 640 }, now: (now += 1_000) });
  step({ type: "update-provider", marketId: "sf-weather", providerId: "deepinfra", patch: { bidPrice: 30 }, now: (now += 1_000) });
  step({ type: "set-policy", marketId: "sf-weather", patch: { maxPrice: 5 }, now: (now += 1_000) });
  step({ type: "run-request", marketId: "sf-weather", now: (now += 1_000) });
  step({ type: "reset-policy", marketId: "sf-weather", now: (now += 1_000) });
  step({ type: "set-routing-mode", marketId: "sf-weather", mode: { kind: "pinned", providerId: "cloudflare" }, now: (now += 1_000) });
  return selectMarketView(state.markets["sf-weather"]).activity;
}

describe("activity filters", () => {
  const entries = busyMarket();

  it("keeps the feed newest first", () => {
    for (let i = 1; i < entries.length; i++) expect(entries[i - 1].seq).toBeGreaterThan(entries[i].seq);
  });

  it("filters each group to its kinds", () => {
    for (const { value } of ACTIVITY_FILTERS) {
      const filtered = filterActivity(entries, value);
      if (value === "all") expect(filtered).toHaveLength(entries.length);
      else expect(filtered.every((entry) => ACTIVITY_GROUP[entry.kind] === value)).toBe(true);
    }
    expect(filterActivity(entries, "routing").map((entry) => entry.kind)).toContain("route-switch");
    expect(filterActivity(entries, "requests").map((entry) => entry.kind)).toContain("request-rejected");
    expect(filterActivity(entries, "conditions").map((entry) => entry.kind)).toContain("bid-updated");
    expect(filterActivity(entries, "policy").map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(["policy-updated", "policy-reset", "mode-changed"]),
    );
  });

  it("counts every entry exactly once", () => {
    const counts = countByFilter(entries);
    expect(counts.routing + counts.requests + counts.conditions + counts.policy).toBe(counts.all);
  });

  it("assigns every activity kind to a group", () => {
    const kinds: ActivityKind[] = [
      "route-established", "route-switch", "no-eligible", "switch-scheduled", "switch-cancelled", "pin-violation",
      "pin-recovered", "request-served", "request-failed", "request-rejected", "bid-updated", "conditions-updated",
      "provider-restored", "conditions-reset", "policy-updated", "policy-reset", "policy-restored", "mode-changed", "auto-run",
    ];
    expect(Object.keys(ACTIVITY_GROUP).sort()).toEqual([...kinds].sort());
  });
});

describe("parseRouteSwitchDetails", () => {
  it("splits an engine failover entry into trigger, checks, and notes", () => {
    const entries = busyMarket();
    const failover = entries.find((entry) => entry.kind === "route-switch" && entry.trigger === "failover");
    expect(failover).toBeDefined();
    const parts = parseRouteSwitchDetails(failover!.details);
    expect(parts.trigger).toBe("Together failed the latency check: P95 640 ms exceeds 400 ms.");
    expect(parts.qualifiedName).toBe("DeepInfra");
    expect(parts.checks).toEqual([
      "Bid $22.00 ≤ $40.00 /M",
      "P95 180 ms ≤ 400 ms",
      "Data age 2 min ≤ 15 min",
      "Success 99.97% ≥ 99.50%",
    ]);
    expect(parts.notes).toEqual(["Selected: ranked first for lowest cost."]);
    expect(TRIGGER_LABELS[(failover as Extract<ActivityEntry, { kind: "route-switch" }>).trigger]).toBe("Failover");
  });

  it("keeps the failure line of a pinned provider that fails the policy", () => {
    const entries = busyMarket();
    const pinned = entries.find((entry) => entry.kind === "route-switch" && entry.toProviderId === "cloudflare");
    const parts = parseRouteSwitchDetails(pinned!.details);
    expect(parts.failure).toBe("Cloudflare fails your policy: P95 640 ms exceeds 400 ms.");
    expect(parts.checks).toEqual([]);
    expect(parts.notes).toEqual(["Pinned: requests always go to Cloudflare."]);
  });

  it("keeps unknown lines as notes", () => {
    expect(parseRouteSwitchDetails(["Something new."])).toEqual({
      trigger: null,
      checks: [],
      qualifiedName: null,
      failure: null,
      notes: ["Something new."],
    });
  });
});
