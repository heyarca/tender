/**
 * Pure engine: `createInitialState()` and `reduce(state, action)`.
 * Every action carries `now` so the reducer never reads the clock.
 */
import {
  autoRunEntry,
  conditionsEntry,
  conditionsResetEntry,
  failureText,
  modeChangedEntry,
  policyChangeText,
  policyResetEntry,
  policyRestoredEntry,
  policyUpdatedEntry,
  providerName,
  providerRestoredEntry,
  routeEstablishedEntry,
} from "./activity";
import { AUTO_RUN_INTERVAL_MS, CLOCK_TICK_MS, FIXTURE_EPOCH, SERIES_SEED_POINTS } from "./constants";
import { pushActivity, type StepContext } from "./context";
import { evaluateProvider } from "./evaluate";
import { getDefaultPolicy, getProviderFixture, MARKET_IDS, MARKETS } from "./fixtures";
import { appendSample, exactSample, monitorMarket, seedHistory } from "./monitor";
import { createRng } from "./random";
import { btcProviderPrice, runRequest, weatherPayload } from "./requests";
import { evaluateMarketState, isPendingDue, reconcileRoute, type ReconcileCause } from "./router";
import { sanitizeConditionsPatch, sanitizePolicy, sanitizePolicyPatch } from "./sanitize";
import type {
  ConditionChange,
  ConditionsPatch,
  MarketId,
  MarketState,
  PolicyChange,
  PolicyPatch,
  ProviderConditions,
  ProviderId,
  RequestResult,
  RoutingMode,
  RoutingPolicy,
  SeriesPoint,
  TenderState,
} from "./types";

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Every state transition. `now` is the wall-clock time of the action (ms). */
export type TenderAction =
  /** Shift every timestamp so the store clock equals `now` (once, after mount). */
  | { type: "rebase"; now: number }
  /** 1 s clock tick: advances `now`, executes due pending switches and auto-run. */
  | { type: "tick"; now: number }
  /** 5 s monitor tick: one sample per provider, then re-evaluate. */
  | { type: "monitor"; now: number }
  | { type: "run-request"; marketId: MarketId; now: number }
  | { type: "set-auto-run"; marketId: MarketId; enabled: boolean; now: number }
  | { type: "set-policy"; marketId: MarketId; patch: PolicyPatch; now: number }
  | { type: "set-routing-mode"; marketId: MarketId; mode: RoutingMode; now: number }
  | { type: "reset-policy"; marketId: MarketId; now: number }
  | { type: "update-provider"; marketId: MarketId; providerId: ProviderId; patch: ConditionsPatch; now: number }
  | { type: "restore-provider"; marketId: MarketId; providerId: ProviderId; now: number }
  | { type: "reset-conditions"; marketId: MarketId; now: number }
  /** Pinned: pin the rank-1 provider. Automatic: switch to rank 1 now (skips the cooldown). */
  | { type: "switch-to-recommended"; marketId: MarketId; now: number }
  /** Apply persisted policies (once, after mount). Unknown/invalid entries are ignored. */
  | { type: "hydrate-policies"; policies: Partial<Record<MarketId, unknown>>; now: number };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/** How long the initial route has been active at the epoch. */
const INITIAL_ROUTE_AGE_MS = 47 * 60_000;
const SEEDS: Record<MarketId, number> = {
  "sf-weather": 0x5f3759df,
  "ny-weather": 0x2545f491,
  "london-weather": 0x27d4eb2f,
  "seoul-weather": 0x165667b1,
  "tokyo-weather": 0x85ebca6b,
  "singapore-weather": 0xc2b2ae35,
  "btc-usd": 0x1b873593,
  "eth-usd": 0x9e3779b9,
  "sol-usd": 0x7f4a7c15,
  "xrp-usd": 0x6a09e667,
  "eur-usd": 0xbb67ae85,
  "gbp-usd": 0x3c6ef372, "sz-mlcc": 0x2c1b3c6d, "lithium-carbonate": 0x297a2d39, "freight-sha-lax": 0x6b43a9b5,
};
const SERIES_STEP_MS: Record<MarketId, number> = {
  "sf-weather": 60_000,
  "ny-weather": 60_000,
  "london-weather": 60_000,
  "seoul-weather": 60_000,
  "tokyo-weather": 60_000,
  "singapore-weather": 60_000,
  "btc-usd": 3_000,
  "eth-usd": 3_000,
  "sol-usd": 3_000,
  "xrp-usd": 3_000,
  "eur-usd": 3_000,
  "gbp-usd": 3_000, "sz-mlcc": 60_000, "lithium-carbonate": 60_000, "freight-sha-lax": 60_000,
};

export interface InitialStateOptions {
  /** Start time (default `FIXTURE_EPOCH`). */
  epoch?: number;
  /** Extra seed mixed into every market PRNG (default 0). */
  seed?: number;
}

function seedSeries(marketId: MarketId, providerId: ProviderId | null, conditions: ProviderConditions | null, end: number, origin: number): SeriesPoint[] {
  const bias = providerId ? (getProviderFixture(marketId, providerId)?.bias ?? 0) : 0;
  const age = conditions?.dataAgeMs ?? 0;
  const step = SERIES_STEP_MS[marketId];
  return Array.from({ length: SERIES_SEED_POINTS }, (_, index) => {
    const at = end - (SERIES_SEED_POINTS - index) * step;
    const value =
      MARKETS[marketId].units.dataAge === "ms"
        ? btcProviderPrice(at - age, origin, bias, undefined, undefined, marketId)
        : weatherPayload(at - age, origin, bias, undefined, undefined, marketId).temperatureF;
    return { at, value, providerId, requestId: null };
  });
}

function createMarketState(marketId: MarketId, epoch: number, seed: number, ctx: StepContext): MarketState {
  const definition = MARKETS[marketId];
  const rng = createRng((SEEDS[marketId] ^ seed) >>> 0);
  const providers = definition.providers.map((fixture) => ({
    id: fixture.id,
    conditions: { ...fixture.defaults },
    history: seedHistory(rng, fixture.defaults, epoch - 2_000),
    latencies: [],
  }));
  const since = epoch - INITIAL_ROUTE_AGE_MS;
  let market: MarketState = {
    id: marketId,
    policy: getDefaultPolicy(marketId),
    providers,
    route: { activeProviderId: null, since, lastSwitchAt: since, pending: null, pinViolation: null },
    requests: [],
    counters: { total: 0, served: 0, failed: 0, rejected: 0 },
    spend: 0,
    activity: [],
    series: [],
    autoRun: false,
    nextAutoRunAt: null,
    signalOrigin: epoch,
    rng: rng.state,
  };
  const evaluation = evaluateMarketState(market);
  const activeId = evaluation.recommendedId;
  const active = activeId ? providers.find((p) => p.id === activeId)!.conditions : null;
  market = {
    ...market,
    route: { ...market.route, activeProviderId: activeId },
    series: seedSeries(marketId, activeId, active, epoch - 6_000, epoch),
  };
  if (activeId && active) {
    market = pushActivity(ctx, market, { ...routeEstablishedEntry(marketId, activeId, active, market.policy), at: since });
  }
  // One served request just before the epoch so the result card is never empty.
  const requestCtx: StepContext = { ...ctx, now: epoch - 4_000 };
  market = runRequest(market, requestCtx);
  ctx.activitySeq = requestCtx.activitySeq;
  ctx.requestSeq = requestCtx.requestSeq;
  return market;
}

/** Initial state built from fixtures at `FIXTURE_EPOCH` (identical on server and client). */
export function createInitialState(options: InitialStateOptions = {}): TenderState {
  const epoch = options.epoch ?? FIXTURE_EPOCH;
  const seed = options.seed ?? 0;
  const ctx: StepContext = { now: epoch, activitySeq: 1, requestSeq: 1, notify: false };
  const markets = {} as Record<MarketId, MarketState>;
  for (const marketId of MARKET_IDS) markets[marketId] = createMarketState(marketId, epoch, seed, ctx);
  return {
    now: epoch,
    markets,
    nextActivitySeq: ctx.activitySeq,
    nextRequestSeq: ctx.requestSeq,
    rebased: false,
    policiesHydrated: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contextOf(state: TenderState, now: number, notify = true): StepContext {
  return { now, activitySeq: state.nextActivitySeq, requestSeq: state.nextRequestSeq, notify };
}

function commit(state: TenderState, ctx: StepContext, markets: Partial<Record<MarketId, MarketState>>): TenderState {
  let changed = false;
  const nextMarkets = { ...state.markets };
  for (const id of MARKET_IDS) {
    const market = markets[id];
    if (market && market !== state.markets[id]) {
      nextMarkets[id] = market;
      changed = true;
    }
  }
  const now = Math.max(state.now, ctx.now);
  if (!changed && now === state.now) return state;
  return {
    ...state,
    now,
    markets: changed ? nextMarkets : state.markets,
    nextActivitySeq: ctx.activitySeq,
    nextRequestSeq: ctx.requestSeq,
  };
}

function updateMarket(
  state: TenderState,
  marketId: MarketId,
  now: number,
  fn: (market: MarketState, ctx: StepContext) => MarketState,
): TenderState {
  const market = state.markets[marketId];
  if (!market) return state;
  const ctx = contextOf(state, now);
  return commit(state, ctx, { [marketId]: fn(market, ctx) });
}

function setConditions(market: MarketState, providerId: ProviderId, conditions: ProviderConditions, now: number): MarketState {
  return {
    ...market,
    providers: market.providers.map((p) =>
      p.id === providerId ? appendSample({ ...p, conditions }, exactSample(conditions, now)) : p,
    ),
  };
}

const CONDITION_FIELDS: (keyof ProviderConditions)[] = ["bidPrice", "p95LatencyMs", "dataAgeMs", "errorRate", "available"];
const POLICY_FIELDS: (keyof Omit<RoutingPolicy, "mode">)[] = [
  "maxPrice",
  "maxP95LatencyMs",
  "maxDataAgeMs",
  "minSuccessRate",
  "preference",
];

function diffConditions(before: ProviderConditions, after: ProviderConditions): ConditionChange[] {
  return CONDITION_FIELDS.filter((f) => before[f] !== after[f]).map((field) => ({ field, from: before[field], to: after[field] }));
}

function diffPolicy(before: RoutingPolicy, after: RoutingPolicy): PolicyChange[] {
  return POLICY_FIELDS.filter((f) => before[f] !== after[f]).map((field) => ({ field, from: before[field], to: after[field] }));
}

const sameMode = (a: RoutingMode, b: RoutingMode) =>
  a.kind === b.kind && (a.kind === "auto" || (b.kind === "pinned" && a.providerId === b.providerId));

function statusOf(market: MarketState, providerId: ProviderId) {
  const provider = market.providers.find((p) => p.id === providerId)!;
  return evaluateProvider(providerId, provider.conditions, market.policy).status;
}

const operator = (trigger: Extract<ReconcileCause, { kind: "operator" }>["trigger"], text: string): ReconcileCause => ({
  kind: "operator",
  trigger,
  text,
});

// ---------------------------------------------------------------------------
// Market actions
// ---------------------------------------------------------------------------

function updateProvider(market: MarketState, ctx: StepContext, providerId: ProviderId, patch: ConditionsPatch): MarketState {
  const provider = market.providers.find((p) => p.id === providerId);
  if (!provider) return market;
  const clean = sanitizeConditionsPatch(market.id, patch);
  const next = { ...provider.conditions, ...clean };
  const changes = diffConditions(provider.conditions, next);
  if (!changes.length) return market;
  const before = statusOf(market, providerId);
  let updated = setConditions(market, providerId, next, ctx.now);
  updated = pushActivity(ctx, updated, conditionsEntry(market.id, providerId, changes, before, statusOf(updated, providerId)));
  return reconcileRoute(updated, ctx, { kind: "conditions" });
}

function restoreProvider(market: MarketState, ctx: StepContext, providerId: ProviderId): MarketState {
  const provider = market.providers.find((p) => p.id === providerId);
  const fixture = getProviderFixture(market.id, providerId);
  if (!provider || !fixture) return market;
  const changes = diffConditions(provider.conditions, fixture.defaults);
  if (!changes.length) return market;
  let updated = setConditions(market, providerId, { ...fixture.defaults }, ctx.now);
  updated = pushActivity(ctx, updated, providerRestoredEntry(market.id, providerId, changes));
  return reconcileRoute(updated, ctx, { kind: "conditions" });
}

function resetConditions(market: MarketState, ctx: StepContext): MarketState {
  const restored: ProviderId[] = [];
  let updated = market;
  for (const provider of market.providers) {
    const fixture = getProviderFixture(market.id, provider.id);
    if (!fixture || !diffConditions(provider.conditions, fixture.defaults).length) continue;
    restored.push(provider.id);
    updated = setConditions(updated, provider.id, { ...fixture.defaults }, ctx.now);
  }
  if (!restored.length) return market;
  updated = pushActivity(ctx, updated, conditionsResetEntry(restored, market.id));
  return reconcileRoute(updated, ctx, { kind: "conditions" });
}

function setPolicy(market: MarketState, ctx: StepContext, patch: PolicyPatch): MarketState {
  const next = { ...market.policy, ...sanitizePolicyPatch(market.id, patch) };
  const changes = diffPolicy(market.policy, next);
  if (!changes.length) return market;
  const updated = pushActivity(ctx, { ...market, policy: next }, policyUpdatedEntry(market.id, changes));
  return reconcileRoute(
    updated,
    ctx,
    operator("policy-change", `Policy changed: ${changes.map((change) => policyChangeText(market.id, change)).join("; ")}`),
  );
}

function setRoutingMode(market: MarketState, ctx: StepContext, mode: RoutingMode): MarketState {
  if (mode.kind === "pinned" && !market.providers.some((p) => p.id === mode.providerId)) return market;
  if (sameMode(market.policy.mode, mode)) return market;
  const nextMode: RoutingMode = mode.kind === "auto" ? { kind: "auto" } : { kind: "pinned", providerId: mode.providerId };
  const updated = pushActivity(ctx, { ...market, policy: { ...market.policy, mode: nextMode } }, modeChangedEntry(market.id, nextMode));
  const text =
    nextMode.kind === "auto" ? "Automatic switching turned on" : `Operator pinned ${providerName(market.id, nextMode.providerId)}`;
  return reconcileRoute(updated, ctx, operator("mode-change", text));
}

function resetPolicy(market: MarketState, ctx: StepContext): MarketState {
  const defaults = getDefaultPolicy(market.id);
  const changes = diffPolicy(market.policy, defaults);
  const modeReset = !sameMode(market.policy.mode, defaults.mode);
  if (!changes.length && !modeReset) return market;
  const updated = pushActivity(ctx, { ...market, policy: defaults }, policyResetEntry(market.id, changes, modeReset));
  return reconcileRoute(updated, ctx, operator("policy-change", "Routing policy reset to defaults"));
}

function switchToRecommended(market: MarketState, ctx: StepContext): MarketState {
  const evaluation = evaluateMarketState(market);
  const recommendedId = evaluation.recommendedId;
  if (!recommendedId) return market;
  const mode = market.policy.mode;
  if (mode.kind === "pinned") {
    if (mode.providerId === recommendedId) return market;
    const pinned = evaluation.byId[mode.providerId];
    const nextMode: RoutingMode = { kind: "pinned", providerId: recommendedId };
    const updated = pushActivity(ctx, { ...market, policy: { ...market.policy, mode: nextMode } }, modeChangedEntry(market.id, nextMode));
    const because = pinned && !pinned.qualifies ? `${providerName(market.id, mode.providerId)} ${failureText(pinned.reasons)}. ` : "";
    return reconcileRoute(
      updated,
      ctx,
      operator("operator-switch", `${because}Operator pinned ${providerName(market.id, recommendedId)}, the top-ranked provider`),
    );
  }
  if (market.route.activeProviderId === recommendedId) return market;
  return reconcileRoute(
    market,
    ctx,
    operator("operator-switch", `Operator switched to ${providerName(market.id, recommendedId)} without waiting for the cooldown`),
  );
}

function setAutoRun(market: MarketState, ctx: StepContext, enabled: boolean): MarketState {
  if (market.autoRun === enabled) return market;
  let updated = pushActivity(
    ctx,
    { ...market, autoRun: enabled, nextAutoRunAt: enabled ? ctx.now + AUTO_RUN_INTERVAL_MS : null },
    autoRunEntry(enabled),
  );
  if (enabled) updated = runRequest(updated, ctx);
  return updated;
}

function hydrateMarket(market: MarketState, ctx: StepContext, raw: unknown): MarketState {
  const policy = sanitizePolicy(market.id, raw);
  if (!policy) return market;
  if (!diffPolicy(market.policy, policy).length && sameMode(market.policy.mode, policy.mode)) return market;
  const updated = pushActivity(ctx, { ...market, policy }, policyRestoredEntry());
  return reconcileRoute(updated, ctx, operator("restored", "Saved routing policy restored"));
}

// ---------------------------------------------------------------------------
// Rebase
// ---------------------------------------------------------------------------

function shiftMarket(market: MarketState, delta: number): MarketState {
  const route = market.route;
  return {
    ...market,
    signalOrigin: market.signalOrigin + delta,
    nextAutoRunAt: market.nextAutoRunAt === null ? null : market.nextAutoRunAt + delta,
    route: {
      ...route,
      since: route.since + delta,
      lastSwitchAt: route.lastSwitchAt + delta,
      pending: route.pending
        ? { ...route.pending, executeAt: route.pending.executeAt + delta, scheduledAt: route.pending.scheduledAt + delta }
        : null,
    },
    providers: market.providers.map((p) => ({
      ...p,
      history: p.history.map((s) => ({ ...s, at: s.at + delta })),
      latencies: p.latencies.map((s) => ({ ...s, at: s.at + delta })),
    })),
    requests: market.requests.map((r): RequestResult => {
      if (r.status !== "ok") return { ...r, requestedAt: r.requestedAt + delta };
      if (r.payload.kind === "weather") {
        return { ...r, requestedAt: r.requestedAt + delta, payload: { ...r.payload, observedAt: r.payload.observedAt + delta } } as RequestResult;
      }
      return {
        ...r,
        requestedAt: r.requestedAt + delta,
        payload: { ...r.payload, sourceTimestamp: r.payload.sourceTimestamp + delta },
      } as RequestResult;
    }),
    activity: market.activity.map((entry) =>
      entry.kind === "switch-scheduled"
        ? { ...entry, at: entry.at + delta, executeAt: entry.executeAt + delta }
        : { ...entry, at: entry.at + delta },
    ),
    series: market.series.map((point) => ({ ...point, at: point.at + delta })),
  };
}

/** Shift every timestamp by `now − state.now` (relative ages are preserved). */
export function rebaseState(state: TenderState, now: number): TenderState {
  const delta = now - state.now;
  const markets = {} as Record<MarketId, MarketState>;
  for (const id of MARKET_IDS) markets[id] = delta === 0 ? state.markets[id] : shiftMarket(state.markets[id], delta);
  return { ...state, now, markets, rebased: true };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function tick(state: TenderState, now: number): TenderState {
  const ctx = contextOf(state, now);
  const markets: Partial<Record<MarketId, MarketState>> = {};
  for (const id of MARKET_IDS) {
    let market = state.markets[id];
    if (isPendingDue(market, now)) market = reconcileRoute(market, ctx, { kind: "tick" });
    // Half-tick tolerance so timer jitter never skips a beat.
    if (market.autoRun && market.nextAutoRunAt !== null && now >= market.nextAutoRunAt - CLOCK_TICK_MS / 2) {
      const scheduled = market.nextAutoRunAt + AUTO_RUN_INTERVAL_MS;
      market = runRequest(market, ctx);
      market = { ...market, nextAutoRunAt: scheduled > now ? scheduled : now + AUTO_RUN_INTERVAL_MS };
    }
    markets[id] = market;
  }
  return commit(state, ctx, markets);
}

function monitor(state: TenderState, now: number): TenderState {
  const ctx = contextOf(state, now);
  const markets: Partial<Record<MarketId, MarketState>> = {};
  for (const id of MARKET_IDS) {
    const market = state.markets[id];
    const rng = createRng(market.rng);
    const sampled = monitorMarket(market, rng, now);
    markets[id] = reconcileRoute({ ...sampled, rng: rng.state }, ctx, { kind: "monitor" });
  }
  return commit(state, ctx, markets);
}

/** Pure reducer. Returns the same object when an action changes nothing. */
export function reduce(state: TenderState, action: TenderAction): TenderState {
  switch (action.type) {
    case "rebase":
      return state.rebased ? state : rebaseState(state, action.now);
    case "tick":
      return tick(state, action.now);
    case "monitor":
      return monitor(state, action.now);
    case "run-request":
      return updateMarket(state, action.marketId, action.now, (m, ctx) => runRequest(m, ctx));
    case "set-auto-run":
      return updateMarket(state, action.marketId, action.now, (m, ctx) => setAutoRun(m, ctx, action.enabled));
    case "set-policy":
      return updateMarket(state, action.marketId, action.now, (m, ctx) => setPolicy(m, ctx, action.patch));
    case "set-routing-mode":
      return updateMarket(state, action.marketId, action.now, (m, ctx) => setRoutingMode(m, ctx, action.mode));
    case "reset-policy":
      return updateMarket(state, action.marketId, action.now, (m, ctx) => resetPolicy(m, ctx));
    case "update-provider":
      return updateMarket(state, action.marketId, action.now, (m, ctx) => updateProvider(m, ctx, action.providerId, action.patch));
    case "restore-provider":
      return updateMarket(state, action.marketId, action.now, (m, ctx) => restoreProvider(m, ctx, action.providerId));
    case "reset-conditions":
      return updateMarket(state, action.marketId, action.now, (m, ctx) => resetConditions(m, ctx));
    case "switch-to-recommended":
      return updateMarket(state, action.marketId, action.now, (m, ctx) => switchToRecommended(m, ctx));
    case "hydrate-policies": {
      if (state.policiesHydrated) return state;
      const ctx = contextOf(state, action.now, false);
      const markets: Partial<Record<MarketId, MarketState>> = {};
      for (const id of MARKET_IDS) {
        if (action.policies[id] !== undefined) markets[id] = hydrateMarket(state.markets[id], ctx, action.policies[id]);
      }
      return { ...commit(state, ctx, markets), policiesHydrated: true };
    }
  }
}
