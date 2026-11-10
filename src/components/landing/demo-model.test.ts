import { describe, expect, it } from "vitest";
import {
  CLOCK_TICK_MS,
  createInitialState,
  getProviderFixture,
  MARKETS,
  pendingSecondsRemaining,
  reduce,
  selectMarketView,
  SWITCH_COOLDOWN_MS,
  type ConditionsPatch,
  type PolicyPatch,
  type TenderAction,
  type TenderState,
} from "@/lib/tender";
import {
  createSceneState,
  HERO_PROVIDER_IDS,
  sceneReducer,
  selectScene,
  TABLE_PROVIDER_IDS,
  type SceneAction,
} from "./demo-model";

function tick(state: TenderState, seconds: number): TenderState {
  for (let second = 0; second < seconds; second += 1) state = sceneReducer(state, { type: "tick" });
  return state;
}

function runBtc(state: TenderState): TenderState {
  return reduce(state, { type: "run-request", marketId: "btc-usd", now: state.now });
}

function applyAndRun(state: TenderState, action: TenderAction): TenderState {
  return runBtc(reduce(state, action));
}

function fixture(providerId: string) {
  return getProviderFixture("btc-usd", providerId)!;
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
  return value;
}

describe("product-backed scene state", () => {
  it("uses the unmodified engine state plus one request for each market", () => {
    const initial = createInitialState();
    const btc = runBtc(initial);
    const expected = reduce(btc, { type: "run-request", marketId: "sf-weather", now: btc.now });
    const state = createSceneState();
    expect(state).toEqual(expected);
    for (const id of ["btc-usd", "sf-weather"] as const) {
      const market = state.markets[id];
      expect(market.route).toEqual(initial.markets[id].route);
      expect(market.policy).toEqual(MARKETS[id].defaultPolicy);
      expect(market.counters.total).toBe(initial.markets[id].counters.total + 1);
      expect(market.requests[0]).toMatchObject({ status: "ok", marketId: id, requestedAt: state.now });
    }
  });

  it("selects the real THE ZONE BIO route and retains its already elapsed cooldown", () => {
    const state = createSceneState();
    const view = selectScene(state);
    expect(view.route.activeProviderId).toBe("the-zone-bio");
    expect(view.route.pending).toBeNull();
    expect(state.now - view.route.lastSwitchAt).toBeGreaterThan(SWITCH_COOLDOWN_MS);
    expect(view.lastResult).toMatchObject({ status: "ok", providerId: "the-zone-bio" });
    expect(view).toBe(selectMarketView(state.markets["btc-usd"]));
  });

  it("exposes fixture identities, logos, conditions, and policy without replacements", () => {
    const view = selectScene(createSceneState());
    expect(view.definition).toBe(MARKETS["btc-usd"]);
    for (const identity of MARKETS["btc-usd"].providers) {
      const row = view.providersById[identity.id];
      expect(row).toMatchObject({ id: identity.id, name: identity.name, logo: identity.logo, conditions: identity.defaults });
    }
    expect(view.providersById.brindlewood.status).toBe("too-slow");
    expect(view.providersById.hollowbrook.status).toBe("stale-data");
  });

  it("supplies stable UI row ids without changing the engine's ordering", () => {
    expect(HERO_PROVIDER_IDS).toEqual(["the-zone-bio", "arca-labs", "brindlewood", "hollowbrook"]);
    expect(TABLE_PROVIDER_IDS).toEqual(["the-zone-bio", "arca-labs", "bramblecore", "brindlewood", "hollowbrook"]);
    const switched = sceneReducer(createSceneState(), { type: "latency" });
    const view = selectScene(switched);
    expect(view.providers[0].id).toBe("arca-labs");
    expect(TABLE_PROVIDER_IDS.map((id) => view.providersById[id].id)).toEqual(TABLE_PROVIDER_IDS);
  });
});

describe("failure and price scenes", () => {
  it.each([
    { type: "latency", patch: { p95LatencyMs: 180 }, status: "too-slow" },
    { type: "stale", patch: { dataAgeMs: 2_400 }, status: "stale-data" },
  ] as const)("resets then applies the real $type failure and runs the next request", ({ type, patch, status }) => {
    const prior = tick(sceneReducer(createSceneState(), { type: "policy", patch: { maxPrice: 0 } }), 4);
    const state = sceneReducer(prior, { type });
    const fresh = createSceneState();
    expect(state).toEqual(applyAndRun(fresh, {
      type: "update-provider", marketId: "btc-usd", providerId: "the-zone-bio", patch, now: fresh.now,
    }));
    const view = selectScene(state);
    expect(view.providersById["the-zone-bio"].status).toBe(status);
    expect(view.route).toMatchObject({ activeProviderId: "arca-labs", pending: null, lastSwitchAt: state.now });
    expect(view.lastResult).toMatchObject({ status: "ok", providerId: "arca-labs", requestedAt: state.now });
    expect(view.activity.find((entry) => entry.kind === "route-switch")).toMatchObject({ trigger: "failover" });
  });

  it("switches immediately on the initial lower-price offer without fabricating route history", () => {
    const fresh = createSceneState();
    const prior = tick(sceneReducer(fresh, { type: "latency" }), 3);
    const state = sceneReducer(prior, { type: "lower-price" });
    expect(state).toEqual(applyAndRun(fresh, {
      type: "update-provider", marketId: "btc-usd", providerId: "arca-labs", patch: { bidPrice: 0.65 }, now: fresh.now,
    }));
    const view = selectScene(state);
    expect(view.route).toMatchObject({ activeProviderId: "arca-labs", pending: null, lastSwitchAt: state.now });
    expect(view.providersById["the-zone-bio"].conditions).toEqual(fixture("the-zone-bio").defaults);
    expect(view.providersById["arca-labs"].conditions.bidPrice).toBe(0.65);
    expect(view.lastResult).toMatchObject({ status: "ok", providerId: "arca-labs", cost: 0.65 / 1e6 });
    expect(view.activity.find((entry) => entry.kind === "route-switch")).toMatchObject({ trigger: "optimization" });
  });

  it("keeps a genuine ten-second cooldown for a counter-offer made just after the switch", () => {
    const lower = sceneReducer(createSceneState(), { type: "lower-price" });
    const state = sceneReducer(lower, { type: "counter-offer" });
    expect(state).toEqual(applyAndRun(lower, {
      type: "update-provider", marketId: "btc-usd", providerId: "the-zone-bio", patch: { bidPrice: 0.6 }, now: lower.now,
    }));
    const view = selectScene(state);
    expect(view.route.activeProviderId).toBe("arca-labs");
    expect(view.route.pending).toMatchObject({ providerId: "the-zone-bio", scheduledAt: state.now, executeAt: state.now + SWITCH_COOLDOWN_MS });
    expect(pendingSecondsRemaining(view.route.pending!, state.now)).toBe(10);
    expect(view.lastResult).toMatchObject({ status: "ok", providerId: "arca-labs" });
  });

  it("uses only the real remaining cooldown for a later counter-offer", () => {
    const lower = tick(sceneReducer(createSceneState(), { type: "lower-price" }), 3);
    const state = sceneReducer(lower, { type: "counter-offer" });
    const view = selectScene(state);
    expect(state.now).toBe(lower.now);
    expect(pendingSecondsRemaining(view.route.pending!, state.now)).toBe(7);
    expect(view.route.lastSwitchAt).toBe(lower.markets["btc-usd"].route.lastSwitchAt);
  });

  it("switches on cooldown expiry and then runs exactly one request on the new route", () => {
    let state = sceneReducer(sceneReducer(createSceneState(), { type: "lower-price" }), { type: "counter-offer" });
    const start = state.now;
    const count = state.markets["btc-usd"].counters.total;
    const request = selectScene(state).lastResult;
    for (let second = 1; second < 10; second += 1) {
      state = sceneReducer(state, { type: "tick" });
      const view = selectScene(state);
      expect(state.now).toBe(start + second * CLOCK_TICK_MS);
      expect(view.route.activeProviderId).toBe("arca-labs");
      expect(pendingSecondsRemaining(view.route.pending!, state.now)).toBe(10 - second);
      expect(view.lastResult).toBe(request);
      expect(view.metrics.requests.total).toBe(count);
    }
    state = sceneReducer(state, { type: "tick" });
    const switched = selectScene(state);
    expect(switched.route).toMatchObject({ activeProviderId: "the-zone-bio", pending: null, lastSwitchAt: start + SWITCH_COOLDOWN_MS });
    expect(switched.metrics.requests.total).toBe(count + 1);
    expect(switched.lastResult).toMatchObject({ status: "ok", providerId: "the-zone-bio", requestedAt: state.now });
    expect(selectScene(tick(state, 5)).lastResult).toBe(switched.lastResult);
  });

  it("does not generate requests or change observations on idle ticks", () => {
    const state = createSceneState();
    const next = sceneReducer(state, { type: "tick" });
    expect(next).toEqual(reduce(state, { type: "tick", now: state.now + CLOCK_TICK_MS }));
    expect(next.markets).toBe(state.markets);
  });

  it("restores actual THE ZONE BIO defaults and lets the engine schedule the return", () => {
    const failed = sceneReducer(createSceneState(), { type: "latency" });
    const state = sceneReducer(failed, { type: "restore" });
    expect(state).toEqual(applyAndRun(failed, {
      type: "restore-provider", marketId: "btc-usd", providerId: "the-zone-bio", now: failed.now,
    }));
    const view = selectScene(state);
    expect(view.providersById["the-zone-bio"].conditions).toEqual(fixture("the-zone-bio").defaults);
    expect(view.route.activeProviderId).toBe("arca-labs");
    expect(view.route.pending?.providerId).toBe("the-zone-bio");
    expect(view.lastResult).toMatchObject({ status: "ok", providerId: "arca-labs" });
    expect(selectScene(tick(state, 10)).lastResult).toMatchObject({ status: "ok", providerId: "the-zone-bio" });
  });

  it("cancels the pending counter-offer when restore makes it more expensive", () => {
    const lower = sceneReducer(createSceneState(), { type: "lower-price" });
    const pending = sceneReducer(lower, { type: "counter-offer" });
    const state = sceneReducer(pending, { type: "restore" });
    expect(selectScene(state).route).toMatchObject({ activeProviderId: "arca-labs", pending: null });
    expect(selectScene(state).providersById["the-zone-bio"].conditions).toEqual(fixture("the-zone-bio").defaults);
    expect(selectScene(tick(state, 10)).route.activeProviderId).toBe("arca-labs");
  });

  it("reset cancels pending work and restores both complete market states", () => {
    const lower = sceneReducer(createSceneState(), { type: "lower-price" });
    const pending = tick(sceneReducer(lower, { type: "counter-offer" }), 4);
    const state = sceneReducer(pending, { type: "reset" });
    expect(state).toEqual(createSceneState());
    expect(selectScene(state).route).toMatchObject({ activeProviderId: "the-zone-bio", pending: null });
    expect(selectScene(tick(state, 12)).route.activeProviderId).toBe("the-zone-bio");
  });
});

describe("real policy, request, and validation behavior", () => {
  it("runs requests through the engine without changing time or the weather market", () => {
    const state = createSceneState();
    const next = sceneReducer(state, { type: "run" });
    expect(next).toEqual(runBtc(state));
    expect(next.now).toBe(state.now);
    expect(next.markets["sf-weather"]).toBe(state.markets["sf-weather"]);
    expect(selectScene(next).lastResult?.requestId).not.toBe(selectScene(state).lastResult?.requestId);
  });

  it("passes policy edits directly to the engine and immediately requests on the new route", () => {
    const state = tick(createSceneState(), 4);
    const patch = { maxP95LatencyMs: fixture("brindlewood").defaults.p95LatencyMs };
    const next = sceneReducer(state, { type: "policy", patch });
    expect(next).toEqual(applyAndRun(state, { type: "set-policy", marketId: "btc-usd", patch, now: state.now }));
    expect(selectScene(next).route).toMatchObject({ activeProviderId: "brindlewood", pending: null });
    expect(selectScene(next).lastResult).toMatchObject({ status: "ok", providerId: "brindlewood", requestedAt: state.now });
  });

  it("fails over immediately when the active provider fails during a pending switch", () => {
    const lower = sceneReducer(createSceneState(), { type: "lower-price" });
    const pending = sceneReducer(lower, { type: "counter-offer" });
    const state = sceneReducer(pending, { type: "provider", providerId: "arca-labs", patch: { available: false } });
    expect(selectScene(state).route).toMatchObject({ activeProviderId: "the-zone-bio", pending: null });
    expect(selectScene(state).lastResult).toMatchObject({ status: "ok", providerId: "the-zone-bio" });
  });

  it("preserves no-eligible and rejected results instead of returning an old success", () => {
    const lower = sceneReducer(createSceneState(), { type: "lower-price" });
    const pending = sceneReducer(lower, { type: "counter-offer" });
    const state = sceneReducer(pending, { type: "policy", patch: { maxPrice: 0 } });
    const view = selectScene(state);
    expect(view.route).toMatchObject({ activeProviderId: null, pending: null });
    expect(view.decision).toMatchObject({ kind: "no-eligible", title: "No eligible provider" });
    expect(view.lastResult).toMatchObject({ status: "rejected", providerId: null, reason: "No eligible provider", cost: 0 });
    expect(view.lastResult).not.toHaveProperty("payload");
    expect(view.lastServed?.status).toBe("ok");
    expect(view.lastResult).not.toBe(view.lastServed);
    const retried = sceneReducer(state, { type: "run" });
    expect(selectScene(retried).lastResult?.status).toBe("rejected");
    expect(retried.markets["btc-usd"].counters.served).toBe(state.markets["btc-usd"].counters.served);
  });

  it("preserves an actual failed result without promoting the last served result", () => {
    const initial = createSceneState();
    const pinned = reduce(initial, {
      type: "set-routing-mode", marketId: "btc-usd", mode: { kind: "pinned", providerId: "the-zone-bio" }, now: initial.now,
    });
    const state = sceneReducer(pinned, { type: "provider", providerId: "the-zone-bio", patch: { available: false } });
    const view = selectScene(state);
    expect(view.lastResult).toMatchObject({ status: "failed", providerId: "the-zone-bio", error: { code: 503 }, cost: 0 });
    expect(view.lastResult).not.toHaveProperty("payload");
    expect(view.lastResult).not.toBe(view.lastServed);
    expect(view.metrics.requests.served).toBe(initial.markets["btc-usd"].counters.served);
    expect(view.metrics.requests.failed).toBe(initial.markets["btc-usd"].counters.failed + 1);
  });

  it.each(["maxPrice", "maxP95LatencyMs", "maxDataAgeMs", "minSuccessRate"] as const)("uses the product's %s policy bounds", (key) => {
    const state = createSceneState();
    const spec = MARKETS["btc-usd"].policyInputs[key];
    for (const [value, bound] of [[-1_000_000, spec.min], [1_000_000, spec.max]]) {
      const patch = { [key]: value };
      const next = sceneReducer(state, { type: "policy", patch });
      expect(next).toEqual(applyAndRun(state, { type: "set-policy", marketId: "btc-usd", patch, now: state.now }));
      expect(selectScene(next).policy[key]).toBeCloseTo(bound * spec.factor);
    }
  });

  it.each(["bidPrice", "p95LatencyMs", "dataAgeMs", "errorRate"] as const)("uses the product's %s provider bounds", (key) => {
    const state = createSceneState();
    const spec = MARKETS["btc-usd"].conditionInputs[key];
    for (const [value, bound] of [[-1_000_000, spec.min], [1_000_000, spec.max]]) {
      const patch = { [key]: value };
      const next = sceneReducer(state, { type: "provider", providerId: "the-zone-bio", patch });
      expect(next).toEqual(applyAndRun(state, {
        type: "update-provider", marketId: "btc-usd", providerId: "the-zone-bio", patch, now: state.now,
      }));
      expect(selectScene(next).providersById["the-zone-bio"].conditions[key]).toBeCloseTo(bound * spec.factor);
    }
  });

  it("lets engine validation discard nonfinite and malformed field values", () => {
    const state = sceneReducer(sceneReducer(createSceneState(), { type: "lower-price" }), { type: "counter-offer" });
    const invalidPolicy = { maxPrice: Number.NaN, maxDataAgeMs: Number.POSITIVE_INFINITY, minSuccessRate: "99" } as unknown as PolicyPatch;
    const invalidConditions = { bidPrice: Number.NaN, p95LatencyMs: Number.NEGATIVE_INFINITY, available: "false" } as unknown as ConditionsPatch;
    expect(sceneReducer(state, { type: "policy", patch: invalidPolicy })).toEqual(runBtc(state));
    expect(sceneReducer(state, { type: "provider", providerId: "the-zone-bio", patch: invalidConditions })).toEqual(runBtc(state));
    expect(sceneReducer(state, { type: "provider", providerId: "unknown", patch: { bidPrice: 0.6 } })).toEqual(runBtc(state));
  });
});

describe("purity", () => {
  const actions: SceneAction[] = [
    { type: "latency" }, { type: "stale" }, { type: "lower-price" }, { type: "counter-offer" },
    { type: "tick" }, { type: "restore" }, { type: "run" }, { type: "reset" },
    { type: "policy", patch: { maxPrice: 0 } },
    { type: "provider", providerId: "the-zone-bio", patch: { available: false } },
  ];

  it("never mutates engine state inputs", () => {
    const state = freezeDeep(createSceneState());
    const before = structuredClone(state);
    for (const action of actions) {
      expect(() => sceneReducer(state, action)).not.toThrow();
      expect(state).toEqual(before);
    }
  });

  it("produces the same engine state and results for the same action sequence", () => {
    const sequence: SceneAction[] = [
      ...actions, { type: "lower-price" }, { type: "counter-offer" },
      ...Array.from({ length: 10 }, (): SceneAction => ({ type: "tick" })),
    ];
    expect(sequence.reduce(sceneReducer, createSceneState())).toEqual(sequence.reduce(sceneReducer, createSceneState()));
  });
});
