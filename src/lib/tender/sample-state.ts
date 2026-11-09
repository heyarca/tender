/**
 * Initial views for static previews and server components (no store needed).
 */
import { createInitialState } from "./engine";
import { selectMarketView } from "./selectors";
import type { MarketId, MarketView, TenderState } from "./types";

let initial: TenderState | null = null;

/** The initial state at `FIXTURE_EPOCH` (built once, then shared). */
export function getInitialState(): TenderState {
  initial ??= createInitialState();
  return initial;
}

/** The market view the store renders before any interaction. */
export function getInitialMarketView(marketId: MarketId): MarketView {
  return selectMarketView(getInitialState().markets[marketId]);
}
