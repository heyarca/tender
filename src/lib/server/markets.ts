import {
  CATEGORIES,
  CONTRACTS,
  contractPath,
  contractUrl,
  getCategory,
  getGroup,
  getMarketSpec,
  GROUPS,
  MARKET_SPECS,
  type ContractSpec,
} from "@/lib/registry";
import { getMarketDefinition, isMarketId, MARKET_IDS, selectRoute, type MarketDefinition, type MarketId, type RoutingPolicy } from "@/lib/tender";
import { ApiError } from "./http";
import { outputSchema } from "./openapi-schema";
import { readPolicyOverrides } from "./policy";

/** Discovery entry of a market: identity, taxonomy, contract binding, defaults. */
export function marketSummary(market: MarketDefinition) {
  const spec = getMarketSpec(market.id);
  const category = spec ? getCategory(spec.categoryId) : undefined;
  const group = category ? getGroup(category.groupId) : undefined;
  return {
    id: market.id,
    name: market.name,
    short_name: market.shortName,
    identifier: market.identifier,
    description: market.description,
    group: group ? { id: group.id, label: group.label } : null,
    category: category ? { id: category.id, label: category.label } : null,
    contract: market.contract,
    contract_id: market.contractId,
    contract_path: contractPath(market.contractId),
    contract_url: spec ? contractUrl(spec) : contractPath(market.contractId),
    params: spec?.params ?? {},
    inputs: spec?.inputs ?? {},
    image: spec?.image ? { src: spec.image.src, ...(spec.image.avif ? { avif: spec.image.avif } : {}), alt: spec.image.alt } : null,
    icon: market.icon,
    time_zone: market.timeZone,
    featured: spec?.featured ?? false,
    units: market.units,
    policy_defaults: market.defaultPolicy,
    provider_count: market.providers.length,
  };
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

/** Groups with their categories and market counts, in display order. */
export function listCategories() {
  const counts = new Map<string, number>();
  for (const market of MARKET_SPECS) counts.set(market.categoryId, (counts.get(market.categoryId) ?? 0) + 1);
  return {
    groups: GROUPS.map((group) => {
      const categories = CATEGORIES.filter((category) => category.groupId === group.id).map((category) => ({
        id: category.id,
        label: category.label,
        description: category.description,
        icon: category.icon,
        focus: category.focus,
        market_count: counts.get(category.id) ?? 0,
      }));
      return {
        id: group.id,
        label: group.label,
        description: group.description,
        market_count: categories.reduce((sum, category) => sum + category.market_count, 0),
        categories,
      };
    }),
  };
}

/** One contract with its schemas and the markets that implement it. */
export function contractSummary(contract: ContractSpec) {
  return {
    id: contract.id,
    version: contract.version,
    label: contract.label,
    description: contract.description,
    path: contractPath(contract.id),
    params: contract.params,
    output: contract.output,
    output_schema: outputSchema(contract),
    freshness: contract.freshness,
    result_view: contract.resultView,
    pricing_unit: contract.pricingUnit,
    markets: MARKET_SPECS.filter((market) => market.contractId === contract.id).map((market) => ({ id: market.id, params: market.params, inputs: market.inputs ?? {} })),
  };
}
export function listContracts() { return { contracts: CONTRACTS.map(contractSummary) }; }
