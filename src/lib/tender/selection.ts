/**
 * Stateless routing for server code (Route Handlers): select a route for a
 * policy once, quote it, then execute that frozen selection. Pure and
 * deterministic: the same input always gives the same output.
 *
 * The client store keeps route history (cooldowns, pending switches); this
 * module has none, so automatic mode always picks the rank-1 provider.
 */
import { NO_ELIGIBLE_TEXT, pinViolationText, recommendedSummaryText } from "./activity";
import { formatRequestId } from "./context";
import { evaluateMarket, qualificationLines, STATUS_LABELS, statusPriority, compareProviders } from "./evaluate";
import { getDefaultPolicy, getProviderFixture, MARKETS } from "./fixtures";
import { sampleRequest, signalReference } from "./requests";
import type {
  ExclusionReason,
  MarketEvaluation,
  MarketId,
  MarketReference,
  ProviderConditions,
  ProviderEvaluation,
  ProviderId,
  ProviderIdentity,
  QualificationStatus,
  RequestResult,
  RoutingMode,
  RoutingPolicy,
} from "./types";

/** Provider conditions by id. Missing providers use their fixture defaults. */
export type ConditionsById = Partial<Record<ProviderId, ProviderConditions>>;

/** Fixture default conditions of every provider in a market (fresh copies). */
export function getDefaultConditions(marketId: MarketId): Record<ProviderId, ProviderConditions> {
  const out: Record<ProviderId, ProviderConditions> = {};
  for (const provider of MARKETS[marketId].providers) out[provider.id] = { ...provider.defaults };
  return out;
}

export interface SelectRouteOptions {
  /** Policy fields; missing fields use the market default policy. */
  policy?: Partial<RoutingPolicy>;
  /**
   * Pin a provider (overrides `policy.mode`). Requests go to it even when it
   * fails the policy; `null` forces automatic switching.
   */
  pin?: ProviderId | null;
  /** Current conditions per provider (default: fixture defaults). */
  conditions?: ConditionsById;
}

/**
 * How the provider was chosen:
 * - `recommended`: automatic mode, rank 1 for the preference.
 * - `pinned`: pinned provider that meets the policy.
 * - `pinned-failing`: pinned provider that fails the policy (requests still go to it).
 * - `no-eligible`: no provider qualifies (or the pin is unknown); requests are rejected.
 */
export type RouteSelectionKind = "recommended" | "pinned" | "pinned-failing" | "no-eligible";

/** One provider in a selection, best first. */
export interface SelectionCandidate extends ProviderIdentity {
  conditions: ProviderConditions;
  status: QualificationStatus;
  /** "Eligible", "Too slow", … */
  statusLabel: string;
  qualifies: boolean;
  /** 1-based rank among qualified providers, `null` when excluded. */
  rank: number | null;
  isRecommended: boolean;
  isBestPrice: boolean;
  /** Every failing check (empty when eligible). */
  reasons: ExclusionReason[];
  successRate: number;
}

/** A frozen routing decision. Quote and execute the same object. */
export interface RouteSelection {
  marketId: MarketId;
  kind: RouteSelectionKind;
  /** Resolved policy (defaults + overrides + pin). */
  policy: RoutingPolicy;
  /** Provider that serves the request; `null` means the request is rejected. */
  providerId: ProviderId | null;
  provider: ProviderIdentity | null;
  /** Conditions of the selected provider at selection time. */
  conditions: ProviderConditions | null;
  /** Bid of the selected provider, USD per 1M requests. */
  bidPrice: number | null;
  /** Price of one request, USD (bid / 1e6). */
  requestPrice: number | null;
  /** Rank-1 provider for the policy (may differ from `providerId` when pinned). */
  recommendedId: ProviderId | null;
  /** Lowest-priced qualified provider. */
  bestPriceId: ProviderId | null;
  /** Qualified provider ids, best first. */
  ranking: ProviderId[];
  /** Qualified providers by rank, then excluded ones by status priority and price. */
  candidates: SelectionCandidate[];
  /** Full evaluation keyed by provider id. */
  evaluation: MarketEvaluation;
  /** `true` when the selected provider fails the policy (`pinned-failing`). */
  policyViolation: boolean;
  /** Failing checks of the selected provider (empty unless `pinned-failing`). */
  violations: ExclusionReason[];
  /** One sentence, final product copy. */
  summary: string;
  /** Check lines for the selected provider ("Bid $18.00 ≤ $40.00 /M", …). */
  details: string[];
}

function resolvePolicy(marketId: MarketId, options: SelectRouteOptions): RoutingPolicy {
  const defaults = getDefaultPolicy(marketId);
  const policy: RoutingPolicy = { ...defaults, ...options.policy, mode: options.policy?.mode ?? defaults.mode };
  if (options.pin === null) return { ...policy, mode: { kind: "auto" } };
  if (typeof options.pin === "string") return { ...policy, mode: { kind: "pinned", providerId: options.pin } };
  const mode: RoutingMode = policy.mode.kind === "pinned" ? { kind: "pinned", providerId: policy.mode.providerId } : { kind: "auto" };
  return { ...policy, mode };
}

function candidateOf(marketId: MarketId, id: ProviderId, conditions: ProviderConditions, ev: ProviderEvaluation): SelectionCandidate {
  const fixture = getProviderFixture(marketId, id)!;
  return {
    id,
    name: fixture.name,
    logo: fixture.logo,
    conditions,
    status: ev.status,
    statusLabel: STATUS_LABELS[ev.status],
    qualifies: ev.qualifies,
    rank: ev.rank,
    isRecommended: ev.isRecommended,
    isBestPrice: ev.isBestPrice,
    reasons: ev.reasons,
    successRate: ev.successRate,
  };
}

/**
 * Select the provider for one request under a policy. Automatic mode picks
 * rank 1; a pin always selects the pinned provider and reports violations.
 */
export function selectRoute(marketId: MarketId, options: SelectRouteOptions = {}): RouteSelection {
  const policy = resolvePolicy(marketId, options);
  const providers = MARKETS[marketId].providers.map((fixture) => ({
    id: fixture.id,
    name: fixture.name,
    conditions: { ...(options.conditions?.[fixture.id] ?? fixture.defaults) },
  }));
  const evaluation = evaluateMarket(providers, policy);
  const conditionsById = Object.fromEntries(providers.map((p) => [p.id, p.conditions])) as Record<ProviderId, ProviderConditions>;
  const candidates = providers
    .map((p) => candidateOf(marketId, p.id, p.conditions, evaluation.byId[p.id]))
    .sort((a, b) => {
      if (a.qualifies !== b.qualifies) return a.qualifies ? -1 : 1;
      if (a.qualifies) return (a.rank ?? 0) - (b.rank ?? 0);
      const s = statusPriority(a.status) - statusPriority(b.status);
      return s !== 0 ? s : compareProviders(a, b, "lowest-cost");
    });

  let providerId: ProviderId | null;
  let kind: RouteSelectionKind;
  let summary: string;
  let violations: ExclusionReason[] = [];
  if (policy.mode.kind === "pinned") {
    const pinnedId = policy.mode.providerId;
    const pinned = evaluation.byId[pinnedId];
    if (!pinned) {
      providerId = null;
      kind = "no-eligible";
      summary = `Pinned provider ${pinnedId} does not serve ${MARKETS[marketId].name}. Requests are rejected and nothing is sent.`;
    } else if (pinned.qualifies) {
      providerId = pinnedId;
      kind = "pinned";
      summary = `Requests always go to ${getProviderFixture(marketId, pinnedId)!.name}. It meets your policy.`;
    } else {
      providerId = pinnedId;
      kind = "pinned-failing";
      violations = pinned.reasons;
      summary = pinViolationText(marketId, pinnedId, pinned.reasons);
    }
  } else if (evaluation.recommendedId) {
    providerId = evaluation.recommendedId;
    kind = "recommended";
    summary = recommendedSummaryText(policy.preference, getProviderFixture(marketId, providerId)!.name);
  } else {
    providerId = null;
    kind = "no-eligible";
    summary = NO_ELIGIBLE_TEXT;
  }

  const fixture = providerId ? getProviderFixture(marketId, providerId)! : null;
  const conditions = providerId ? conditionsById[providerId] : null;
  return {
    marketId,
    kind,
    policy,
    providerId,
    provider: fixture ? { id: fixture.id, name: fixture.name, logo: fixture.logo } : null,
    conditions,
    bidPrice: conditions ? conditions.bidPrice : null,
    requestPrice: conditions ? conditions.bidPrice / 1e6 : null,
    recommendedId: evaluation.recommendedId,
    bestPriceId: evaluation.bestPriceId,
    ranking: evaluation.ranking,
    candidates,
    evaluation,
    policyViolation: kind === "pinned-failing",
    violations,
    summary,
    details: conditions ? qualificationLines(conditions, policy) : [],
  };
}

export interface ExecuteSelectionOptions {
  /** Request time (ms). */
  now: number;
  /** PRNG seed (uint32), e.g. `seedFromString(requestId)`. */
  seed: number;
  /** Default: `formatRequestId(seed % 1_000_000)`. */
  requestId?: string;
  /**
   * Upstream reference value (live SF conditions or BTC spot). `null` or
   * missing uses the deterministic signal. A reference for the other market is ignored.
   */
  reference?: MarketReference | null;
  /** Origin of the deterministic signal (default `FIXTURE_EPOCH`). */
  signalOrigin?: number;
  /** BTC only: previous served price, for `changeUsd`. */
  previousPriceUsd?: number | null;
}

/** Result of executing a selection. */
export interface SelectionExecution {
  selection: RouteSelection;
  result: RequestResult;
  /** PRNG state after the draws (feed it back as the next seed to chain requests). */
  rng: number;
  /**
   * Reference the payload was derived from. `source: "upstream"` echoes the
   * injected value and its own time; `"signal"` is the deterministic fallback at `now`.
   * Payload timestamps (`observedAt` / `sourceTimestamp`) are the provider's
   * observation time (`now − dataAgeMs`), never the upstream time.
   */
  reference: { source: "upstream" | "signal"; at: number; value: MarketReference };
}

/**
 * Execute a frozen selection: sample latency, data age, failures, and the
 * normalized payload for the selected provider. No route → `rejected`.
 */
export function executeSelection(selection: RouteSelection, options: ExecuteSelectionOptions): SelectionExecution {
  const reference =
    options.reference && (options.reference.kind === "btc") === (selection.marketId === "btc-usd") ? options.reference : null;
  const { result, rng } = sampleRequest({
    marketId: selection.marketId,
    providerId: selection.providerId,
    conditions: selection.conditions ?? undefined,
    requestId: options.requestId ?? formatRequestId((options.seed >>> 0) % 1_000_000),
    now: options.now,
    seed: options.seed,
    routingMode: selection.policy.mode.kind,
    signalOrigin: options.signalOrigin,
    previousPriceUsd: options.previousPriceUsd,
    reference,
  });
  return {
    selection,
    result,
    rng,
    reference: reference
      ? { source: "upstream", at: reference.at ?? options.now, value: reference }
      : { source: "signal", at: options.now, value: signalReference(selection.marketId, options.now, options.signalOrigin) },
  };
}

/** `selectRoute` + `executeSelection` in one call. */
export function routeRequest(
  marketId: MarketId,
  options: SelectRouteOptions & ExecuteSelectionOptions,
): SelectionExecution {
  return executeSelection(selectRoute(marketId, options), options);
}
