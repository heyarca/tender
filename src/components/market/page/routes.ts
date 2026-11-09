import type { MarketId } from "@/lib/tender";

/** URL of a market page. */
export function marketHref(marketId: MarketId): string {
  return `/markets/${marketId}`;
}
