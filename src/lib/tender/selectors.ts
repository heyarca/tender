/**
 * Derived views. `selectMarketView` is pure and cached per `MarketState`
 * object, so the same state always yields the same view object.
 */
import { NO_ELIGIBLE_TEXT, outrankText, pinViolationText, providerName, recommendedSummaryText } from "./activity";
import { SWITCH_COOLDOWN_MS } from "./constants";
import { compareProviders, PREFERENCE_LABELS, preferenceKey, qualificationLines, STATUS_LABELS, statusPriority } from "./evaluate";
import { getDefaultPolicy, getProviderFixture, MARKETS } from "./markets";
import * as format from "./format";
import { evaluateMarketState } from "./router";
import type {
  MarketEvaluation,
  MarketId,
  MarketState,
  MarketView,
  PendingSwitchView,
  ProviderConditions,
  ProviderId,
  ProviderRow,
  RoutingDecision,
  RoutingMode,
  RoutingPolicy,
  RoutingRole,
  ServedRequestResult,
  SummaryMetrics,
  TenderState,
} from "./types";

const CONDITION_FIELDS: (keyof ProviderConditions)[] = ["bidPrice", "p95LatencyMs", "dataAgeMs", "errorRate", "available"];
const POLICY_FIELDS: (keyof RoutingPolicy)[] = ["maxPrice", "maxP95LatencyMs", "maxDataAgeMs", "minSuccessRate", "preference", "mode"];

const sameMode = (a: RoutingMode, b: RoutingMode) =>
  a.kind === b.kind && (a.kind === "auto" || (b.kind === "pinned" && a.providerId === b.providerId));

/** Provider that serves requests now: the pinned provider, or the auto route. */
export function servingProviderId(market: MarketState): ProviderId | null {
  return market.policy.mode.kind === "pinned" ? market.policy.mode.providerId : market.route.activeProviderId;
}

function roleOf(market: MarketState, evaluation: MarketEvaluation, providerId: ProviderId): RoutingRole {
  const mode = market.policy.mode;
  const qualifies = evaluation.byId[providerId]?.qualifies ?? false;
  if (mode.kind === "pinned" && mode.providerId === providerId) return qualifies ? "pinned" : "pinned-failing";
  if (mode.kind === "auto" && market.route.activeProviderId === providerId) return "active";
  return qualifies ? "standby" : "excluded";
}

function buildRows(market: MarketState, evaluation: MarketEvaluation): ProviderRow[] {
  const servingId = servingProviderId(market);
  const pendingId = market.route.pending?.providerId ?? null;
  const rows = market.providers.map((provider): ProviderRow => {
    const fixture = getProviderFixture(market.id, provider.id)!;
    const identity = { id: fixture.id, name: fixture.name, logo: fixture.logo };
    const ev = evaluation.byId[provider.id];
    const modifiedFields = CONDITION_FIELDS.filter((f) => provider.conditions[f] !== fixture.defaults[f]);
    return {
      ...identity,
      identity,
      conditions: provider.conditions,
      defaults: fixture.defaults,
      successRate: ev.successRate,
      evaluation: ev,
      status: ev.status,
      statusLabel: STATUS_LABELS[ev.status],
      role: roleOf(market, evaluation, provider.id),
      isActive: servingId === provider.id,
      isRecommended: ev.isRecommended,
      isBestPrice: ev.isBestPrice,
      isPendingTarget: pendingId === provider.id,
      modified: modifiedFields.length > 0,
      modifiedFields,
      requestPrice: provider.conditions.bidPrice / 1e6,
      history: provider.history,
      latencies: provider.latencies,
    };
  });
  return sortRows(rows, market.policy);
}

/** Display order: active first, then qualified by rank, then excluded by status priority, price, name. */
export function sortRows(rows: ProviderRow[], policy: RoutingPolicy): ProviderRow[] {
  const group = (row: ProviderRow) => (row.isActive ? 0 : row.evaluation.qualifies ? 1 : 2);
  return [...rows].sort((a, b) => {
    const g = group(a) - group(b);
    if (g !== 0) return g;
    if (group(a) === 1) return (a.evaluation.rank ?? 0) - (b.evaluation.rank ?? 0);
    if (group(a) === 2) {
      const s = statusPriority(a.status) - statusPriority(b.status);
      if (s !== 0) return s;
      return compareProviders(a, b, "lowest-cost");
    }
    return compareProviders(a, b, policy.preference);
  });
}

function pendingView(market: MarketState): PendingSwitchView | null {
  const pending = market.route.pending;
  if (!pending) return null;
  return {
    providerId: pending.providerId,
    providerName: providerName(market.id, pending.providerId),
    fromProviderId: market.route.activeProviderId,
    executeAt: pending.executeAt,
    scheduledAt: pending.scheduledAt,
  };
}

/** "Switching to Slatework in 7 s — switch cooldown". */
export function formatPendingSwitch(pending: Pick<PendingSwitchView, "providerName" | "executeAt">, now: number): string {
  return `Switching to ${pending.providerName} in ${format.countdown(pending.executeAt, now)} — switch cooldown`;
}

/** Seconds left before a pending switch runs (0 when due). */
export function pendingSecondsRemaining(pending: Pick<PendingSwitchView, "executeAt">, now: number): number {
  return Math.max(0, Math.ceil((pending.executeAt - now) / 1000));
}

function betterExcludedLines(rows: ProviderRow[], active: ProviderRow, policy: RoutingPolicy): string[] {
  const key = preferenceKey(policy.preference);
  return rows
    .filter((row) => !row.evaluation.qualifies && row.conditions[key] < active.conditions[key])
    .sort((a, b) => a.conditions[key] - b.conditions[key])
    .map((row) => {
      const reasons = row.evaluation.reasons.map((r) => r.message).join("; ");
      switch (key) {
        case "bidPrice":
          return `${row.name} is cheaper (${format.price(row.conditions.bidPrice)} /M) but excluded: ${reasons}.`;
        case "p95LatencyMs":
          return `${row.name} is faster (P95 ${format.latency(row.conditions.p95LatencyMs)}) but excluded: ${reasons}.`;
        case "dataAgeMs":
          return `${row.name} has fresher data (${format.dataAge(row.conditions.dataAgeMs)}) but excluded: ${reasons}.`;
      }
    });
}

/** Explanation of the current route (decision callout). */
export function buildRoutingDecision(market: MarketState, rows: ProviderRow[], evaluation: MarketEvaluation): RoutingDecision {
  const byId = Object.fromEntries(rows.map((r) => [r.id, r])) as Record<ProviderId, ProviderRow>;
  const recommendedId = evaluation.recommendedId;
  const recommended = recommendedId ? byId[recommendedId] : null;
  const mode = market.policy.mode;
  const policy = market.policy;
  const base = { recommendedProviderId: recommendedId, pending: null, actions: [] as RoutingDecision["actions"] };

  if (mode.kind === "pinned") {
    const pinned = byId[mode.providerId];
    if (!pinned.evaluation.qualifies) {
      const unavailable = pinned.evaluation.reasons.some((r) => r.check === "availability");
      return {
        ...base,
        kind: "pinned-failing",
        tone: "negative",
        title: "Pinned provider fails your policy",
        summary: pinViolationText(market.id, pinned.id, pinned.evaluation.reasons),
        details: unavailable ? [`Requests to ${pinned.name} fail until it responds again.`] : [],
        activeProviderId: pinned.id,
        actions: [
          ...(recommended
            ? [{ kind: "switch-to-recommended" as const, providerId: recommended.id, label: `Switch to ${recommended.name}` }]
            : []),
          { kind: "use-automatic" as const, label: "Use automatic switching" },
        ],
      };
    }
    const details = [qualificationLines(pinned.conditions, policy).join(" · ")];
    if (recommended && recommended.id !== pinned.id) {
      details.push(`${recommended.name} ranks first for ${PREFERENCE_LABELS[policy.preference].toLowerCase()}.`);
    }
    return {
      ...base,
      kind: "pinned",
      tone: "neutral",
      title: `Pinned to ${pinned.name}`,
      summary: `Requests always go to ${pinned.name}. It meets your policy.`,
      details,
      activeProviderId: pinned.id,
    };
  }

  const activeId = market.route.activeProviderId;
  if (!activeId) {
    return {
      ...base,
      kind: "no-eligible",
      tone: "negative",
      title: "No eligible provider",
      summary: NO_ELIGIBLE_TEXT,
      details: rows.map((row) => `${row.name}: ${row.evaluation.reasons.map((r) => r.message).join("; ")}`),
      activeProviderId: null,
    };
  }

  const active = byId[activeId];
  const lines = qualificationLines(active.conditions, policy).join(" · ");
  const pending = pendingView(market);
  if (pending) {
    const target = byId[pending.providerId];
    return {
      ...base,
      kind: "pending-switch",
      tone: "warning",
      title: `Switching to ${target.name}`,
      summary: `${outrankText(market.id, policy.preference, target.id, target.conditions, active.id, active.conditions)}. The switch runs when the ${SWITCH_COOLDOWN_MS / 1000} s cooldown ends.`,
      details: [`${active.name} keeps serving until then: ${lines}.`],
      activeProviderId: activeId,
      pending,
    };
  }

  const details = [lines, ...betterExcludedLines(rows, active, policy)];
  const bestPriceId = evaluation.bestPriceId;
  if (bestPriceId && bestPriceId !== activeId && policy.preference !== "lowest-cost") {
    details.push(`Best price: ${byId[bestPriceId].name} at ${format.price(byId[bestPriceId].conditions.bidPrice)} /M.`);
  }
  return {
    ...base,
    kind: "routing",
    tone: "positive",
    title: `Routing to ${active.name}`,
    summary: active.evaluation.rank === 1 ? recommendedSummaryText(policy.preference, active.name) : `${active.name} meets your policy.`,
    details,
    activeProviderId: activeId,
  };
}

function buildMetrics(market: MarketState, rows: ProviderRow[]): SummaryMetrics {
  const servingId = servingProviderId(market);
  const active = servingId ? rows.find((r) => r.id === servingId) ?? null : null;
  const served = market.requests.filter((r): r is ServedRequestResult => r.status === "ok");
  return {
    activeProviderId: active?.id ?? null,
    activeProviderName: active?.name ?? null,
    bidPrice: active?.conditions.bidPrice ?? null,
    requestPrice: active ? active.conditions.bidPrice / 1e6 : null,
    p95LatencyMs: active?.conditions.p95LatencyMs ?? null,
    dataAgeMs: active?.conditions.dataAgeMs ?? null,
    successRate: active?.successRate ?? null,
    requests: market.counters,
    spend: market.spend,
    avgLatencyMs: served.length ? Math.round(served.reduce((sum, r) => sum + r.latencyMs, 0) / served.length) : null,
  };
}

const viewCache = new WeakMap<MarketState, MarketView>();

/** Everything the UI renders for one market. Cached per `MarketState` object. */
export function selectMarketView(market: MarketState): MarketView {
  const cached = viewCache.get(market);
  if (cached) return cached;
  const evaluation = evaluateMarketState(market);
  const rows = buildRows(market, evaluation);
  const providersById = Object.fromEntries(rows.map((r) => [r.id, r])) as Record<ProviderId, ProviderRow>;
  const defaultPolicy = getDefaultPolicy(market.id);
  const modifiedPolicyFields = POLICY_FIELDS.filter((f) =>
    f === "mode" ? !sameMode(market.policy.mode, defaultPolicy.mode) : market.policy[f] !== defaultPolicy[f],
  );
  const servingId = servingProviderId(market);
  const lastServed = market.requests.find((r): r is ServedRequestResult => r.status === "ok") ?? null;
  const view: MarketView = {
    id: market.id,
    definition: MARKETS[market.id],
    policy: market.policy,
    defaultPolicy,
    policyModified: modifiedPolicyFields.some((f) => f !== "mode"),
    modifiedPolicyFields,
    providers: rows,
    providersById,
    qualifiedCount: evaluation.ranking.length,
    excludedCount: rows.length - evaluation.ranking.length,
    route: {
      activeProviderId: servingId,
      activeProvider: servingId ? providersById[servingId] ?? null : null,
      mode: market.policy.mode,
      since: market.route.since,
      lastSwitchAt: market.route.lastSwitchAt,
      pending: pendingView(market),
    },
    decision: buildRoutingDecision(market, rows, evaluation),
    recommended: evaluation.recommendedId ? providersById[evaluation.recommendedId] : null,
    bestPrice: evaluation.bestPriceId ? providersById[evaluation.bestPriceId] : null,
    lastResult: market.requests[0] ?? null,
    lastServed,
    recentResults: market.requests,
    metrics: buildMetrics(market, rows),
    activity: market.activity,
    series: market.series,
    autoRun: market.autoRun,
    conditionsModified: rows.some((r) => r.modified),
  };
  viewCache.set(market, view);
  return view;
}

/** `selectMarketView` from the whole state. */
export function selectMarketViewFromState(state: TenderState, marketId: MarketId): MarketView {
  return selectMarketView(state.markets[marketId]);
}
