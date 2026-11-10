/**
 * Initial views for static previews and server components (no store needed).
 */
import { createInitialState } from "./engine";
import { getMarketSpec } from "@/lib/registry";
import { selectMarketView } from "./selectors";
import type { MarketId, MarketView, TenderState } from "./types";

let initial: TenderState | null = null;

/** The initial state at `FIXTURE_EPOCH` (built once, then shared). */
export function getInitialState(): TenderState {
  if (!initial) {
    const state = createInitialState();
    // Routing examples can use the deterministic engine. The console must not present
    // those samples as results from an upstream API.
    initial = {
      ...state,
      markets: Object.fromEntries(Object.entries(state.markets).map(([id, market]) => {
        if (getMarketSpec(id)?.source !== "upstream") return [id, market];
        return [id, {
          ...market,
          requests: [],
          activity: [],
          series: [],
          counters: { total: 0, served: 0, failed: 0, rejected: 0 },
          spend: 0,
          providers: market.providers.map((provider) => ({ ...provider, latencies: [] })),
          route: { ...market.route, since: state.now },
        }];
      })),
    };
  }
  return initial;
}

/** The market view the store renders before any interaction. */
export function getInitialMarketView(marketId: MarketId): MarketView {
  return selectMarketView(getInitialState().markets[marketId]);
}
