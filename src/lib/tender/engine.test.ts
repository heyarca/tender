import { describe, expect, it } from "vitest";
import { POLICIES_STORAGE_KEY, SWITCH_COOLDOWN_MS, FIXTURE_EPOCH } from "./constants";
import { createInitialState, rebaseState, reduce, type TenderAction } from "./engine";
import { getDefaultPolicy, MARKETS } from "./fixtures";
import { parsePersistedPolicies, serializePolicies } from "./persistence";
import { formatPendingSwitch, selectMarketView } from "./selectors";
import type { ActivityEntry, MarketId, TenderState } from "./types";

const E = FIXTURE_EPOCH;
const W: MarketId = "sf-weather";
const B: MarketId = "btc-usd";

const run = (state: TenderState, ...actions: TenderAction[]) => actions.reduce(reduce, state);
const active = (state: TenderState, marketId: MarketId) => state.markets[marketId].route.activeProviderId;
const latest = (state: TenderState, marketId: MarketId) => state.markets[marketId].activity[0];
const latestOf = <K extends ActivityEntry["kind"]>(state: TenderState, marketId: MarketId, kind: K) =>
  state.markets[marketId].activity.find((entry): entry is Extract<ActivityEntry, { kind: K }> => entry.kind === kind);
const update = (marketId: MarketId, providerId: string, patch: object, now: number): TenderAction => ({
  type: "update-provider",
  marketId,
  providerId,
  patch,
  now,
});
const request = (marketId: MarketId, now: number): TenderAction => ({ type: "run-request", marketId, now });

describe("initial state", () => {
  it("routes to Together and THE ZONE BIO with one served request each", () => {
    const state = createInitialState();
    expect(state.now).toBe(E);
    expect(active(state, W)).toBe("together");
    expect(active(state, B)).toBe("the-zone-bio");
    for (const id of [W, B]) {
      const market = state.markets[id];
      expect(market.requests).toHaveLength(1);
      expect(market.requests[0].status).toBe("ok");
      expect(market.series.length).toBeGreaterThanOrEqual(40);
      for (const provider of market.providers) expect(provider.history).toHaveLength(30);
    }
  });

  it("is identical on every call (server and client first render match)", () => {
    expect(createInitialState()).toEqual(createInitialState());
  });
});

describe("failover", () => {
  it("switches immediately when the active provider stops qualifying", () => {
    // Within the cooldown of a previous switch, failover still runs at once.
    let state = run(createInitialState(), { type: "set-policy", marketId: W, patch: { preference: "lowest-latency" }, now: E + 500 });
    expect(active(state, W)).toBe("fireworks");
    state = run(state, update(W, "fireworks", { p95LatencyMs: 640 }, E + 1_000));
    expect(active(state, W)).toBe("deepinfra");
    expect(state.markets[W].route.lastSwitchAt).toBe(E + 1_000);
  });

  it("writes a route switch entry with previous, new, trigger, and all four checks", () => {
    const state = run(createInitialState(), update(W, "together", { p95LatencyMs: 640 }, E + 1_000));
    expect(active(state, W)).toBe("deepinfra");
    const entry = latestOf(state, W, "route-switch")!;
    expect(entry).toMatchObject({
      kind: "route-switch",
      fromProviderId: "together",
      toProviderId: "deepinfra",
      trigger: "failover",
      title: "Switched from Together to DeepInfra",
      notify: true,
      at: E + 1_000,
    });
    expect(entry.details[0]).toBe("Trigger: Together failed the latency check: P95 640 ms exceeds 400 ms.");
    expect(entry.details[1]).toBe(
      "DeepInfra qualifies: Bid $22.00 ≤ $40.00 /M · P95 180 ms ≤ 400 ms · Data age 2 min ≤ 15 min · Success 99.97% ≥ 99.50%.",
    );
    // The condition change itself is logged before the switch.
    const condition = state.markets[W].activity[1];
    expect(condition.kind).toBe("conditions-updated");
    expect(condition.title).toBe("Together P95 latency changed from 210 ms to 640 ms");
  });

  it("fails over when the active provider becomes unavailable", () => {
    const state = run(createInitialState(), update(B, "the-zone-bio", { available: false }, E + 1_000));
    expect(active(state, B)).toBe("arca-labs");
    expect(latestOf(state, B, "route-switch")!.details[0]).toBe(
      "Trigger: THE ZONE BIO failed the availability check: Provider is not responding.",
    );
  });
});

describe("operator changes", () => {
  it("re-routes immediately on a policy change, ignoring the cooldown", () => {
    let state = run(createInitialState(), update(W, "together", { p95LatencyMs: 640 }, E + 1_000));
    expect(active(state, W)).toBe("deepinfra");
    state = run(state, { type: "set-policy", marketId: W, patch: { preference: "lowest-latency" }, now: E + 2_000 });
    expect(active(state, W)).toBe("fireworks");
    const entry = latestOf(state, W, "route-switch")!;
    expect(entry.trigger).toBe("policy-change");
    expect(entry.details[0]).toBe("Trigger: Policy changed: Preference Lowest cost → Lowest latency.");
    expect(state.markets[W].route.pending).toBeNull();
  });

  it("excludes the active provider when a limit tightens", () => {
    const state = run(createInitialState(), { type: "set-policy", marketId: W, patch: { maxP95LatencyMs: 200 }, now: E + 1_000 });
    expect(active(state, W)).toBe("deepinfra");
    expect(latestOf(state, W, "policy-updated")!.title).toBe("Policy updated: max P95 latency 400 ms → 200 ms");
  });

  it("re-routes immediately on a mode change", () => {
    let state = run(createInitialState(), { type: "set-routing-mode", marketId: W, mode: { kind: "pinned", providerId: "fireworks" }, now: E + 1_000 });
    expect(active(state, W)).toBe("fireworks");
    state = run(state, { type: "set-routing-mode", marketId: W, mode: { kind: "auto" }, now: E + 2_000 });
    expect(active(state, W)).toBe("together");
  });
});

describe("optimization switches", () => {
  // Together fails over to DeepInfra at E+1s, then is restored at E+3s and outranks DeepInfra again.
  const setup = () =>
    run(
      createInitialState(),
      update(W, "together", { p95LatencyMs: 640 }, E + 1_000),
      update(W, "together", { p95LatencyMs: 210 }, E + 3_000),
    );

  it("waits for the cooldown, then the tick executes the pending switch", () => {
    let state = setup();
    expect(active(state, W)).toBe("deepinfra");
    const pending = state.markets[W].route.pending!;
    expect(pending).toEqual({ providerId: "together", executeAt: E + 1_000 + SWITCH_COOLDOWN_MS, scheduledAt: E + 3_000 });
    expect(latest(state, W).kind).toBe("switch-scheduled");
    expect(latest(state, W).title).toBe("Switch to Together scheduled in 8 s");

    const view = selectMarketView(state.markets[W]);
    expect(view.decision.kind).toBe("pending-switch");
    expect(formatPendingSwitch(view.decision.pending!, E + 4_000)).toBe("Switching to Together in 7 s — switch cooldown");
    expect(view.providersById.together.isPendingTarget).toBe(true);

    state = run(state, { type: "tick", now: E + 10_000 });
    expect(active(state, W)).toBe("deepinfra");
    state = run(state, { type: "tick", now: E + 11_000 });
    expect(active(state, W)).toBe("together");
    expect(state.markets[W].route.pending).toBeNull();
    const entry = latestOf(state, W, "route-switch")!;
    expect(entry.trigger).toBe("optimization");
    expect(entry.details[0]).toBe("Trigger: Together now ranks above DeepInfra for lowest cost (bid $18.00 vs $22.00 /M).");
  });

  it("cancels the pending switch when the advantage disappears", () => {
    let state = setup();
    state = run(state, update(W, "together", { bidPrice: 30 }, E + 5_000));
    expect(state.markets[W].route.pending).toBeNull();
    expect(latest(state, W).kind).toBe("switch-cancelled");
    expect(latest(state, W).title).toBe("Scheduled switch to Together cancelled");
    state = run(state, { type: "tick", now: E + 12_000 });
    expect(active(state, W)).toBe("deepinfra");
  });

  it("switches at once when the cooldown has already passed", () => {
    const state = run(createInitialState(), update(W, "cloudflare", { p95LatencyMs: 300 }, E + 1_000));
    expect(active(state, W)).toBe("cloudflare");
    expect(latestOf(state, W, "route-switch")!.trigger).toBe("optimization");
  });

  it("skips the cooldown with switchToRecommended in automatic mode", () => {
    const state = run(setup(), { type: "switch-to-recommended", marketId: W, now: E + 4_000 });
    expect(active(state, W)).toBe("together");
    expect(latestOf(state, W, "route-switch")!.trigger).toBe("operator-switch");
  });
});

describe("no eligible provider", () => {
  it("rejects requests and recovers when a provider qualifies again", () => {
    let state = run(createInitialState(), { type: "set-policy", marketId: W, patch: { maxPrice: 15 }, now: E + 1_000 });
    expect(active(state, W)).toBeNull();
    const entry = latestOf(state, W, "no-eligible")!;
    expect(entry.title).toBe("No eligible provider");
    expect(entry.notify).toBe(true);
    expect(selectMarketView(state.markets[W]).decision.kind).toBe("no-eligible");

    state = run(state, request(W, E + 2_000));
    const result = state.markets[W].requests[0];
    expect(result).toMatchObject({ status: "rejected", reason: "No eligible provider", providerId: null, cost: 0 });
    expect(state.markets[W].counters.rejected).toBe(1);
    expect(latest(state, W).kind).toBe("request-rejected");

    // Cloudflare ($12) qualifies after its latency drops: route to it immediately.
    state = run(state, update(W, "cloudflare", { p95LatencyMs: 300 }, E + 2_500));
    expect(active(state, W)).toBe("cloudflare");
    expect(latestOf(state, W, "route-switch")!.trigger).toBe("recovery");
    state = run(state, request(W, E + 3_000));
    expect(state.markets[W].requests[0]).toMatchObject({ status: "ok", providerId: "cloudflare" });
  });

  it("never routes to a provider that fails the policy", () => {
    const state = run(createInitialState(), { type: "set-policy", marketId: B, patch: { maxP95LatencyMs: 30 }, now: E + 1_000 });
    expect(active(state, B)).toBeNull();
  });
});

describe("pinned mode", () => {
  const pinned = () =>
    run(createInitialState(), { type: "set-routing-mode", marketId: W, mode: { kind: "pinned", providerId: "together" }, now: E + 1_000 });

  it("surfaces a violation without switching", () => {
    const state = run(pinned(), update(W, "together", { p95LatencyMs: 640 }, E + 2_000));
    expect(active(state, W)).toBe("together");
    const entry = latestOf(state, W, "pin-violation")!;
    expect(entry.title).toBe(
      "Pinned provider Together fails your policy: P95 640 ms exceeds 400 ms. Requests still go to Together.",
    );
    expect(entry.notify).toBe(true);
    expect(state.markets[W].activity.some((e) => e.kind === "route-switch" && e.at === E + 2_000)).toBe(false);

    const view = selectMarketView(state.markets[W]);
    expect(view.decision.kind).toBe("pinned-failing");
    expect(view.decision.actions).toEqual([
      { kind: "switch-to-recommended", providerId: "deepinfra", label: "Switch to DeepInfra" },
      { kind: "use-automatic", label: "Use automatic switching" },
    ]);
    expect(view.providersById.together.role).toBe("pinned-failing");
    expect(view.providers[0].id).toBe("together");

    const served = run(state, request(W, E + 3_000)).markets[W].requests[0];
    expect(served).toMatchObject({ status: "ok", providerId: "together", routingMode: "pinned" });
  });

  it("logs recovery when the pinned provider meets the policy again", () => {
    const state = run(
      pinned(),
      update(W, "together", { p95LatencyMs: 640 }, E + 2_000),
      update(W, "together", { p95LatencyMs: 210 }, E + 3_000),
    );
    expect(latest(state, W).title).toBe("Pinned provider Together meets your policy again");
    expect(selectMarketView(state.markets[W]).decision.kind).toBe("pinned");
  });

  it("reports a violation once, not on every tick", () => {
    let state = run(pinned(), update(W, "together", { p95LatencyMs: 640 }, E + 2_000));
    const count = () => state.markets[W].activity.filter((e) => e.kind === "pin-violation").length;
    expect(count()).toBe(1);
    state = run(state, { type: "monitor", now: E + 5_000 }, { type: "tick", now: E + 6_000 }, { type: "monitor", now: E + 10_000 });
    expect(count()).toBe(1);
  });

  it("fails requests to an unavailable pinned provider instead of rerouting", () => {
    let state = run(pinned(), update(W, "together", { available: false }, E + 2_000));
    expect(active(state, W)).toBe("together");
    state = run(state, request(W, E + 3_000), request(W, E + 4_000));
    for (const result of state.markets[W].requests.slice(0, 2)) {
      expect(result).toMatchObject({ status: "failed", providerId: "together", error: { code: 503, message: "Service Unavailable" } });
    }
    expect(state.markets[W].counters.failed).toBe(2);
    expect(latest(state, W).title).toMatch(/^req_\d{6} failed at Together$/);
  });

  it("switchToRecommended pins the rank-1 provider", () => {
    const state = run(
      pinned(),
      update(W, "together", { p95LatencyMs: 640 }, E + 2_000),
      { type: "switch-to-recommended", marketId: W, now: E + 3_000 },
    );
    expect(state.markets[W].policy.mode).toEqual({ kind: "pinned", providerId: "deepinfra" });
    expect(active(state, W)).toBe("deepinfra");
    expect(selectMarketView(state.markets[W]).decision.kind).toBe("pinned");
    expect(state.markets[W].route.pinViolation).toBeNull();
    expect(latestOf(state, W, "pin-recovered")).toBeUndefined();
    const entry = latestOf(state, W, "route-switch")!;
    expect(entry).toMatchObject({ fromProviderId: "together", toProviderId: "deepinfra", trigger: "operator-switch" });
  });

  it("returns to the recommended provider with automatic switching", () => {
    const state = run(
      pinned(),
      update(W, "together", { p95LatencyMs: 640 }, E + 2_000),
      { type: "set-routing-mode", marketId: W, mode: { kind: "auto" }, now: E + 3_000 },
    );
    expect(active(state, W)).toBe("deepinfra");
  });
});

describe("requests", () => {
  it("logs results, counters, spend, latency samples, chart, and activity", () => {
    const before = createInitialState();
    const state = run(before, request(B, E + 1_000));
    const market = state.markets[B];
    const result = market.requests[0];
    expect(result.status).toBe("ok");
    if (result.status !== "ok" || result.marketId !== "btc-usd") throw new Error("expected a served BTC result");
    expect(result.requestId).toBe("req_000003");
    expect(result.cost).toBeCloseTo(0.7 / 1e6, 12);
    expect(result.payload.changeUsd).not.toBeNull();
    expect(market.counters).toEqual({ total: 2, served: 2, failed: 0, rejected: 0 });
    expect(market.spend).toBeCloseTo(before.markets[B].spend + 0.7 / 1e6, 12);
    expect(market.providers.find((p) => p.id === "the-zone-bio")!.latencies.at(-1)!.requestId).toBe("req_000003");
    expect(market.series.at(-1)!.value).toBe(result.payload.priceUsd);
    expect(latest(state, B).title).toBe("req_000003 served by THE ZONE BIO");
  });

  it("keeps the last 50 requests", () => {
    let state = createInitialState();
    for (let i = 1; i <= 60; i += 1) state = reduce(state, request(W, E + i * 1_000));
    expect(state.markets[W].requests).toHaveLength(50);
    expect(state.markets[W].counters.total).toBe(61);
  });

  it("auto-run sends a request every 2 s on the clock tick", () => {
    let state = run(createInitialState(), { type: "set-auto-run", marketId: B, enabled: true, now: E + 1_000 });
    expect(state.markets[B].counters.total).toBe(2);
    state = run(state, { type: "tick", now: E + 2_000 }, { type: "tick", now: E + 3_000 });
    expect(state.markets[B].counters.total).toBe(3);
    state = run(state, { type: "tick", now: E + 4_000 }, { type: "tick", now: E + 5_000 });
    expect(state.markets[B].counters.total).toBe(4);
    state = run(state, { type: "set-auto-run", marketId: B, enabled: false, now: E + 5_500 }, { type: "tick", now: E + 7_000 });
    expect(state.markets[B].counters.total).toBe(4);
  });
});

describe("monitoring", () => {
  it("appends one sample per provider per monitor tick and keeps 30", () => {
    const state = run(createInitialState(), { type: "monitor", now: E + 5_000 });
    for (const provider of state.markets[W].providers) {
      expect(provider.history).toHaveLength(30);
      expect(provider.history.at(-1)!.at).toBe(E + 5_000);
    }
  });

  it("appends an exact sample right after a condition change", () => {
    const state = run(createInitialState(), update(W, "cloudflare", { p95LatencyMs: 350 }, E + 1_500));
    const last = state.markets[W].providers.find((p) => p.id === "cloudflare")!.history.at(-1)!;
    expect(last).toMatchObject({ at: E + 1_500, p95LatencyMs: 350 });
  });

  it("does not change state on a clock tick with nothing due", () => {
    const state = createInitialState();
    const next = reduce(state, { type: "tick", now: E + 1_000 });
    expect(next.markets).toBe(state.markets);
    expect(next.now).toBe(E + 1_000);
  });
});

describe("determinism", () => {
  const script: TenderAction[] = [
    request(W, E + 1_000),
    update(W, "together", { p95LatencyMs: 640 }, E + 2_000),
    { type: "monitor", now: E + 5_000 },
    request(B, E + 5_500),
    { type: "set-policy", marketId: B, patch: { preference: "freshest-data" }, now: E + 6_000 },
    { type: "set-auto-run", marketId: W, enabled: true, now: E + 6_500 },
    { type: "tick", now: E + 7_000 },
    { type: "tick", now: E + 8_000 },
    { type: "tick", now: E + 9_000 },
    update(W, "together", { p95LatencyMs: 210 }, E + 9_500),
    { type: "monitor", now: E + 10_000 },
    { type: "tick", now: E + 13_000 },
  ];

  it("produces identical state for the same action sequence", () => {
    const a = run(createInitialState(), ...script);
    const b = run(createInitialState(), ...script);
    expect(a).toEqual(b);
    expect(a.markets[W].requests.length).toBeGreaterThan(3);
  });

  it("never mutates the input state", () => {
    const start = createInitialState();
    const snapshot = structuredClone(start);
    run(start, ...script);
    expect(start).toEqual(snapshot);
  });
});

describe("rebase", () => {
  it("shifts every timestamp and keeps relative ages and values", () => {
    const state = run(createInitialState(), update(W, "together", { p95LatencyMs: 640 }, E + 1_000), update(W, "together", { p95LatencyMs: 210 }, E + 3_000));
    const delta = 7 * 86_400_000 + 123_456;
    const rebased = rebaseState(state, state.now + delta);
    expect(rebased.rebased).toBe(true);
    expect(rebased.now).toBe(state.now + delta);
    for (const id of [W, B]) {
      const a = state.markets[id];
      const b = rebased.markets[id];
      expect(b.route.since - rebased.now).toBe(a.route.since - state.now);
      expect(b.route.lastSwitchAt - rebased.now).toBe(a.route.lastSwitchAt - state.now);
      expect(b.activity.map((e) => e.at - rebased.now)).toEqual(a.activity.map((e) => e.at - state.now));
      expect(b.series.map((p) => p.value)).toEqual(a.series.map((p) => p.value));
      expect(b.series.map((p) => p.at - rebased.now)).toEqual(a.series.map((p) => p.at - state.now));
      expect(b.requests.map((r) => r.requestedAt - rebased.now)).toEqual(a.requests.map((r) => r.requestedAt - state.now));
      expect(b.providers[0].history.map((s) => s.at - rebased.now)).toEqual(a.providers[0].history.map((s) => s.at - state.now));
    }
    expect(rebased.markets[W].route.pending!.executeAt - rebased.now).toBe(state.markets[W].route.pending!.executeAt - state.now);
  });

  it("runs once through the reducer", () => {
    const once = reduce(createInitialState(), { type: "rebase", now: E + 60_000 });
    expect(reduce(once, { type: "rebase", now: E + 120_000 })).toBe(once);
  });

  it("keeps the signal continuous after rebasing", () => {
    const base = createInitialState();
    const a = run(base, request(B, E + 1_000));
    const b = run(reduce(base, { type: "rebase", now: E + 50_000 }), request(B, E + 51_000));
    const pa = a.markets[B].requests[0];
    const pb = b.markets[B].requests[0];
    if (pa.status !== "ok" || pb.status !== "ok") throw new Error("expected served results");
    expect(pb.payload).toEqual({
      ...pa.payload,
      ...("sourceTimestamp" in pa.payload ? { sourceTimestamp: pa.payload.sourceTimestamp + 50_000 } : {}),
    });
  });
});

describe("reset and restore", () => {
  it("reset conditions restores every provider and keeps the policy", () => {
    let state = run(
      createInitialState(),
      { type: "set-policy", marketId: W, patch: { maxPrice: 30 }, now: E + 500 },
      update(W, "together", { p95LatencyMs: 640 }, E + 1_000),
      update(W, "cloudflare", { bidPrice: 9 }, E + 1_500),
    );
    state = run(state, { type: "reset-conditions", marketId: W, now: E + 2_000 });
    for (const provider of state.markets[W].providers) {
      expect(provider.conditions).toEqual(MARKETS[W].providers.find((p) => p.id === provider.id)!.defaults);
    }
    expect(state.markets[W].policy.maxPrice).toBe(30);
    expect(latestOf(state, W, "conditions-reset")!.details).toEqual(["Restored Together and Cloudflare."]);
    expect(selectMarketView(state.markets[W]).conditionsModified).toBe(false);
  });

  it("restore provider restores one provider", () => {
    let state = run(createInitialState(), update(W, "together", { p95LatencyMs: 640 }, E + 1_000), update(W, "modal", { dataAgeMs: 60_000 }, E + 1_500));
    state = run(state, { type: "restore-provider", marketId: W, providerId: "modal", now: E + 2_000 });
    const byId = selectMarketView(state.markets[W]).providersById;
    expect(byId.modal.modified).toBe(false);
    expect(byId.together.modified).toBe(true);
    expect(byId.together.modifiedFields).toEqual(["p95LatencyMs"]);
    expect(latestOf(state, W, "provider-restored")!.title).toBe("Modal restored to default conditions");
  });

  it("reset policy restores the default policy and mode", () => {
    let state = run(
      createInitialState(),
      { type: "set-policy", marketId: B, patch: { maxPrice: 1, preference: "lowest-latency" }, now: E + 1_000 },
      { type: "set-routing-mode", marketId: B, mode: { kind: "pinned", providerId: "baseten" }, now: E + 2_000 },
    );
    expect(selectMarketView(state.markets[B]).policyModified).toBe(true);
    state = run(state, { type: "reset-policy", marketId: B, now: E + 3_000 });
    expect(state.markets[B].policy).toEqual(getDefaultPolicy(B));
    expect(active(state, B)).toBe("the-zone-bio");
    expect(selectMarketView(state.markets[B]).policyModified).toBe(false);
    expect(latestOf(state, B, "policy-reset")!.title).toBe("Routing policy reset to defaults");
  });

  it("ignores no-op edits", () => {
    const state = createInitialState();
    expect(reduce(state, update(W, "together", { bidPrice: 18 }, E + 1_000)).markets).toBe(state.markets);
    expect(reduce(state, { type: "reset-conditions", marketId: W, now: E + 1_000 }).markets).toBe(state.markets);
    expect(reduce(state, { type: "reset-policy", marketId: W, now: E + 1_000 }).markets).toBe(state.markets);
    expect(reduce(state, update(W, "unknown", { bidPrice: 1 }, E + 1_000)).markets).toBe(state.markets);
    expect(reduce(state, { type: "tick", now: E })).toBe(state);
  });

  it("clamps edits to the input ranges", () => {
    const state = run(createInitialState(), update(W, "together", { bidPrice: -5, errorRate: 3 }, E + 1_000));
    expect(state.markets[W].providers[0].conditions).toMatchObject({ bidPrice: 0.5, errorRate: 0.2 });
  });
});

describe("persistence", () => {
  it("serializes policies only", () => {
    const state = run(createInitialState(), { type: "set-policy", marketId: W, patch: { maxPrice: 25 }, now: E + 1_000 }, update(W, "together", { bidPrice: 10 }, E + 2_000));
    const parsed = JSON.parse(serializePolicies(state));
    expect(Object.keys(parsed)).toEqual(["version", "policies"]);
    expect(Object.keys(parsed.policies)).toEqual(["sf-weather", "btc-usd"]);
    expect(parsed.policies[W]).toEqual({ ...getDefaultPolicy(W), maxPrice: 25 });
    expect(JSON.stringify(parsed)).not.toContain("bidPrice");
    expect(POLICIES_STORAGE_KEY).toBe("tender:v1:policies");
  });

  it("parses stored policies defensively", () => {
    expect(parsePersistedPolicies(null)).toEqual({});
    expect(parsePersistedPolicies("not json")).toEqual({});
    expect(parsePersistedPolicies(JSON.stringify({ version: 2, policies: {} }))).toEqual({});
    const parsed = parsePersistedPolicies(
      JSON.stringify({
        version: 1,
        policies: {
          "sf-weather": { maxPrice: 25, preference: "nope", mode: { kind: "pinned", providerId: "together" } },
          "btc-usd": { mode: { kind: "pinned", providerId: "not-a-provider" } },
          other: {},
        },
      }),
    );
    expect(parsed[W]).toEqual({ ...getDefaultPolicy(W), maxPrice: 25, mode: { kind: "pinned", providerId: "together" } });
    expect(parsed[B]).toEqual(getDefaultPolicy(B));
  });

  it("round-trips through hydrate-policies and re-evaluates without notifying", () => {
    const edited = run(createInitialState(), { type: "set-policy", marketId: W, patch: { preference: "freshest-data" }, now: E + 1_000 });
    const stored = parsePersistedPolicies(serializePolicies(edited));
    const state = run(createInitialState(), { type: "hydrate-policies", policies: stored, now: E + 500 });
    expect(state.policiesHydrated).toBe(true);
    expect(state.markets[W].policy.preference).toBe("freshest-data");
    expect(active(state, W)).toBe("deepinfra");
    expect(latestOf(state, W, "policy-restored")!.title).toBe("Saved routing policy restored");
    expect(state.markets[W].activity.every((e) => !e.notify)).toBe(true);
    expect(reduce(state, { type: "hydrate-policies", policies: {}, now: E + 600 })).toBe(state);
  });
});
