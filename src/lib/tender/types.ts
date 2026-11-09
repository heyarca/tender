/**
 * Domain types for the Tender engine.
 *
 * Everything in this module is plain data: no functions, no classes, no React.
 * Timestamps are epoch milliseconds. Prices are USD per 1M requests.
 */

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

/** Identifier of a market. */
export type MarketId = "sf-weather" | "btc-usd";

/** Provider identifier, unique inside a market (matches `public/providers/<id>.<ext>`). */
export type ProviderId = string;

/** Display time zone of a market. */
export type MarketTimeZone = "America/Los_Angeles" | "UTC";

/** Icon hint for a market (the UI maps it to an icon). */
export type MarketIcon = "cloud" | "bitcoin";

/**
 * Spec for one numeric input (policy control or provider condition).
 *
 * `min`, `max`, and `step` are in display units. Convert with
 * `value = display * factor` and `display = value / factor`
 * (see `toDisplayValue` / `fromDisplayValue` in `@/lib/tender`).
 */
export interface NumericInputSpec {
  /** Short label, sentence case ("Max price"). */
  label: string;
  /** Optional prefix shown inside the input ("$"). */
  prefix?: string;
  /** Unit suffix shown inside the input ("/M req", "ms", "min", "%"). */
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Decimals shown in the input. */
  decimals: number;
  /** Engine value = display value × factor. */
  factor: number;
  /** One-line help text for a tooltip. */
  hint: string;
}

/** Inputs for the routing policy form. */
export interface PolicyInputSpecs {
  maxPrice: NumericInputSpec;
  maxP95LatencyMs: NumericInputSpec;
  maxDataAgeMs: NumericInputSpec;
  minSuccessRate: NumericInputSpec;
}

/** Inputs for the provider conditions form. */
export interface ConditionInputSpecs {
  bidPrice: NumericInputSpec;
  p95LatencyMs: NumericInputSpec;
  dataAgeMs: NumericInputSpec;
  errorRate: NumericInputSpec;
}

/** A code sample for the API dialog. */
export interface CodeSample {
  language: "typescript" | "python" | "json";
  label: string;
  code: string;
}

/** Field of the normalized result, for docs/API dialog tables. */
export interface ResultFieldSpec {
  key: string;
  label: string;
  unit?: string;
}

/** Static identity of a provider. */
export interface ProviderIdentity {
  id: ProviderId;
  name: string;
  /** Public path of the original logo, e.g. `/providers/together.png`. */
  logo: string;
}

/** Fixture entry for a provider in one market. */
export interface ProviderFixture extends ProviderIdentity {
  /** Default conditions (restored by "Restore provider" / "Reset conditions"). */
  defaults: ProviderConditions;
  /**
   * Fixed reporting bias in [-1, 1]. The market scales it
   * (weather: ≤ 0.5°F and ≤ 2% humidity; BTC: ≤ $1.50).
   */
  bias: number;
}

/** Static definition of a market. */
export interface MarketDefinition {
  id: MarketId;
  /** "San Francisco Weather" */
  name: string;
  /** "SF Weather" */
  shortName: string;
  /** "weather/san-francisco" */
  identifier: string;
  /** `weather.current({ location: "san-francisco" })` */
  contract: string;
  description: string;
  timeZone: MarketTimeZone;
  /** "PT" | "UTC" */
  timeZoneLabel: string;
  icon: MarketIcon;
  /** Unit hints for result values. */
  units: {
    /** Bid unit suffix: "/M req". */
    price: string;
    /** Data age input unit: "min" (weather) or "ms" (BTC). */
    dataAge: "min" | "ms";
    /** Primary result unit: "°F" or "USD". */
    value: string;
  };
  /** Price definition shared by every provider (BTC only). */
  priceDefinition?: string;
  /** Normalized result fields. */
  resultFields: ResultFieldSpec[];
  defaultPolicy: RoutingPolicy;
  policyInputs: PolicyInputSpecs;
  conditionInputs: ConditionInputSpecs;
  providers: ProviderFixture[];
  /** Default code samples for the API dialog (see `getApiSnippets` for policy-aware ones). */
  codeSamples: CodeSample[];
  /** Example JSON response for the API dialog. */
  sampleResponse: string;
}

// ---------------------------------------------------------------------------
// Policy and conditions
// ---------------------------------------------------------------------------

export type RoutingPreference = "lowest-cost" | "lowest-latency" | "freshest-data";

/** `auto` routes to the recommended provider; `pinned` always uses one provider. */
export type RoutingMode = { kind: "auto" } | { kind: "pinned"; providerId: ProviderId };

/** Routing policy of a market. Persisted per market. */
export interface RoutingPolicy {
  /** Max bid, USD per 1M requests. */
  maxPrice: number;
  maxP95LatencyMs: number;
  maxDataAgeMs: number;
  /** 0..1 */
  minSuccessRate: number;
  preference: RoutingPreference;
  mode: RoutingMode;
}

/** Editable policy fields (mode has its own action). */
export type PolicyPatch = Partial<Omit<RoutingPolicy, "mode">>;

/** Current conditions of a provider (what the monitor measures now). */
export interface ProviderConditions {
  /** Bid, USD per 1M requests. */
  bidPrice: number;
  p95LatencyMs: number;
  dataAgeMs: number;
  /** 0..1 */
  errorRate: number;
  available: boolean;
}

export type ConditionsPatch = Partial<ProviderConditions>;

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** Qualification status, in priority order (see `STATUS_PRIORITY`). */
export type QualificationStatus =
  | "unavailable"
  | "unreliable"
  | "over-budget"
  | "too-slow"
  | "stale-data"
  | "eligible";

/** A status other than `eligible`. */
export type ExclusionStatus = Exclude<QualificationStatus, "eligible">;

/** The five policy checks. */
export type CheckId = "availability" | "reliability" | "price" | "latency" | "freshness";

/** Result of one policy check. */
export interface CheckResult {
  check: CheckId;
  passed: boolean;
  /** Measured value (success rate 0..1 for reliability; 1/0 for availability). */
  value: number;
  /** Policy limit (same unit as `value`). */
  limit: number;
  /** Short copy: "P95 640 ms exceeds 400 ms" or "P95 180 ms ≤ 400 ms". */
  message: string;
}

/** Why a provider does not qualify. */
export interface ExclusionReason {
  check: CheckId;
  status: ExclusionStatus;
  /** Short copy with numbers, e.g. "Bid $58.00 exceeds $40.00 /M". */
  message: string;
  value: number;
  limit: number;
}

/** Evaluation of one provider against a policy. */
export interface ProviderEvaluation {
  providerId: ProviderId;
  status: QualificationStatus;
  qualifies: boolean;
  /** Every failing check, in status priority order (empty when eligible). */
  reasons: ExclusionReason[];
  /** All five checks, in status priority order. */
  checks: CheckResult[];
  /** 1-based rank among qualified providers, `null` when excluded. */
  rank: number | null;
  /** Rank 1. */
  isRecommended: boolean;
  /** Lowest-priced qualified provider. */
  isBestPrice: boolean;
  /** 1 − errorRate. */
  successRate: number;
}

/** Evaluation of a whole market. */
export interface MarketEvaluation {
  /** Keyed by provider id. */
  byId: Record<ProviderId, ProviderEvaluation>;
  /** Qualified provider ids, best first. */
  ranking: ProviderId[];
  recommendedId: ProviderId | null;
  bestPriceId: ProviderId | null;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** An optimization switch waiting for the cooldown to end. */
export interface PendingSwitch {
  providerId: ProviderId;
  executeAt: number;
  scheduledAt: number;
}

/** Route state of a market. The mode lives in `policy.mode`. */
export interface RouteState {
  /** Provider that serves requests now; `null` = no eligible provider. */
  activeProviderId: ProviderId | null;
  /** When the current route (or the no-route state) started. */
  since: number;
  /** Last time the route changed (drives the switch cooldown). */
  lastSwitchAt: number;
  pending: PendingSwitch | null;
  /** Current pinned-provider violation, used to log/notify it once. */
  pinViolation: { providerId: ProviderId; key: string } | null;
}

/** What caused a route change. */
export type RouteTrigger =
  | "failover"
  | "optimization"
  | "policy-change"
  | "mode-change"
  | "recovery"
  | "operator-switch"
  | "restored";

export type RoutingDecisionKind =
  | "routing"
  | "pending-switch"
  | "no-eligible"
  | "pinned"
  | "pinned-failing";

/** Action offered by the routing decision callout. */
export type RoutingDecisionAction =
  | { kind: "switch-to-recommended"; providerId: ProviderId; label: string }
  | { kind: "use-automatic"; label: string };

export type Tone = "neutral" | "positive" | "warning" | "negative";

/** Explanation of the current route, for the decision callout. */
export interface RoutingDecision {
  kind: RoutingDecisionKind;
  tone: Tone;
  /** "Routing to Together" */
  title: string;
  /** One sentence. */
  summary: string;
  /** Extra lines (check results, excluded alternatives). */
  details: string[];
  activeProviderId: ProviderId | null;
  recommendedProviderId: ProviderId | null;
  /** Pending optimization switch; format the countdown with `formatPendingSwitch(pending, now)`. */
  pending: PendingSwitchView | null;
  actions: RoutingDecisionAction[];
}

export interface PendingSwitchView {
  providerId: ProviderId;
  providerName: string;
  fromProviderId: ProviderId | null;
  executeAt: number;
  scheduledAt: number;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface WeatherPayload {
  kind: "weather";
  location: { name: string; latitude: number; longitude: number };
  /** Observation timestamp (ms). */
  observedAt: number;
  temperatureF: number;
  feelsLikeF: number;
  condition: string;
  humidityPct: number;
  windMph: number;
  windDirectionDeg: number;
  /** Compass label, e.g. "W". */
  windDirection: string;
  pressureHpa: number;
  visibilityMi: number;
  dewPointF: number;
  cloudCoverPct: number;
}

export interface BtcPayload {
  kind: "btc";
  pair: "BTC-USD";
  priceUsd: number;
  /** Change vs the previous served request in this market (`null` for the first). */
  changeUsd: number | null;
  /** Change in percent (e.g. 0.012 = 0.012%). */
  changePct: number | null;
  /** Source timestamp (ms). */
  sourceTimestamp: number;
}

/**
 * Upstream San Francisco conditions (true values at `at`) injected by server
 * code. Missing fields fall back to the deterministic signal. Providers report
 * the reference moved by the signal's drift between `at` and their observation
 * time, plus their bias.
 */
export interface WeatherReference {
  kind: "weather";
  /** Time the values describe (ms). Default: the request time. */
  at?: number;
  temperatureF?: number;
  feelsLikeF?: number;
  /** Condition label ("Overcast"); default derived from cloud cover. */
  condition?: string;
  humidityPct?: number;
  windMph?: number;
  windDirectionDeg?: number;
  pressureHpa?: number;
  visibilityMi?: number;
  dewPointF?: number;
  cloudCoverPct?: number;
}

/** Upstream BTC/USD spot price (true value at `at`) injected by server code. */
export interface BtcReference {
  kind: "btc";
  /** Time the price describes (ms). Default: the request time. */
  at?: number;
  priceUsd: number;
}

/** Reference value of a market: weather conditions or BTC spot price. */
export type MarketReference = WeatherReference | BtcReference;

interface RequestBase {
  /** `req_000123` (monotonic across markets). */
  requestId: string;
  requestedAt: number;
  routingMode: RoutingMode["kind"];
}

interface ServedBase extends RequestBase {
  status: "ok";
  providerId: ProviderId;
  providerName: string;
  latencyMs: number;
  /** Data age at response (ms). */
  dataAgeMs: number;
  /** USD charged for this request (bid / 1e6). */
  cost: number;
}

export interface ServedWeatherResult extends ServedBase {
  marketId: "sf-weather";
  payload: WeatherPayload;
}

export interface ServedBtcResult extends ServedBase {
  marketId: "btc-usd";
  payload: BtcPayload;
}

export interface FailedRequestResult extends RequestBase {
  status: "failed";
  marketId: MarketId;
  providerId: ProviderId;
  providerName: string;
  latencyMs: number;
  error: { code: number; message: string };
  cost: 0;
}

export interface RejectedRequestResult extends RequestBase {
  status: "rejected";
  marketId: MarketId;
  providerId: null;
  reason: "No eligible provider";
  cost: 0;
}

export type ServedRequestResult = ServedWeatherResult | ServedBtcResult;

/** Result of `runRequest`. Discriminate on `status`, then on `marketId` for the payload. */
export type RequestResult = ServedRequestResult | FailedRequestResult | RejectedRequestResult;

export type RequestStatus = RequestResult["status"];

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/** One monitor sample of a provider. */
export interface ProviderSample {
  at: number;
  p95LatencyMs: number;
  dataAgeMs: number;
  /** 0..1 (0 while unavailable). */
  successRate: number;
  bidPrice: number;
  available: boolean;
}

/** Latency of one request served (or failed) by a provider. */
export interface LatencySample {
  at: number;
  requestId: string;
  latencyMs: number;
  ok: boolean;
}

/** One point of the market's recent-value chart (BTC price or temperature °F). */
export interface SeriesPoint {
  at: number;
  value: number;
  providerId: ProviderId | null;
  requestId: string | null;
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export type ActivityKind = ActivityEntry["kind"];

interface ActivityBase {
  /** `act_000042` */
  id: string;
  /** Monotonic across markets. */
  seq: number;
  marketId: MarketId;
  at: number;
  /** One line, final product copy. */
  title: string;
  /** Extra lines, final product copy. */
  details: string[];
  tone: Tone;
  /** `true` when the UI should raise a toast (see `useRouteEvents`). */
  notify: boolean;
}

export interface RouteEstablishedEntry extends ActivityBase {
  kind: "route-established";
  toProviderId: ProviderId;
}
export interface RouteSwitchEntry extends ActivityBase {
  kind: "route-switch";
  fromProviderId: ProviderId | null;
  toProviderId: ProviderId;
  trigger: RouteTrigger;
}
export interface NoEligibleEntry extends ActivityBase {
  kind: "no-eligible";
  fromProviderId: ProviderId | null;
}
export interface SwitchScheduledEntry extends ActivityBase {
  kind: "switch-scheduled";
  fromProviderId: ProviderId;
  toProviderId: ProviderId;
  executeAt: number;
}
export interface SwitchCancelledEntry extends ActivityBase {
  kind: "switch-cancelled";
  toProviderId: ProviderId;
}
export interface PinViolationEntry extends ActivityBase {
  kind: "pin-violation";
  providerId: ProviderId;
  reasons: string[];
}
export interface PinRecoveredEntry extends ActivityBase {
  kind: "pin-recovered";
  providerId: ProviderId;
}
export interface RequestServedEntry extends ActivityBase {
  kind: "request-served";
  requestId: string;
  providerId: ProviderId;
  latencyMs: number;
  cost: number;
}
export interface RequestFailedEntry extends ActivityBase {
  kind: "request-failed";
  requestId: string;
  providerId: ProviderId;
  error: { code: number; message: string };
}
export interface RequestRejectedEntry extends ActivityBase {
  kind: "request-rejected";
  requestId: string;
}
export interface BidUpdatedEntry extends ActivityBase {
  kind: "bid-updated";
  providerId: ProviderId;
  from: number;
  to: number;
}
export interface ConditionChange {
  field: keyof ProviderConditions;
  from: number | boolean;
  to: number | boolean;
}
export interface ConditionsUpdatedEntry extends ActivityBase {
  kind: "conditions-updated";
  providerId: ProviderId;
  changes: ConditionChange[];
}
export interface ProviderRestoredEntry extends ActivityBase {
  kind: "provider-restored";
  providerId: ProviderId;
}
export interface ConditionsResetEntry extends ActivityBase {
  kind: "conditions-reset";
}
export interface PolicyChange {
  field: keyof Omit<RoutingPolicy, "mode">;
  from: number | RoutingPreference;
  to: number | RoutingPreference;
}
export interface PolicyUpdatedEntry extends ActivityBase {
  kind: "policy-updated";
  changes: PolicyChange[];
}
export interface PolicyResetEntry extends ActivityBase {
  kind: "policy-reset";
}
export interface PolicyRestoredEntry extends ActivityBase {
  kind: "policy-restored";
}
export interface ModeChangedEntry extends ActivityBase {
  kind: "mode-changed";
  mode: RoutingMode;
}
export interface AutoRunEntry extends ActivityBase {
  kind: "auto-run";
  enabled: boolean;
}

/** Activity log entry, discriminated by `kind`. */
export type ActivityEntry =
  | RouteEstablishedEntry
  | RouteSwitchEntry
  | NoEligibleEntry
  | SwitchScheduledEntry
  | SwitchCancelledEntry
  | PinViolationEntry
  | PinRecoveredEntry
  | RequestServedEntry
  | RequestFailedEntry
  | RequestRejectedEntry
  | BidUpdatedEntry
  | ConditionsUpdatedEntry
  | ProviderRestoredEntry
  | ConditionsResetEntry
  | PolicyUpdatedEntry
  | PolicyResetEntry
  | PolicyRestoredEntry
  | ModeChangedEntry
  | AutoRunEntry;

/** Activity kinds that `useRouteEvents` reports. */
export type RouteEventKind = "route-switch" | "no-eligible" | "pin-violation";

/** Entry reported by `useRouteEvents` (toasts). */
export type RouteEvent = Extract<ActivityEntry, { kind: RouteEventKind }>;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Runtime state of a provider in a market. */
export interface ProviderState {
  id: ProviderId;
  conditions: ProviderConditions;
  /** Monitor samples, oldest first (≤ HISTORY_LIMIT). */
  history: ProviderSample[];
  /** Request latencies, oldest first (≤ LATENCY_LIMIT). */
  latencies: LatencySample[];
}

export interface RequestCounters {
  /** Every `runRequest` call (served + failed + rejected). */
  total: number;
  served: number;
  failed: number;
  rejected: number;
}

/** State of one market. */
export interface MarketState {
  id: MarketId;
  policy: RoutingPolicy;
  /** In fixture order. */
  providers: ProviderState[];
  route: RouteState;
  /** Newest first (≤ REQUEST_LOG_LIMIT). */
  requests: RequestResult[];
  counters: RequestCounters;
  /** Total USD spent on served requests. */
  spend: number;
  /** Newest first (≤ ACTIVITY_LIMIT). */
  activity: ActivityEntry[];
  /** Oldest first (≤ SERIES_LIMIT). */
  series: SeriesPoint[];
  autoRun: boolean;
  /** Next auto-run request time (ms) while `autoRun` is on. */
  nextAutoRunAt: number | null;
  /** Origin of the deterministic market signal (rebased with all timestamps). */
  signalOrigin: number;
  /** Seeded PRNG state (uint32) for this market. */
  rng: number;
}

/** Whole engine state. */
export interface TenderState {
  /** Store clock (ms). */
  now: number;
  markets: Record<MarketId, MarketState>;
  /** Next activity sequence number. */
  nextActivitySeq: number;
  /** Next request sequence number. */
  nextRequestSeq: number;
  /** `true` after timestamps were rebased to the wall clock. */
  rebased: boolean;
  /** `true` after persisted policies were applied. */
  policiesHydrated: boolean;
}

// ---------------------------------------------------------------------------
// Views (derived)
// ---------------------------------------------------------------------------

/** Routing role of a provider in the table. */
export type RoutingRole = "active" | "standby" | "excluded" | "pinned" | "pinned-failing";

/** One provider row, ready to render. */
export interface ProviderRow extends ProviderIdentity {
  identity: ProviderIdentity;
  conditions: ProviderConditions;
  defaults: ProviderConditions;
  /** 1 − errorRate. */
  successRate: number;
  evaluation: ProviderEvaluation;
  status: QualificationStatus;
  /** "Eligible", "Too slow", … */
  statusLabel: string;
  role: RoutingRole;
  /** Serves requests now (auto active or pinned). */
  isActive: boolean;
  isRecommended: boolean;
  isBestPrice: boolean;
  /** Target of a pending optimization switch. */
  isPendingTarget: boolean;
  /** Conditions differ from fixture defaults. */
  modified: boolean;
  modifiedFields: (keyof ProviderConditions)[];
  /** Per-request cost of the current bid (USD). */
  requestPrice: number;
  history: ProviderSample[];
  latencies: LatencySample[];
}

export interface SummaryMetrics {
  activeProviderId: ProviderId | null;
  activeProviderName: string | null;
  /** Bid of the active provider (USD per 1M requests). */
  bidPrice: number | null;
  /** Per-request price of the active provider (USD). */
  requestPrice: number | null;
  p95LatencyMs: number | null;
  dataAgeMs: number | null;
  /** 0..1 */
  successRate: number | null;
  requests: RequestCounters;
  /** USD spent on served requests. */
  spend: number;
  /** Mean latency of recent served requests (ms). */
  avgLatencyMs: number | null;
}

export interface RouteView {
  activeProviderId: ProviderId | null;
  activeProvider: ProviderRow | null;
  mode: RoutingMode;
  since: number;
  lastSwitchAt: number;
  pending: PendingSwitchView | null;
}

/** Everything the UI renders for one market. */
export interface MarketView {
  id: MarketId;
  definition: MarketDefinition;
  policy: RoutingPolicy;
  defaultPolicy: RoutingPolicy;
  /** Policy (excluding mode) differs from the default. */
  policyModified: boolean;
  modifiedPolicyFields: (keyof RoutingPolicy)[];
  /** Display order: active first, then qualified by rank, then excluded. */
  providers: ProviderRow[];
  providersById: Record<ProviderId, ProviderRow>;
  qualifiedCount: number;
  excludedCount: number;
  route: RouteView;
  decision: RoutingDecision;
  recommended: ProviderRow | null;
  bestPrice: ProviderRow | null;
  /** Newest request (any status) or `null`. */
  lastResult: RequestResult | null;
  /** Newest served request or `null`. */
  lastServed: ServedRequestResult | null;
  /** Newest first. */
  recentResults: RequestResult[];
  metrics: SummaryMetrics;
  /** Newest first (≤ 200). */
  activity: ActivityEntry[];
  /** Oldest first. */
  series: SeriesPoint[];
  autoRun: boolean;
  /** Some provider differs from its defaults. */
  conditionsModified: boolean;
}
