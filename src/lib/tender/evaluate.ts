/**
 * Pure provider evaluation (SPEC §4.1): qualification, status priority,
 * reasons, ranking per preference, and the best-price marker.
 */
import * as format from "./format";
import type {
  CheckId,
  CheckResult,
  ExclusionReason,
  ExclusionStatus,
  MarketEvaluation,
  ProviderConditions,
  ProviderEvaluation,
  ProviderId,
  QualificationStatus,
  RoutingPolicy,
  RoutingPreference,
} from "./types";

/** Statuses in priority order: the first failing check decides the status. */
export const STATUS_PRIORITY: readonly QualificationStatus[] = [
  "unavailable",
  "unreliable",
  "over-budget",
  "too-slow",
  "stale-data",
  "eligible",
];

/** Status labels (sentence case). */
export const STATUS_LABELS: Readonly<Record<QualificationStatus, string>> = {
  unavailable: "Unavailable",
  unreliable: "Unreliable",
  "over-budget": "Over budget",
  "too-slow": "Too slow",
  "stale-data": "Stale data",
  eligible: "Eligible",
};

/** Checks in status priority order. */
export const CHECK_ORDER: readonly CheckId[] = ["availability", "reliability", "price", "latency", "freshness"];

/** Status produced when a check fails. */
export const CHECK_STATUS: Readonly<Record<CheckId, ExclusionStatus>> = {
  availability: "unavailable",
  reliability: "unreliable",
  price: "over-budget",
  latency: "too-slow",
  freshness: "stale-data",
};

/** Check names for copy ("failed the latency check"). */
export const CHECK_LABELS: Readonly<Record<CheckId, string>> = {
  availability: "availability",
  reliability: "success rate",
  price: "price",
  latency: "latency",
  freshness: "data age",
};

/** Preference labels (sentence case). */
export const PREFERENCE_LABELS: Readonly<Record<RoutingPreference, string>> = {
  "lowest-cost": "Lowest cost",
  "lowest-latency": "Lowest latency",
  "freshest-data": "Freshest data",
};

/** Preferences in display order. */
export const PREFERENCES: readonly RoutingPreference[] = ["lowest-cost", "lowest-latency", "freshest-data"];

const EPSILON = 1e-9;
const lte = (value: number, limit: number) => value <= limit + EPSILON * Math.max(1, Math.abs(limit));
const gte = (value: number, limit: number) => value >= limit - EPSILON * Math.max(1, Math.abs(limit));

/** Success rate = 1 − error rate. */
export function successRateOf(conditions: Pick<ProviderConditions, "errorRate">): number {
  return 1 - conditions.errorRate;
}

function percentPair(value: number, limit: number): [string, string] {
  let a = format.percent(value);
  let b = format.percent(limit);
  if (a === b && value !== limit) {
    a = format.percent(value, 3);
    b = format.percent(limit, 3);
  }
  return [a, b];
}

/**
 * Short copy for one check, with numbers.
 * Failing: "P95 640 ms exceeds 400 ms". Passing: "P95 180 ms ≤ 400 ms".
 */
export function checkMessage(check: CheckId, value: number, limit: number, passed: boolean): string {
  switch (check) {
    case "availability":
      return passed ? "Provider is responding" : "Provider is not responding";
    case "reliability": {
      const [v, l] = percentPair(value, limit);
      return passed ? `Success ${v} ≥ ${l}` : `Success ${v} is below ${l}`;
    }
    case "price":
      return passed
        ? `Bid ${format.price(value)} ≤ ${format.price(limit)} /M`
        : `Bid ${format.price(value)} exceeds ${format.price(limit)} /M`;
    case "latency":
      return passed
        ? `P95 ${format.latency(value)} ≤ ${format.latency(limit)}`
        : `P95 ${format.latency(value)} exceeds ${format.latency(limit)}`;
    case "freshness":
      return passed
        ? `Data age ${format.dataAge(value)} ≤ ${format.dataAge(limit)}`
        : `Data age ${format.dataAge(value)} exceeds ${format.dataAge(limit)}`;
  }
}

/** Run all five checks for one provider, in status priority order. */
export function runChecks(conditions: ProviderConditions, policy: RoutingPolicy): CheckResult[] {
  const successRate = successRateOf(conditions);
  const raw: [CheckId, number, number, boolean][] = [
    ["availability", conditions.available ? 1 : 0, 1, conditions.available],
    ["reliability", successRate, policy.minSuccessRate, gte(successRate, policy.minSuccessRate)],
    ["price", conditions.bidPrice, policy.maxPrice, lte(conditions.bidPrice, policy.maxPrice)],
    ["latency", conditions.p95LatencyMs, policy.maxP95LatencyMs, lte(conditions.p95LatencyMs, policy.maxP95LatencyMs)],
    ["freshness", conditions.dataAgeMs, policy.maxDataAgeMs, lte(conditions.dataAgeMs, policy.maxDataAgeMs)],
  ];
  return raw.map(([check, value, limit, passed]) => ({
    check,
    passed,
    value,
    limit,
    message: checkMessage(check, value, limit, passed),
  }));
}

/** Evaluate one provider (without rank and markers; see `evaluateMarket`). */
export function evaluateProvider(
  providerId: ProviderId,
  conditions: ProviderConditions,
  policy: RoutingPolicy,
): ProviderEvaluation {
  const checks = runChecks(conditions, policy);
  const reasons: ExclusionReason[] = checks
    .filter((c) => !c.passed)
    .map((c) => ({ check: c.check, status: CHECK_STATUS[c.check], message: c.message, value: c.value, limit: c.limit }));
  return {
    providerId,
    status: reasons.length ? reasons[0].status : "eligible",
    qualifies: reasons.length === 0,
    reasons,
    checks,
    rank: null,
    isRecommended: false,
    isBestPrice: false,
    successRate: successRateOf(conditions),
  };
}

/**
 * The four limit checks of a qualifying provider, as copy:
 * ["Bid $22.00 ≤ $40.00 /M", "P95 180 ms ≤ 400 ms", "Data age 2 min ≤ 15 min", "Success 99.97% ≥ 99.50%"].
 */
export function qualificationLines(conditions: ProviderConditions, policy: RoutingPolicy): string[] {
  const checks = runChecks(conditions, policy);
  const order: CheckId[] = ["price", "latency", "freshness", "reliability"];
  return order.map((id) => checks.find((c) => c.check === id)!.message);
}

/** Minimal provider shape for ranking. */
export interface RankableProvider {
  id: ProviderId;
  name: string;
  conditions: ProviderConditions;
}

const SORT_KEYS: Record<RoutingPreference, (keyof ProviderConditions & ("bidPrice" | "p95LatencyMs" | "dataAgeMs"))[]> = {
  "lowest-cost": ["bidPrice", "p95LatencyMs", "dataAgeMs"],
  "lowest-latency": ["p95LatencyMs", "bidPrice", "dataAgeMs"],
  "freshest-data": ["dataAgeMs", "bidPrice", "p95LatencyMs"],
};

/** Primary ranking key of a preference. */
export function preferenceKey(preference: RoutingPreference): "bidPrice" | "p95LatencyMs" | "dataAgeMs" {
  return SORT_KEYS[preference][0];
}

/** Comparator for a preference (ties broken by the next keys, then by name, then id). */
export function compareProviders(a: RankableProvider, b: RankableProvider, preference: RoutingPreference): number {
  for (const key of SORT_KEYS[preference]) {
    const diff = a.conditions[key] - b.conditions[key];
    if (Math.abs(diff) > EPSILON) return diff;
  }
  const an = a.name.toLowerCase();
  const bn = b.name.toLowerCase();
  if (an !== bn) return an < bn ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Evaluate every provider of a market: statuses, ranking, recommended and best price. */
export function evaluateMarket(providers: readonly RankableProvider[], policy: RoutingPolicy): MarketEvaluation {
  const byId: Record<ProviderId, ProviderEvaluation> = {};
  const qualified: RankableProvider[] = [];
  for (const provider of providers) {
    const evaluation = evaluateProvider(provider.id, provider.conditions, policy);
    byId[provider.id] = evaluation;
    if (evaluation.qualifies) qualified.push(provider);
  }
  const ranked = [...qualified].sort((a, b) => compareProviders(a, b, policy.preference));
  ranked.forEach((provider, index) => {
    byId[provider.id] = { ...byId[provider.id], rank: index + 1, isRecommended: index === 0 };
  });
  const cheapest = [...qualified].sort((a, b) => compareProviders(a, b, "lowest-cost"))[0];
  if (cheapest) byId[cheapest.id] = { ...byId[cheapest.id], isBestPrice: true };
  return {
    byId,
    ranking: ranked.map((p) => p.id),
    recommendedId: ranked[0]?.id ?? null,
    bestPriceId: cheapest?.id ?? null,
  };
}

/** Sort statuses by priority (for excluded rows). */
export function statusPriority(status: QualificationStatus): number {
  return STATUS_PRIORITY.indexOf(status);
}
