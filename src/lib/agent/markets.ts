import { bidToAtomic } from "@/lib/payments/quote";
import { CATEGORIES, getCategory, getGroup, GROUPS, listMarkets, type MarketSpec } from "@/lib/registry";
import { marketDetail, parseMarketId } from "@/lib/server/markets";
import { POLICY_PARAMETERS } from "@/lib/server/policy";
import { format, getMarketDefinition, providerName, type MarketId, type RoutingPolicy } from "@/lib/tender";
import { formatMicros } from "@/components/credits/money";
import { describePolicy } from "./policy";

const MAX_RESULTS = 10;
/** Words that say nothing about which market is meant. */
const STOP_WORDS = new Set(["a", "an", "the", "of", "for", "in", "on", "my", "me", "api", "apis", "feed", "data", "market", "markets", "cheap", "cheapest", "best", "current", "live"]);

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word && !STOP_WORDS.has(word));
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function haystack(market: MarketSpec): Set<string> {
  const category = getCategory(market.categoryId);
  const group = category ? getGroup(category.groupId) : undefined;
  return new Set(words([market.id, market.name, market.shortName, market.contractId, ...Object.values(market.params), category?.label ?? "", group?.label ?? ""].join(" ")));
}

function summary(market: MarketSpec) {
  const category = getCategory(market.categoryId);
  const live = market.listings.filter((listing) => listing.available);
  const lowest = live.length > 0 ? Math.min(...live.map((listing) => listing.bidPrice)) : null;
  return {
    id: market.id,
    name: market.name,
    category: category?.label ?? market.categoryId,
    group: (category && getGroup(category.groupId)?.label) ?? null,
    providers: market.listings.length,
    lowest_bid: lowest === null ? null : `${format.price(lowest)} /M`,
  };
}

/** Markets that match a free-text query and an optional group or category (id or label). */
export function findMarkets(input: { query?: string; group?: string; category?: string }) {
  const group = input.group ? GROUPS.find((item) => same(item.id, input.group!) || same(item.label, input.group!)) : undefined;
  const category = input.category ? CATEGORIES.find((item) => same(item.id, input.category!) || same(item.label, input.category!)) : undefined;
  if ((input.group && !group) || (input.category && !category)) {
    return { markets: [], groups: GROUPS.map((item) => ({ id: item.id, label: item.label })), categories: CATEGORIES.map((item) => ({ id: item.id, label: item.label })) };
  }
  const candidates = listMarkets({ groupId: group?.id, categoryId: category?.id });
  const terms = words(input.query ?? "");
  const scored = candidates
    .map((market) => {
      const bag = haystack(market);
      return { market, score: terms.filter((term) => bag.has(term)).length };
    })
    .filter(({ score }) => terms.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score);
  return { markets: scored.slice(0, MAX_RESULTS).map(({ market }) => summary(market)), total: scored.length };
}

/** The routing evaluation of `GET /api/v1/markets/{id}` under a policy, and the provider it serves. */
function routing(marketId: string, policy: Partial<RoutingPolicy>) {
  const id: MarketId = parseMarketId(marketId);
  const url = new URL(`/api/v1/markets/${id}`, "https://tender.internal");
  for (const parameter of POLICY_PARAMETERS) {
    const value = policy[parameter.field];
    if (value !== undefined) url.searchParams.set(parameter.query, String(value));
  }
  if (policy.preference) url.searchParams.set("preference", policy.preference);
  if (policy.mode?.kind === "pinned") url.searchParams.set("pin", policy.mode.providerId);
  const detail = marketDetail(new Request(url), id);
  return { id, detail, active: detail.providers.find((provider) => provider.id === detail.routing.active_provider) };
}

/** What the next request under a policy costs, in micro-USD: the serving provider's bid. 0 when none qualifies. */
export function nextChargeMicros(marketId: string, policy: Partial<RoutingPolicy> = {}): number {
  const { active } = routing(marketId, policy);
  return active ? Number(bidToAtomic(active.bid_per_million)) : 0;
}

/** Bids and the routing decision of a market, from the same evaluation as `GET /api/v1/markets/{id}`. */
export function marketBids(marketId: string, policy: Partial<RoutingPolicy> = {}) {
  const { id, detail, active } = routing(marketId, policy);
  const dataAge = (ms: number) => (getMarketDefinition(id).units.dataAge === "ms" && ms < 10_000 ? `${ms} ms` : format.dataAge(ms));
  return {
    market: { id: detail.id, name: detail.name, contract_url: detail.contract_url },
    policy: describePolicy(id, detail.policy),
    serving: active
      ? { id: active.id, name: active.name, bid: `${format.price(active.bid_per_million)} /M`, cost_per_request: formatMicros(Number(bidToAtomic(active.bid_per_million))) }
      : null,
    reason: detail.routing.reason,
    policy_violations: detail.routing.policy_violations,
    providers: detail.providers.map((provider) => ({
      id: provider.id,
      name: providerName(id, provider.id),
      bid: `${format.price(provider.bid_per_million)} /M`,
      p95: format.latency(provider.p95_latency_ms),
      data_age: dataAge(provider.data_age_ms),
      success_rate: format.percent(provider.success_rate, 2),
      available: provider.available,
      rank: provider.evaluation.rank,
      excluded_because: provider.evaluation.reasons.map((reason) => reason.message),
    })),
  };
}
