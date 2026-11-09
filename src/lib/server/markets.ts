import { getMarketDefinition, isMarketId, MARKET_IDS, selectRoute, type MarketDefinition, type MarketId, type RoutingPolicy } from "@/lib/tender";
import { ApiError } from "./http";
import { readPolicyOverrides } from "./policy";

export function marketSummary(market: MarketDefinition) {
  return { id: market.id, name: market.name, identifier: market.identifier, contract: market.contract,
    description: market.description, units: market.units, policy_defaults: market.defaultPolicy,
    provider_count: market.providers.length };
}
export function listMarkets() { return MARKET_IDS.map((id) => marketSummary(getMarketDefinition(id))); }
export function parseMarketId(value: string): MarketId {
  if (!isMarketId(value)) throw new ApiError(404, "market_not_found", "Unknown market");
  return value;
}
export function requestPolicy(request: Request, market: MarketDefinition): RoutingPolicy {
  const policy: RoutingPolicy = { ...market.defaultPolicy, ...readPolicyOverrides(request) };
  if (policy.mode.kind === "pinned") {
    const pinnedId = policy.mode.providerId;
    if (!market.providers.some((provider) => provider.id === pinnedId)) {
      throw new ApiError(400, "invalid_pin", "Pinned provider does not belong to this market");
    }
  }
  return policy;
}
export function marketDetail(request: Request, marketId: MarketId) {
  const market = getMarketDefinition(marketId);
  const policy = requestPolicy(request, market);
  const selection = selectRoute(marketId, { policy });
  const evaluation = selection.evaluation;
  const activeId = selection.providerId;
  const violations = selection.violations.map((r) => r.message);
  return { ...marketSummary(market), policy,
    providers: market.providers.map((provider) => ({ id: provider.id, name: provider.name, logo: provider.logo,
      bid_per_million: provider.defaults.bidPrice, p95_latency_ms: provider.defaults.p95LatencyMs,
      data_age_ms: provider.defaults.dataAgeMs, success_rate: 1 - provider.defaults.errorRate,
      available: provider.defaults.available, evaluation: evaluation.byId[provider.id] })),
    routing: { active_provider: activeId, recommended_provider: evaluation.recommendedId, ranking: evaluation.ranking,
      reason: policy.mode.kind === "pinned" ? "pinned" : activeId ? policy.preference : "no-eligible-provider",
      policy_violation: violations.length > 0, policy_violations: violations },
  };
}
