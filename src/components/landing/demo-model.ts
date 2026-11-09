// Illustrative landing-page fixtures. This model does not execute requests or use the product store.
export type LandingMarket = "btc-usd" | "sf-weather";
export type Metric = "price" | "latency" | "freshness" | "success";

export type Provider = {
  id: "a" | "b" | "c" | "d";
  name: string;
  /** USD per 1,000 requests. */
  price: number;
  /** P95 latency in milliseconds. */
  latency: number;
  /** Observation age in milliseconds, independent of request latency. */
  dataAge: number;
  /** Success rate as a percentage, not a fraction. */
  success: number;
  available: boolean;
};

export type Policy = {
  maxPrice: number;
  maxLatency: number;
  maxDataAge: number;
  minSuccess: number;
};

export type Qualification =
  | "Eligible"
  | "Too slow"
  | "Stale data"
  | "Over budget"
  | "Unreliable"
  | "Unavailable";

export type State = {
  providers: Provider[];
  policy: Policy;
  activeId: Provider["id"] | null;
  pendingId: Provider["id"] | null;
  /** Seconds until a pending optimization; zero when no switch is pending. */
  cooldown: number;
  event: string;
  /** Logical seconds, advanced only by tick actions. */
  elapsed: number;
  lastSwitchAt: number;
};

export type DemoAction =
  | { type: "latency" }
  | { type: "stale" }
  | { type: "lower-price" }
  | { type: "reset" }
  | { type: "tick" }
  | { type: "policy"; policy: Partial<Policy> }
  | {
      type: "provider";
      id: Provider["id"];
      patch: Partial<Omit<Provider, "id" | "name">>;
    };

export const INITIAL_POLICY: Readonly<Policy> = Object.freeze({
  maxPrice: 0.5,
  maxLatency: 100,
  maxDataAge: 2_000,
  minSuccess: 99.5,
});

// Normalized result fixtures from docs/SPEC.md, not current market observations.
export const LANDING_MARKETS = {
  "btc-usd": {
    name: "Bitcoin price",
    description: "BTC/USD spot price through one normalized contract.",
    resultLabel: "BTC/USD spot mid price",
    resultValue: "$75,230.75",
    resultDetail: "Volume-weighted across major USD venues.",
  },
  "sf-weather": {
    name: "San Francisco weather",
    description: "San Francisco conditions through one normalized contract.",
    resultLabel: "San Francisco, CA",
    resultValue: "61°F",
    resultDetail: "Overcast · Wind 9 mph W · Pressure 1018 hPa",
  },
} as const satisfies Record<
  LandingMarket,
  {
    name: string;
    description: string;
    resultLabel: string;
    resultValue: string;
    resultDetail: string;
  }
>;

const SWITCH_COOLDOWN_SECONDS = 10;

export function createProviders(): Provider[] {
  return [
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
  ];
}

function isNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPercentage(value: unknown): value is number {
  return isNonNegative(value) && value <= 100;
}

export function qualification(
  provider: Provider,
  policy: Policy,
): Qualification {
  // Preserve the product's first-failure priority and fail closed on invalid metrics.
  if (provider.available !== true) return "Unavailable";
  if (
    !isPercentage(provider.success) ||
    !isPercentage(policy.minSuccess) ||
    provider.success < policy.minSuccess
  ) {
    return "Unreliable";
  }
  if (
    !isNonNegative(provider.price) ||
    !isNonNegative(policy.maxPrice) ||
    provider.price > policy.maxPrice
  ) {
    return "Over budget";
  }
  if (
    !isNonNegative(provider.latency) ||
    !isNonNegative(policy.maxLatency) ||
    provider.latency > policy.maxLatency
  ) {
    return "Too slow";
  }
  if (
    !isNonNegative(provider.dataAge) ||
    !isNonNegative(policy.maxDataAge) ||
    provider.dataAge > policy.maxDataAge
  ) {
    return "Stale data";
  }
  return "Eligible";
}

export function selectProvider(
  providers: readonly Provider[],
  policy: Policy,
): Provider | null {
  let selected: Provider | null = null;
  for (const provider of providers) {
    if (qualification(provider, policy) !== "Eligible") continue;
    // Provider ids make ties stable even if the table order changes.
    if (
      !selected ||
      provider.price < selected.price ||
      (provider.price === selected.price && provider.id < selected.id)
    ) {
      selected = provider;
    }
  }
  return selected;
}

export function initialDemoState(): State {
  return {
    providers: createProviders(),
    policy: { ...INITIAL_POLICY },
    activeId: "a",
    pendingId: null,
    cooldown: 0,
    event: "Provider A selected. Lowest price within your policy.",
    elapsed: 0,
    lastSwitchAt: 0,
  };
}

function failureReason(status: Qualification, policy: Policy): string {
  switch (status) {
    case "Too slow":
      return `P95 latency exceeded the ${policy.maxLatency} ms limit.`;
    case "Stale data": {
      const limit =
        policy.maxDataAge >= 1_000
          ? `${policy.maxDataAge / 1_000} s`
          : `${policy.maxDataAge} ms`;
      return `Data age exceeded the ${limit} limit.`;
    }
    case "Over budget":
      return `Price exceeded the $${policy.maxPrice.toFixed(2)} /1K limit.`;
    case "Unreliable":
      return `Success rate fell below ${policy.minSuccess}%.`;
    case "Unavailable":
      return "The active provider became unavailable.";
    case "Eligible":
      return "All policy checks passed.";
  }
}

function switchTo(
  state: State,
  current: Provider | undefined,
  next: Provider,
  reason: string,
): State {
  return {
    ...state,
    activeId: next.id,
    pendingId: null,
    cooldown: 0,
    lastSwitchAt: state.elapsed,
    event: current
      ? `${current.name} → ${next.name}. ${reason}`
      : `${next.name} selected. ${reason}`,
  };
}

function reconcile(
  state: State,
  trigger: "conditions" | "policy" | "tick",
): State {
  const next = selectProvider(state.providers, state.policy);
  if (!next) {
    return {
      ...state,
      activeId: null,
      pendingId: null,
      cooldown: 0,
      lastSwitchAt:
        state.activeId === null ? state.lastSwitchAt : state.elapsed,
      event: "No eligible provider",
    };
  }

  const current = state.providers.find(
    (provider) => provider.id === state.activeId,
  );
  const currentStatus = current
    ? qualification(current, state.policy)
    : "Unavailable";
  // Failure and recovery never wait for an optimization cooldown.
  if (!current || currentStatus !== "Eligible") {
    const reason =
      trigger === "policy"
        ? "Routing policy updated."
        : current
          ? failureReason(currentStatus, state.policy)
          : "All policy checks passed.";
    return switchTo(state, current, next, reason);
  }

  // Operator policy edits are immediate, even when the current route still qualifies.
  if (trigger === "policy") {
    if (next.id !== current.id)
      return switchTo(state, current, next, "Routing policy updated.");
    return {
      ...state,
      pendingId: null,
      cooldown: 0,
      event: `Routing policy updated. ${current.name} remains active.`,
    };
  }

  if (next.id !== current.id && next.price < current.price) {
    const cooldown = Math.max(
      0,
      SWITCH_COOLDOWN_SECONDS - (state.elapsed - state.lastSwitchAt),
    );
    if (cooldown === 0) {
      return switchTo(
        state,
        current,
        next,
        "Lower price; all policy checks passed.",
      );
    }
    return {
      ...state,
      pendingId: next.id,
      cooldown,
      event: `${next.name} is cheaper and eligible. Switching in ${cooldown} s.`,
    };
  }

  return {
    ...state,
    pendingId: null,
    cooldown: 0,
    event: state.pendingId
      ? `Pending switch canceled. ${current.name} remains active.`
      : trigger === "conditions"
        ? `${current.name} remains active. All policy checks passed.`
        : state.event,
  };
}

function updatePolicy(state: State, patch: Partial<Policy>): State {
  if (!patch || typeof patch !== "object") return state;
  const previous = state.policy;
  const policy: Policy = {
    maxPrice: isNonNegative(patch.maxPrice)
      ? patch.maxPrice
      : previous.maxPrice,
    maxLatency: isNonNegative(patch.maxLatency)
      ? patch.maxLatency
      : previous.maxLatency,
    maxDataAge: isNonNegative(patch.maxDataAge)
      ? patch.maxDataAge
      : previous.maxDataAge,
    minSuccess: isPercentage(patch.minSuccess)
      ? patch.minSuccess
      : previous.minSuccess,
  };
  if (
    policy.maxPrice === previous.maxPrice &&
    policy.maxLatency === previous.maxLatency &&
    policy.maxDataAge === previous.maxDataAge &&
    policy.minSuccess === previous.minSuccess
  )
    return state;
  return reconcile({ ...state, policy }, "policy");
}

function updateProvider(
  state: State,
  id: Provider["id"],
  patch: Partial<Omit<Provider, "id" | "name">>,
): State {
  if (!patch || typeof patch !== "object") return state;
  let changed = false;
  const providers = state.providers.map((provider) => {
    if (provider.id !== id) return provider;
    const updated: Provider = {
      ...provider,
      price: isNonNegative(patch.price) ? patch.price : provider.price,
      latency: isNonNegative(patch.latency) ? patch.latency : provider.latency,
      dataAge: isNonNegative(patch.dataAge) ? patch.dataAge : provider.dataAge,
      success: isPercentage(patch.success) ? patch.success : provider.success,
      available:
        typeof patch.available === "boolean"
          ? patch.available
          : provider.available,
    };
    if (
      updated.price === provider.price &&
      updated.latency === provider.latency &&
      updated.dataAge === provider.dataAge &&
      updated.success === provider.success &&
      updated.available === provider.available
    )
      return provider;
    changed = true;
    return updated;
  });
  return changed ? reconcile({ ...state, providers }, "conditions") : state;
}

export function demoReducer(state: State, action: DemoAction): State {
  switch (action.type) {
    case "reset":
      return initialDemoState();
    case "latency":
      return updateProvider(state, "a", { latency: 180 });
    case "stale":
      return updateProvider(state, "a", { dataAge: 8_000 });
    case "lower-price":
      // This story always starts with the full countdown; ordinary edits keep the actual clock.
      return updateProvider(initialDemoState(), "b", { price: 0.34 });
    case "tick":
      return reconcile({ ...state, elapsed: state.elapsed + 1 }, "tick");
    case "policy":
      return updatePolicy(state, action.policy);
    case "provider":
      return updateProvider(state, action.id, action.patch);
  }
}
