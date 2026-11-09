import { describe, expect, it } from "vitest";
import {
  createProviders,
  demoReducer,
  INITIAL_POLICY,
  initialDemoState,
  LANDING_MARKETS,
  qualification,
  selectProvider,
  type DemoAction,
  type Policy,
  type Provider,
  type Qualification,
  type State,
} from "./demo-model";

function tick(state: State, seconds: number): State {
  for (let second = 0; second < seconds; second += 1) {
    state = demoReducer(state, { type: "tick" });
  }
  return state;
}

function provider(state: State, id: Provider["id"]): Provider {
  return state.providers.find((candidate) => candidate.id === id)!;
}

const invalidNumbers = [
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  -1,
];

const failures: { patch: Partial<Provider>; status: Qualification }[] = [
  { patch: { available: false }, status: "Unavailable" },
  { patch: { success: 99.49 }, status: "Unreliable" },
  { patch: { price: 0.5001 }, status: "Over budget" },
  { patch: { latency: 100.01 }, status: "Too slow" },
  { patch: { dataAge: 2_000.01 }, status: "Stale data" },
];

describe("landing fixtures", () => {
  it("uses the storyboard's prices, milliseconds, and percentage units", () => {
    expect(INITIAL_POLICY).toEqual({
      maxPrice: 0.5,
      maxLatency: 100,
      maxDataAge: 2_000,
      minSuccess: 99.5,
    });
    expect(createProviders()).toEqual([
      {
        id: "a",
        name: "Provider A",
        price: 0.4,
        latency: 48,
        dataAge: 160,
        success: 99.9,
        available: true,
      },
      {
        id: "b",
        name: "Provider B",
        price: 0.46,
        latency: 72,
        dataAge: 220,
        success: 99.9,
        available: true,
      },
      {
        id: "c",
        name: "Provider C",
        price: 0.28,
        latency: 140,
        dataAge: 300,
        success: 99.9,
        available: true,
      },
      {
        id: "d",
        name: "Provider D",
        price: 0.22,
        latency: 35,
        dataAge: 8_000,
        success: 99.9,
        available: true,
      },
    ]);
  });

  it("starts on A and excludes the cheaper slow and stale offers", () => {
    const state = initialDemoState();
    expect(state).toMatchObject({
      activeId: "a",
      pendingId: null,
      cooldown: 0,
      elapsed: 0,
      lastSwitchAt: 0,
    });
    expect(
      state.providers.map((candidate) =>
        qualification(candidate, state.policy),
      ),
    ).toEqual(["Eligible", "Eligible", "Too slow", "Stale data"]);
    expect(selectProvider(state.providers, state.policy)?.id).toBe("a");
  });

  it("creates independent mutable fixtures without mutating the exported policy", () => {
    const first = initialDemoState();
    const second = initialDemoState();
    first.policy.maxLatency = 1;
    first.providers[0].price = 10;
    expect(second.policy).toEqual(INITIAL_POLICY);
    expect(second.providers[0].price).toBe(0.4);
    expect(createProviders()[0].price).toBe(0.4);
    expect(Object.isFrozen(INITIAL_POLICY)).toBe(true);
  });

  it("exposes the SPEC result fixtures for both markets", () => {
    expect(Object.keys(LANDING_MARKETS).sort()).toEqual([
      "btc-usd",
      "sf-weather",
    ]);
    expect(LANDING_MARKETS["btc-usd"].resultValue).toBe("$75,230.75");
    expect(LANDING_MARKETS["sf-weather"]).toMatchObject({
      resultLabel: "San Francisco, CA",
      resultValue: "61°F",
    });
    expect(LANDING_MARKETS["sf-weather"].resultDetail).toContain("Overcast");
    expect(LANDING_MARKETS["sf-weather"].resultDetail).toContain("9 mph W");
    expect(LANDING_MARKETS["sf-weather"].resultDetail).toContain("1018 hPa");
  });
});

describe("qualification", () => {
  it.each([
    { price: 0.5 },
    { latency: 100 },
    { dataAge: 2_000 },
    { success: 99.5 },
  ])("accepts the exact policy boundary %j", (patch) => {
    expect(
      qualification({ ...createProviders()[0], ...patch }, INITIAL_POLICY),
    ).toBe("Eligible");
  });

  it("accepts every threshold at once", () => {
    expect(
      qualification(
        {
          ...createProviders()[0],
          price: 0.5,
          latency: 100,
          dataAge: 2_000,
          success: 99.5,
        },
        INITIAL_POLICY,
      ),
    ).toBe("Eligible");
  });

  it.each(failures)(
    "rejects $status immediately outside the threshold",
    ({ patch, status }) => {
      expect(
        qualification({ ...createProviders()[0], ...patch }, INITIAL_POLICY),
      ).toBe(status);
    },
  );

  it("uses unavailable, unreliable, budget, latency, then freshness priority", () => {
    let candidate: Provider = {
      ...createProviders()[0],
      available: false,
      success: 90,
      price: 1,
      latency: 180,
      dataAge: 8_000,
    };
    expect(qualification(candidate, INITIAL_POLICY)).toBe("Unavailable");
    candidate = { ...candidate, available: true };
    expect(qualification(candidate, INITIAL_POLICY)).toBe("Unreliable");
    candidate = { ...candidate, success: 99.9 };
    expect(qualification(candidate, INITIAL_POLICY)).toBe("Over budget");
    candidate = { ...candidate, price: 0.4 };
    expect(qualification(candidate, INITIAL_POLICY)).toBe("Too slow");
    candidate = { ...candidate, latency: 48 };
    expect(qualification(candidate, INITIAL_POLICY)).toBe("Stale data");
  });

  it.each([
    { key: "price", status: "Over budget" },
    { key: "latency", status: "Too slow" },
    { key: "dataAge", status: "Stale data" },
    { key: "success", status: "Unreliable" },
  ] as const)("fails closed for invalid provider $key", ({ key, status }) => {
    for (const value of [...invalidNumbers, "", "0", undefined, null]) {
      const candidate = { ...createProviders()[0], [key]: value } as Provider;
      expect(qualification(candidate, INITIAL_POLICY)).toBe(status);
      expect(selectProvider([candidate], INITIAL_POLICY)).toBeNull();
    }
  });

  it.each([
    { key: "maxPrice", status: "Over budget" },
    { key: "maxLatency", status: "Too slow" },
    { key: "maxDataAge", status: "Stale data" },
    { key: "minSuccess", status: "Unreliable" },
  ] as const)("fails closed for invalid policy $key", ({ key, status }) => {
    for (const value of [...invalidNumbers, "", "100", undefined, null]) {
      const policy = { ...INITIAL_POLICY, [key]: value } as Policy;
      expect(qualification(createProviders()[0], policy)).toBe(status);
      expect(selectProvider(createProviders(), policy)).toBeNull();
    }
  });

  it("rejects percentages above 100 and non-boolean availability", () => {
    const candidate = createProviders()[0];
    expect(
      qualification({ ...candidate, success: 100.01 }, INITIAL_POLICY),
    ).toBe("Unreliable");
    expect(
      qualification(candidate, { ...INITIAL_POLICY, minSuccess: 100.01 }),
    ).toBe("Unreliable");
    expect(
      qualification(
        { ...candidate, available: 1 as unknown as boolean },
        INITIAL_POLICY,
      ),
    ).toBe("Unavailable");
  });

  it("allows zero limits, zero measurements, and the 100% boundary", () => {
    const candidate = {
      ...createProviders()[0],
      price: 0,
      latency: 0,
      dataAge: 0,
      success: 100,
    };
    const policy = {
      maxPrice: 0,
      maxLatency: 0,
      maxDataAge: 0,
      minSuccess: 100,
    };
    expect(qualification(candidate, policy)).toBe("Eligible");
    expect(
      qualification({ ...candidate, success: 0 }, { ...policy, minSuccess: 0 }),
    ).toBe("Eligible");
  });
});

describe("selectProvider", () => {
  it("returns the cheapest eligible provider without sorting or changing the input", () => {
    const providers = createProviders();
    providers[2].latency = 100;
    const before = structuredClone(providers);
    expect(selectProvider(providers, INITIAL_POLICY)).toBe(providers[2]);
    expect(providers).toEqual(before);
  });

  it("breaks price ties by id independent of input order", () => {
    const [a, b] = createProviders();
    const tied = [{ ...b, price: a.price }, a];
    expect(selectProvider(tied, INITIAL_POLICY)?.id).toBe("a");
    expect(selectProvider([...tied].reverse(), INITIAL_POLICY)?.id).toBe("a");
  });

  it("returns null for empty offers or no eligible provider", () => {
    expect(selectProvider([], INITIAL_POLICY)).toBeNull();
    expect(
      selectProvider(createProviders(), { ...INITIAL_POLICY, maxPrice: 0 }),
    ).toBeNull();
  });
});

describe("immediate failover", () => {
  it("routes A to B as soon as A's P95 reaches 180 ms", () => {
    const state = demoReducer(initialDemoState(), { type: "latency" });
    expect(provider(state, "a").latency).toBe(180);
    expect(state).toMatchObject({
      activeId: "b",
      pendingId: null,
      cooldown: 0,
      elapsed: 0,
      lastSwitchAt: 0,
    });
    expect(state.event).toBe(
      "Provider A → Provider B. P95 latency exceeded the 100 ms limit.",
    );
  });

  it("routes A to B when A's data becomes stale, independently of latency", () => {
    const state = demoReducer(initialDemoState(), { type: "stale" });
    expect(provider(state, "a")).toMatchObject({ dataAge: 8_000, latency: 48 });
    expect(state.activeId).toBe("b");
    expect(state.event).toBe(
      "Provider A → Provider B. Data age exceeded the 2 s limit.",
    );
  });

  it.each(failures)(
    "bypasses a pending optimization when the active provider becomes $status",
    ({ patch }) => {
      const pending = tick(
        demoReducer(initialDemoState(), { type: "lower-price" }),
        3,
      );
      const state = demoReducer(pending, { type: "provider", id: "a", patch });
      expect(state).toMatchObject({
        activeId: "b",
        pendingId: null,
        cooldown: 0,
        elapsed: 3,
        lastSwitchAt: 3,
      });
      expect(qualification(provider(state, "b"), state.policy)).toBe(
        "Eligible",
      );
      expect(state.event).toContain("Provider A → Provider B.");
    },
  );

  it("does not switch when the active provider remains exactly at all limits", () => {
    const state = demoReducer(initialDemoState(), {
      type: "provider",
      id: "a",
      patch: { latency: 100, dataAge: 2_000, success: 99.5 },
    });
    expect(state).toMatchObject({
      activeId: "a",
      pendingId: null,
      cooldown: 0,
    });
  });
});

describe("optimization cooldown", () => {
  it("shows all ten seconds and switches on the tenth tick, not before", () => {
    let state = demoReducer(initialDemoState(), { type: "lower-price" });
    expect(provider(state, "b").price).toBe(0.34);
    expect(state).toMatchObject({
      activeId: "a",
      pendingId: "b",
      cooldown: 10,
      elapsed: 0,
      lastSwitchAt: 0,
    });
    for (let elapsed = 1; elapsed < 10; elapsed += 1) {
      state = demoReducer(state, { type: "tick" });
      expect(state).toMatchObject({
        activeId: "a",
        pendingId: "b",
        cooldown: 10 - elapsed,
        elapsed,
        lastSwitchAt: 0,
      });
    }
    state = demoReducer(state, { type: "tick" });
    expect(state).toMatchObject({
      activeId: "b",
      pendingId: null,
      cooldown: 0,
      elapsed: 10,
      lastSwitchAt: 10,
    });
    expect(state.event).toBe(
      "Provider A → Provider B. Lower price; all policy checks passed.",
    );
    expect(tick(state, 1)).toMatchObject({
      activeId: "b",
      pendingId: null,
      cooldown: 0,
      elapsed: 11,
      lastSwitchAt: 10,
      event: state.event,
    });
  });

  it("restarts only the lower-price story so it always has a full countdown", () => {
    let prior = tick(initialDemoState(), 17);
    prior = demoReducer(prior, { type: "policy", policy: { maxPrice: 0 } });
    prior = demoReducer(prior, {
      type: "provider",
      id: "a",
      patch: { available: false },
    });
    const state = demoReducer(prior, { type: "lower-price" });
    expect(state).toMatchObject({
      policy: INITIAL_POLICY,
      activeId: "a",
      pendingId: "b",
      cooldown: 10,
      elapsed: 0,
      lastSwitchAt: 0,
    });
    expect(state.providers).toEqual(
      createProviders().map((candidate) =>
        candidate.id === "b" ? { ...candidate, price: 0.34 } : candidate,
      ),
    );
  });

  it("keeps elapsed time for ordinary price edits and waits only the remaining time", () => {
    const state = demoReducer(tick(initialDemoState(), 7), {
      type: "provider",
      id: "b",
      patch: { price: 0.34 },
    });
    expect(state).toMatchObject({
      activeId: "a",
      pendingId: "b",
      cooldown: 3,
      elapsed: 7,
      lastSwitchAt: 0,
    });
    expect(tick(state, 2)).toMatchObject({ activeId: "a", cooldown: 1 });
    expect(tick(state, 3)).toMatchObject({
      activeId: "b",
      cooldown: 0,
      lastSwitchAt: 10,
    });
  });

  it("switches immediately for a cheaper offer after the actual cooldown has elapsed", () => {
    for (const seconds of [10, 14]) {
      const state = demoReducer(tick(initialDemoState(), seconds), {
        type: "provider",
        id: "b",
        patch: { price: 0.34 },
      });
      expect(state).toMatchObject({
        activeId: "b",
        pendingId: null,
        cooldown: 0,
        elapsed: seconds,
        lastSwitchAt: seconds,
      });
    }
  });

  it("measures the next cooldown from the last switch rather than from the first render", () => {
    const failed = demoReducer(tick(initialDemoState(), 6), {
      type: "latency",
    });
    expect(failed.lastSwitchAt).toBe(6);
    const recovered = demoReducer(failed, {
      type: "provider",
      id: "a",
      patch: { latency: 48 },
    });
    expect(recovered).toMatchObject({
      activeId: "b",
      pendingId: "a",
      cooldown: 10,
      elapsed: 6,
      lastSwitchAt: 6,
    });
    expect(tick(recovered, 9)).toMatchObject({ activeId: "b", cooldown: 1 });
    expect(tick(recovered, 10)).toMatchObject({
      activeId: "a",
      cooldown: 0,
      lastSwitchAt: 16,
    });
  });

  it.each([
    { id: "c", patch: { latency: 100 } },
    { id: "d", patch: { dataAge: 2_000 } },
  ] as const)(
    "applies the same cooldown when cheaper provider $id improves its conditions",
    ({ id, patch }) => {
      const state = demoReducer(initialDemoState(), {
        type: "provider",
        id,
        patch,
      });
      expect(state).toMatchObject({
        activeId: "a",
        pendingId: id,
        cooldown: 10,
      });
      expect(tick(state, 10)).toMatchObject({
        activeId: id,
        pendingId: null,
        cooldown: 0,
      });
    },
  );

  it("replaces the pending candidate without restarting the cooldown", () => {
    const pending = tick(
      demoReducer(initialDemoState(), { type: "lower-price" }),
      4,
    );
    const state = demoReducer(pending, {
      type: "provider",
      id: "c",
      patch: { latency: 100 },
    });
    expect(state).toMatchObject({
      activeId: "a",
      pendingId: "c",
      cooldown: 6,
      elapsed: 4,
      lastSwitchAt: 0,
    });
    expect(tick(state, 6).activeId).toBe("c");
  });

  it.each([
    { price: 0.4 },
    { price: 0.46 },
    { latency: 101 },
    { dataAge: 2_001 },
    { success: 99.49 },
    { available: false },
  ])(
    "cancels a pending switch when B stops qualifying or being cheaper: %j",
    (patch) => {
      const pending = tick(
        demoReducer(initialDemoState(), { type: "lower-price" }),
        4,
      );
      const state = demoReducer(pending, { type: "provider", id: "b", patch });
      expect(state).toMatchObject({
        activeId: "a",
        pendingId: null,
        cooldown: 0,
        lastSwitchAt: 0,
      });
      expect(state.event).toBe(
        "Pending switch canceled. Provider A remains active.",
      );
      expect(tick(state, 10)).toMatchObject({
        activeId: "a",
        pendingId: null,
        cooldown: 0,
      });
    },
  );

  it("cancels a pending switch when the active provider matches the cheaper bid", () => {
    const pending = demoReducer(initialDemoState(), { type: "lower-price" });
    const state = demoReducer(pending, {
      type: "provider",
      id: "a",
      patch: { price: 0.34 },
    });
    expect(state).toMatchObject({
      activeId: "a",
      pendingId: null,
      cooldown: 0,
    });
  });

  it("does not optimize to a same-price provider, even when its id sorts first", () => {
    const onB = demoReducer(initialDemoState(), { type: "latency" });
    const tied = demoReducer(onB, {
      type: "provider",
      id: "a",
      patch: { price: 0.46, latency: 48 },
    });
    expect(selectProvider(tied.providers, tied.policy)?.id).toBe("a");
    expect(tick(tied, 15)).toMatchObject({
      activeId: "b",
      pendingId: null,
      cooldown: 0,
    });
  });

  it("resumes the remaining cooldown if a canceled candidate becomes eligible again", () => {
    let state = tick(
      demoReducer(initialDemoState(), { type: "lower-price" }),
      3,
    );
    state = demoReducer(state, {
      type: "provider",
      id: "b",
      patch: { available: false },
    });
    state = tick(state, 2);
    state = demoReducer(state, {
      type: "provider",
      id: "b",
      patch: { available: true },
    });
    expect(state).toMatchObject({
      activeId: "a",
      pendingId: "b",
      cooldown: 5,
      elapsed: 5,
      lastSwitchAt: 0,
    });
  });
});

describe("policy changes and no eligible provider", () => {
  it("immediately selects a newly eligible cheaper provider after a partial policy edit", () => {
    const state = demoReducer(initialDemoState(), {
      type: "policy",
      policy: { maxLatency: 140 },
    });
    expect(state.policy).toEqual({ ...INITIAL_POLICY, maxLatency: 140 });
    expect(state).toMatchObject({
      activeId: "c",
      pendingId: null,
      cooldown: 0,
    });
    expect(state.event).toBe(
      "Provider A → Provider C. Routing policy updated.",
    );
  });

  it("uses all policy fields, including freshness and minimum success", () => {
    const fresh = demoReducer(initialDemoState(), {
      type: "policy",
      policy: { maxDataAge: 8_000 },
    });
    expect(fresh.activeId).toBe("d");
    const strict = demoReducer(fresh, {
      type: "policy",
      policy: { minSuccess: 100 },
    });
    expect(strict).toMatchObject({
      activeId: null,
      event: "No eligible provider",
    });
    const restored = demoReducer(strict, {
      type: "policy",
      policy: { minSuccess: 99.9 },
    });
    expect(restored).toMatchObject({
      activeId: "d",
      pendingId: null,
      cooldown: 0,
    });
  });

  it("policy edits bypass an existing optimization countdown even if A still qualifies", () => {
    const pending = tick(
      demoReducer(initialDemoState(), { type: "lower-price" }),
      3,
    );
    const state = demoReducer(pending, {
      type: "policy",
      policy: { maxDataAge: 1_999 },
    });
    expect(qualification(provider(state, "a"), state.policy)).toBe("Eligible");
    expect(state).toMatchObject({
      activeId: "b",
      pendingId: null,
      cooldown: 0,
      elapsed: 3,
      lastSwitchAt: 3,
    });
  });

  it("clears the route and pending switch rather than violating the budget", () => {
    const pending = tick(
      demoReducer(initialDemoState(), { type: "lower-price" }),
      3,
    );
    const state = demoReducer(pending, {
      type: "policy",
      policy: { maxPrice: 0.1 },
    });
    expect(state).toMatchObject({
      activeId: null,
      pendingId: null,
      cooldown: 0,
      event: "No eligible provider",
    });
    expect(selectProvider(state.providers, state.policy)).toBeNull();
    expect(tick(state, 10)).toMatchObject({
      activeId: null,
      pendingId: null,
      cooldown: 0,
      event: "No eligible provider",
    });
  });

  it("immediately resumes routing when an offer meets the policy again", () => {
    const unavailable = demoReducer(tick(initialDemoState(), 2), {
      type: "policy",
      policy: { maxPrice: 0.1 },
    });
    const state = demoReducer(tick(unavailable, 1), {
      type: "provider",
      id: "a",
      patch: { price: 0.1 },
    });
    expect(state).toMatchObject({
      activeId: "a",
      pendingId: null,
      cooldown: 0,
      elapsed: 3,
      lastSwitchAt: 3,
    });
    expect(state.event).toBe("Provider A selected. All policy checks passed.");
  });

  it("clears a pending switch if both eligible providers fail", () => {
    let state = demoReducer(initialDemoState(), { type: "lower-price" });
    state = demoReducer(state, {
      type: "provider",
      id: "b",
      patch: { available: false },
    });
    state = demoReducer(state, {
      type: "provider",
      id: "a",
      patch: { available: false },
    });
    expect(state).toMatchObject({
      activeId: null,
      pendingId: null,
      cooldown: 0,
      event: "No eligible provider",
    });
  });

  it("accepts valid zero policy inputs without silently falling back to defaults", () => {
    const state = demoReducer(initialDemoState(), {
      type: "policy",
      policy: { maxPrice: 0, maxLatency: 0, maxDataAge: 0, minSuccess: 0 },
    });
    expect(state.policy).toEqual({
      maxPrice: 0,
      maxLatency: 0,
      maxDataAge: 0,
      minSuccess: 0,
    });
    expect(state.activeId).toBeNull();
    const free = demoReducer(state, {
      type: "provider",
      id: "a",
      patch: { price: 0, latency: 0, dataAge: 0, success: 0 },
    });
    expect(free.activeId).toBe("a");
  });
});

describe("safe updates, reset, and determinism", () => {
  it.each(["maxPrice", "maxLatency", "maxDataAge", "minSuccess"] as const)(
    "ignores invalid %s edits without bypassing cooldown",
    (key) => {
      const state = tick(
        demoReducer(initialDemoState(), { type: "lower-price" }),
        4,
      );
      for (const value of [...invalidNumbers, "", "100", undefined, null]) {
        expect(
          demoReducer(state, {
            type: "policy",
            policy: { [key]: value } as Partial<Policy>,
          }),
        ).toBe(state);
      }
    },
  );

  it.each(["price", "latency", "dataAge", "success"] as const)(
    "ignores invalid provider %s edits without changing the clock",
    (key) => {
      const state = tick(
        demoReducer(initialDemoState(), { type: "lower-price" }),
        4,
      );
      for (const value of [...invalidNumbers, "", "100", undefined, null]) {
        expect(
          demoReducer(state, {
            type: "provider",
            id: "a",
            patch: { [key]: value } as Partial<Provider>,
          }),
        ).toBe(state);
      }
    },
  );

  it("ignores percentages above 100 and invalid availability", () => {
    const state = initialDemoState();
    expect(
      demoReducer(state, { type: "policy", policy: { minSuccess: 100.01 } }),
    ).toBe(state);
    expect(
      demoReducer(state, {
        type: "provider",
        id: "a",
        patch: { success: 100.01 },
      }),
    ).toBe(state);
    expect(
      demoReducer(state, {
        type: "provider",
        id: "a",
        patch: { available: 1 as unknown as boolean },
      }),
    ).toBe(state);
  });

  it("applies valid fields in a mixed patch but never changes provider identity", () => {
    const state = demoReducer(initialDemoState(), {
      type: "provider",
      id: "a",
      patch: {
        id: "d",
        name: "Changed",
        price: Number.NaN,
        latency: 180,
      } as Partial<Provider>,
    });
    expect(provider(state, "a")).toMatchObject({
      id: "a",
      name: "Provider A",
      price: 0.4,
      latency: 180,
    });
    expect(state.activeId).toBe("b");
    const updated = demoReducer(initialDemoState(), {
      type: "policy",
      policy: { maxLatency: 140, maxPrice: Number.NaN },
    });
    expect(updated.policy).toEqual({ ...INITIAL_POLICY, maxLatency: 140 });
    expect(updated.activeId).toBe("c");
  });

  it("treats missing, empty, unchanged, and unknown-provider edits as no-ops", () => {
    const state = demoReducer(initialDemoState(), { type: "lower-price" });
    const actions: DemoAction[] = [
      { type: "policy", policy: {} },
      { type: "policy", policy: { ...INITIAL_POLICY } },
      { type: "policy", policy: null as unknown as Partial<Policy> },
      { type: "provider", id: "a", patch: {} },
      { type: "provider", id: "a", patch: { latency: 48 } },
      {
        type: "provider",
        id: "a",
        patch: null as unknown as Partial<Provider>,
      },
      {
        type: "provider",
        id: "missing" as Provider["id"],
        patch: { latency: 180 },
      },
    ];
    for (const action of actions)
      expect(demoReducer(state, action)).toBe(state);
  });

  it("reset restores all fixtures, the default policy, the clock, and routing", () => {
    let state = tick(
      demoReducer(initialDemoState(), { type: "lower-price" }),
      12,
    );
    state = demoReducer(state, { type: "policy", policy: { maxPrice: 0 } });
    state = demoReducer(state, {
      type: "provider",
      id: "d",
      patch: { available: false },
    });
    const reset = demoReducer(state, { type: "reset" });
    expect(reset).toEqual(initialDemoState());
    expect(reset.providers).not.toBe(state.providers);
    expect(reset.policy).not.toBe(state.policy);
  });

  it("keeps events and provider observations unchanged on idle ticks", () => {
    const state = initialDemoState();
    expect(tick(state, 20)).toEqual({ ...state, elapsed: 20 });
    expect(tick(state, 20).providers).toBe(state.providers);
  });

  it("does not mutate any state input", () => {
    const state = initialDemoState();
    const before = structuredClone(state);
    for (const candidate of state.providers) Object.freeze(candidate);
    Object.freeze(state.providers);
    Object.freeze(state.policy);
    Object.freeze(state);
    const actions: DemoAction[] = [
      { type: "latency" },
      { type: "stale" },
      { type: "lower-price" },
      { type: "tick" },
      { type: "reset" },
      { type: "policy", policy: { maxLatency: 140 } },
      { type: "provider", id: "b", patch: { price: 0.34 } },
    ];
    for (const action of actions) {
      expect(() => demoReducer(state, action)).not.toThrow();
      expect(state).toEqual(before);
    }
  });

  it("produces identical results for identical action sequences", () => {
    const actions: DemoAction[] = [
      { type: "tick" },
      { type: "latency" },
      { type: "tick" },
      { type: "provider", id: "a", patch: { latency: 48 } },
      { type: "policy", policy: { maxDataAge: 8_000 } },
      { type: "lower-price" },
      ...Array.from({ length: 10 }, (): DemoAction => ({ type: "tick" })),
      { type: "stale" },
      { type: "provider", id: "b", patch: { success: 90 } },
    ];
    const first = actions.reduce(demoReducer, initialDemoState());
    const second = actions.reduce(demoReducer, initialDemoState());
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      activeId: null,
      pendingId: null,
      cooldown: 0,
      event: "No eligible provider",
    });
  });
});
