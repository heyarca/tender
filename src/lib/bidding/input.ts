/**
 * Build the body of a bidding round from a market's client state (pure; no React).
 */
import { servingProviderId, type MarketState } from "@/lib/tender";
import { RECENT_REQUEST_LIMIT, type BiddingRoundInput } from "./types";

export function buildRoundInput(market: MarketState): BiddingRoundInput {
  const served = market.requests.filter((r) => r.status === "ok").slice(0, RECENT_REQUEST_LIMIT);
  const wins = new Map<string, number>();
  for (const result of served) wins.set(result.providerId, (wins.get(result.providerId) ?? 0) + 1);
  const { mode, ...limits } = market.policy;
  return {
    marketId: market.id,
    policy: { ...limits, mode },
    activeProviderId: servingProviderId(market),
    recentRequests: served.length,
    recentWinners: served.map((r) => r.providerId),
    providers: market.providers.map((p) => ({
      providerId: p.id,
      bid: p.conditions.bidPrice,
      p95LatencyMs: p.conditions.p95LatencyMs,
      dataAgeMs: p.conditions.dataAgeMs,
      errorRate: p.conditions.errorRate,
      available: p.conditions.available,
      wins: wins.get(p.id) ?? 0,
    })),
  };
}
