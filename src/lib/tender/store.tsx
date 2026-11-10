"use client";

/**
 * Client store for the Tender engine: a zustand store wrapping the pure
 * reducer, the `<TenderProvider>` that owns clocks/rebase/persistence, and hooks.
 */
import { createContext, useContext, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { CLOCK_TICK_MS, MONITOR_INTERVAL_MS, POLICIES_STORAGE_KEY } from "./constants";
import { reduce, type TenderAction } from "./engine";
import { MARKET_IDS } from "./markets";
import { getMarketSpec } from "@/lib/registry";
import { parsePersistedPolicies, policiesChanged, serializePolicies } from "./persistence";
import { getInitialState } from "./sample-state";
import { formatPendingSwitch, pendingSecondsRemaining, selectMarketView } from "./selectors";
import type {
  AgentBidUpdate,
  ConditionsPatch,
  MarketId,
  MarketView,
  PolicyPatch,
  ProviderId,
  RequestSource,
  RouteEvent,
  RouteEventKind,
  RoutingMode,
  ServedEnvelope,
  TenderState,
} from "./types";

/** Operator actions. Each one stamps `now` from the store clock. */
export interface TenderActions {
  runRequest(marketId: MarketId): void;
  setAutoRun(marketId: MarketId, enabled: boolean): void;
  setPolicy(marketId: MarketId, patch: PolicyPatch): void;
  setRoutingMode(marketId: MarketId, mode: RoutingMode): void;
  resetPolicy(marketId: MarketId): void;
  updateProvider(marketId: MarketId, providerId: ProviderId, patch: ConditionsPatch): void;
  restoreProvider(marketId: MarketId, providerId: ProviderId): void;
  /** Apply new bids from the providers' bidding agents (re-routes like a bid edit). */
  applyAgentBids(marketId: MarketId, bids: readonly AgentBidUpdate[], model: string): void;
  resetConditions(marketId: MarketId): void;
  /** Pinned: pin the rank-1 provider. Automatic: switch to rank 1 now (skips the cooldown). */
  switchToRecommended(marketId: MarketId): void;
  /** Record requests the server served and charged to credits, in each envelope's market. */
  ingestServed(source: RequestSource, envelopes: readonly ServedEnvelope[]): void;
}

export interface TenderStore {
  /** Underlying zustand store (state = `TenderState`). */
  api: StoreApi<TenderState>;
  /** Apply an action through the reducer. */
  dispatch(action: TenderAction): void;
  /** Stable action creators. */
  actions: TenderActions;
  /** Wall clock used for actions (default `Date.now`). Only called outside render. */
  clock: () => number;
  /**
   * Mark a market as in view (ref-counted). Watched markets and markets on auto-run get the 5 s
   * monitor; others stay idle and catch up when watched again. Returns the release function.
   */
  watch(marketId: MarketId): () => void;
  /** Markets currently in view. */
  watchedMarketIds(): MarketId[];
}

export interface CreateTenderStoreOptions {
  initialState?: TenderState;
  /** Wall clock (default `Date.now`). */
  clock?: () => number;
}

/** Create a store. `<TenderProvider>` does this once; use directly in tests. */
export function createTenderStore(options: CreateTenderStoreOptions = {}): TenderStore {
  // The default initial state is immutable and shared (built once per process).
  const api = createStore<TenderState>()(() => options.initialState ?? getInitialState());
  const clock = options.clock ?? (() => Date.now());
  const dispatch = (action: TenderAction) => {
    const current = api.getState();
    const next = reduce(current, action);
    if (next !== current) api.setState(next, true);
  };
  const act = (build: (now: number) => TenderAction) => {
    const now = clock();
    // Actions before the mount rebase would mix fixture time and wall time.
    if (!api.getState().rebased) dispatch({ type: "rebase", now });
    dispatch(build(now));
  };
  const watchers = new Map<MarketId, number>();
  const watch = (marketId: MarketId) => {
    const count = watchers.get(marketId) ?? 0;
    watchers.set(marketId, count + 1);
    if (count === 0 && api.getState().markets[marketId]) act((now) => ({ type: "wake", marketId, now }));
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const left = (watchers.get(marketId) ?? 1) - 1;
      if (left > 0) watchers.set(marketId, left);
      else watchers.delete(marketId);
    };
  };
  const actions: TenderActions = {
    runRequest: (marketId) => {
      if (getMarketSpec(marketId)?.source !== "upstream") act((now) => ({ type: "run-request", marketId, now }));
    },
    setAutoRun: (marketId, enabled) => {
      if (getMarketSpec(marketId)?.source !== "upstream") act((now) => ({ type: "set-auto-run", marketId, enabled, now }));
    },
    setPolicy: (marketId, patch) => act((now) => ({ type: "set-policy", marketId, patch, now })),
    setRoutingMode: (marketId, mode) => act((now) => ({ type: "set-routing-mode", marketId, mode, now })),
    resetPolicy: (marketId) => act((now) => ({ type: "reset-policy", marketId, now })),
    updateProvider: (marketId, providerId, patch) =>
      act((now) => ({ type: "update-provider", marketId, providerId, patch, now })),
    restoreProvider: (marketId, providerId) => act((now) => ({ type: "restore-provider", marketId, providerId, now })),
    applyAgentBids: (marketId, bids, model) =>
      act((now) => ({ type: "apply-agent-bids", marketId, bids, model, now })),
    resetConditions: (marketId) => act((now) => ({ type: "reset-conditions", marketId, now })),
    switchToRecommended: (marketId) => act((now) => ({ type: "switch-to-recommended", marketId, now })),
    ingestServed: (source, envelopes) => act((now) => ({ type: "ingest-served", source, envelopes, now })),
  };
  return { api, dispatch, actions, clock, watch, watchedMarketIds: () => [...watchers.keys()] };
}

function readStoredPolicies(): string | null {
  try {
    return window.localStorage.getItem(POLICIES_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredPolicies(value: string) {
  try {
    window.localStorage.setItem(POLICIES_STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable (private mode, quota); policies stay in memory.
  }
}

/**
 * Start the store's runtime: rebase to the wall clock, rehydrate policies,
 * persist policy changes, run the clock and monitor ticks, and execute pending
 * switches on time. Returns a cleanup function. Called by `<TenderProvider>`.
 */
export function startTenderRuntime(store: TenderStore): () => void {
  const { api, dispatch, clock, watchedMarketIds } = store;
  dispatch({ type: "rebase", now: clock() });
  dispatch({ type: "hydrate-policies", policies: parsePersistedPolicies(readStoredPolicies()), now: clock() });

  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingAt: number | null = null;
  const schedulePending = (state: TenderState) => {
    let next: number | null = null;
    for (const id of MARKET_IDS) {
      const pending = state.markets[id]?.route.pending;
      if (pending && (next === null || pending.executeAt < next)) next = pending.executeAt;
    }
    if (next === pendingAt) return;
    pendingAt = next;
    clearTimeout(pendingTimer);
    if (next !== null) {
      pendingTimer = setTimeout(() => {
        pendingAt = null;
        dispatch({ type: "tick", now: clock() });
      }, Math.max(0, next - clock()));
    }
  };
  schedulePending(api.getState());

  const unsubscribe = api.subscribe((state, prev) => {
    if (policiesChanged(state, prev)) writeStoredPolicies(serializePolicies(state));
    if (state.markets !== prev.markets) schedulePending(state);
  });
  const clockTimer = setInterval(() => dispatch({ type: "tick", now: clock() }), CLOCK_TICK_MS);
  // Only markets in view (and markets on auto-run) are sampled, so 75 markets stay cheap.
  const monitorTimer = setInterval(() => dispatch({ type: "monitor", now: clock(), marketIds: watchedMarketIds() }), MONITOR_INTERVAL_MS);

  return () => {
    unsubscribe();
    clearInterval(clockTimer);
    clearInterval(monitorTimer);
    clearTimeout(pendingTimer);
  };
}

const TenderStoreContext = createContext<TenderStore | null>(null);

export interface TenderProviderProps {
  children: ReactNode;
  /** Optional pre-built store (tests, previews). */
  store?: TenderStore;
}

/**
 * Mount once in the root layout. Owns the store, the 1 s clock, the 5 s
 * monitor, rebase after mount, policy persistence, and auto-run.
 */
export function TenderProvider({ children, store: provided }: TenderProviderProps) {
  const [store] = useState(() => provided ?? createTenderStore());
  useEffect(() => startTenderRuntime(store), [store]);
  return <TenderStoreContext value={store}>{children}</TenderStoreContext>;
}

/** The store from context. Throws outside `<TenderProvider>`. */
export function useTenderStore(): TenderStore {
  const store = useContext(TenderStoreContext);
  if (!store) throw new Error("useTenderStore must be used inside <TenderProvider>.");
  return store;
}

/**
 * Select from the raw state. The selector must return a stable value
 * (a state slice or a primitive), not a new object on every call.
 */
export function useTenderSelector<T>(selector: (state: TenderState) => T): T {
  return useStore(useTenderStore().api, selector);
}

/**
 * Keep a market in view while the component is mounted: the monitor samples it every 5 s.
 * `useMarketView` does this for you.
 */
export function useWatchMarket(marketId: MarketId): void {
  const store = useTenderStore();
  useEffect(() => store.watch(marketId), [store, marketId]);
}

/**
 * Derived view of a market. Re-renders only when that market's state changes
 * (not on clock ticks). The same state yields the same object. Watches the market.
 */
export function useMarketView(marketId: MarketId): MarketView {
  useWatchMarket(marketId);
  const market = useTenderSelector((state) => state.markets[marketId]);
  return selectMarketView(market);
}

/** Store clock (ms). Re-renders every second. */
export function useNow(): number {
  return useTenderSelector((state) => state.now);
}

/** Stable operator actions. */
export function useTenderActions(): TenderActions {
  return useTenderStore().actions;
}

/** Market ids in display order. */
export function useMarketIds(): readonly MarketId[] {
  return MARKET_IDS;
}

/** Countdown for the market's pending switch, or `null`. Re-renders every second while pending. */
export function usePendingSwitch(
  marketId: MarketId,
): { providerId: ProviderId; providerName: string; executeAt: number; secondsRemaining: number; label: string } | null {
  const pending = useMarketView(marketId).route.pending;
  const now = useNow();
  if (!pending) return null;
  return {
    providerId: pending.providerId,
    providerName: pending.providerName,
    executeAt: pending.executeAt,
    secondsRemaining: pendingSecondsRemaining(pending, now),
    label: formatPendingSwitch(pending, now),
  };
}

const ROUTE_EVENT_KINDS: readonly RouteEventKind[] = ["route-switch", "no-eligible", "pin-violation"];
const isRouteEvent = (entry: { kind: string; notify: boolean }): entry is RouteEvent =>
  entry.notify && (ROUTE_EVENT_KINDS as readonly string[]).includes(entry.kind);

/**
 * Call `onEvent` once for every new route switch, no-eligible, or pinned
 * violation in the market (for toasts). Events that exist at subscribe time,
 * and entries written while restoring saved policies, are not reported.
 */
export function useRouteEvents(marketId: MarketId, onEvent: (event: RouteEvent) => void): void {
  const store = useTenderStore();
  const handle = useEffectEvent(onEvent);
  useEffect(() => {
    let lastSeq = store.api.getState().nextActivitySeq - 1;
    return store.api.subscribe((state, prev) => {
      const market = state.markets[marketId];
      if (!market || market === prev.markets[marketId]) {
        lastSeq = state.nextActivitySeq - 1;
        return;
      }
      const fresh: RouteEvent[] = [];
      for (const entry of market.activity) {
        if (entry.seq <= lastSeq) break;
        if (isRouteEvent(entry)) fresh.push(entry);
      }
      lastSeq = state.nextActivitySeq - 1;
      for (const event of fresh.reverse()) handle(event);
    });
  }, [store, marketId]);
}
