import {
  CLOCK_TICK_MS,
  createInitialState,
  reduce,
  selectMarketView,
  type ConditionsPatch,
  type MarketView,
  type PolicyPatch,
  type TenderState,
} from "@/lib/tender";

export type Metric = "price" | "latency" | "freshness" | "success";

export type SceneAction =
  | { type: "reset" | "latency" | "stale" | "lower-price" | "counter-offer" | "restore" | "tick" | "run" }
  | { type: "policy"; patch: PolicyPatch }
  | { type: "provider"; providerId: string; patch: ConditionsPatch };

export const HERO_PROVIDER_IDS = ["the-zone-bio", "arca-labs", "brindlewood", "hollowbrook"] as const;
export const TABLE_PROVIDER_IDS = ["the-zone-bio", "arca-labs", "bramblecore", "brindlewood", "hollowbrook"] as const;

function runBtc(state: TenderState): TenderState {
  return reduce(state, { type: "run-request", marketId: "btc-usd", now: state.now });
}

function updateProvider(state: TenderState, providerId: string, patch: ConditionsPatch): TenderState {
  return runBtc(reduce(state, { type: "update-provider", marketId: "btc-usd", providerId, patch, now: state.now }));
}

/** Use the product's fixtures, seeded requests, validation, and routing history unchanged. */
export function createSceneState(): TenderState {
  const state = runBtc(createInitialState());
  return reduce(state, { type: "run-request", marketId: "sf-weather", now: state.now });
}

export function sceneReducer(state: TenderState, action: SceneAction): TenderState {
  switch (action.type) {
    case "reset":
      return createSceneState();
    case "latency":
      return updateProvider(createSceneState(), "the-zone-bio", { p95LatencyMs: 180 });
    case "stale":
      return updateProvider(createSceneState(), "the-zone-bio", { dataAgeMs: 2_400 });
    case "lower-price":
      return updateProvider(createSceneState(), "arca-labs", { bidPrice: 0.65 });
    case "counter-offer":
      return updateProvider(state, "the-zone-bio", { bidPrice: 0.6 });
    case "restore":
      return runBtc(reduce(state, { type: "restore-provider", marketId: "btc-usd", providerId: "the-zone-bio", now: state.now }));
    case "tick": {
      const next = reduce(state, { type: "tick", now: state.now + CLOCK_TICK_MS });
      return next.markets["btc-usd"].route.activeProviderId !== state.markets["btc-usd"].route.activeProviderId
        ? runBtc(next)
        : next;
    }
    case "run":
      return runBtc(state);
    case "policy":
      return runBtc(reduce(state, { type: "set-policy", marketId: "btc-usd", patch: action.patch, now: state.now }));
    case "provider":
      return updateProvider(state, action.providerId, action.patch);
  }
}

export function selectScene(state: TenderState): MarketView {
  return selectMarketView(state.markets["btc-usd"]);
}
