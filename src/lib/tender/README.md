# Tender engine (`src/lib/tender`)

The engine behind every market page: market definitions built from the registry (`@/lib/registry`), evaluation, the routing state
machine, deterministic request execution, monitoring, activity copy, formatting,
persistence, and the client store. This file is the API reference; `docs/SPEC.md`
§5 is synced from it.

Two entry points:

| Import | Where | Contents |
| --- | --- | --- |
| `@/lib/tender` | Server and client | Types, market definitions, `format`, evaluation, pure reducer, selectors, stateless route selection, request sampling. Never imports React or zustand. |
| `@/lib/tender/client` | `"use client"` only | `<TenderProvider>`, store, hooks. |

Conventions: timestamps are epoch milliseconds; prices are bids in **USD per 1M
requests** (`bidPrice`, `maxPrice`); per-request cost is `bid / 1e6`; rates
(`errorRate`, `minSuccessRate`, `successRate`) are ratios `0..1`; durations are
milliseconds (`p95LatencyMs`, `dataAgeMs`).

---

## Client: `@/lib/tender/client`

```tsx
// src/app/layout.tsx
import { TenderProvider } from "@/lib/tender/client";
<TenderProvider>{children}</TenderProvider>

// any client component
"use client";
import { useMarketView, useNow, useTenderActions, useRouteEvents } from "@/lib/tender/client";
import { format } from "@/lib/tender";

const view = useMarketView("sf-weather");
const { runRequest, updateProvider } = useTenderActions();
```

### `<TenderProvider store?>`

Mount once in the root layout. It creates the store once, then after mount:
rebases every timestamp from `FIXTURE_EPOCH` to `Date.now()`, rehydrates policies
from `localStorage["tender:v1:policies"]` (and re-evaluates), persists policy
changes, runs the 1 s clock tick (which also drives auto-run every 2 s per
market), the 5 s monitor tick, and a timer that executes pending switches exactly
when due. Server render and first client render use the same fixture state, so
there are no hydration mismatches.

Props: `{ children: ReactNode; store?: TenderStore }` (`store` for tests/previews).

### Hooks

| Hook | Returns | Re-renders |
| --- | --- | --- |
| `useMarketView(marketId)` | `MarketView` (memoized per market state). Watches the market while mounted. | When that market changes (actions, 5 s monitor), **not** on the 1 s clock. |
| `useWatchMarket(marketId)` | `void`: keeps the market in the 5 s monitor while mounted (ref-counted). Only watched markets and markets on auto-run are sampled; an idle market catches up its history when watched again. | Never. |
| `useNow()` | `number` store clock (ms) | Every second. Use it only where relative times/countdowns render. |
| `useTenderActions()` | `TenderActions` (stable object) | Never. |
| `useRouteEvents(marketId, onEvent)` | `void` | Never. Calls `onEvent(event: RouteEvent)` once per new route switch, no-eligible, or pinned violation (for toasts). Existing entries and entries written while restoring saved policies are not reported. `onEvent` may change between renders. |
| `usePendingSwitch(marketId)` | `{ providerId, providerName, executeAt, secondsRemaining, label } \| null` — `label` is "Switching to Slatework in 7 s — switch cooldown" | Every second while a switch is pending. |
| `useMarketIds()` | `readonly MarketId[]` (all 75 registry markets, registry order) | Never. |
| `useTenderSelector(selector)` | Raw `TenderState` selection (return a stable slice or primitive) | When the selection changes. |
| `useTenderStore()` | `TenderStore` | Never. |

### `TenderActions`

Every action stamps `now` from the wall clock (outside render) and runs through
the pure reducer. Patches are clamped to the market's input ranges.

```ts
runRequest(marketId): void
setAutoRun(marketId, enabled: boolean): void            // on: one request now, then every 2 s
setPolicy(marketId, patch: PolicyPatch): void          // Partial<Omit<RoutingPolicy, "mode">>; re-routes immediately
setRoutingMode(marketId, mode: RoutingMode): void      // { kind: "auto" } | { kind: "pinned", providerId }
resetPolicy(marketId): void                            // default policy and automatic mode
updateProvider(marketId, providerId, patch: ConditionsPatch): void   // Partial<ProviderConditions>
restoreProvider(marketId, providerId): void
resetConditions(marketId): void                        // every provider to fixture defaults; policy unchanged
switchToRecommended(marketId): void                    // pinned: pin rank 1; auto: switch to rank 1 now (skips cooldown)
ingestServed(source: RequestSource, envelopes: ServedEnvelope[]): void  // record server-served requests (Ask Tender, Run with credits); routing unchanged
```

### Store (tests, previews)

```ts
createTenderStore(options?: { initialState?: TenderState; clock?: () => number }): TenderStore
// TenderStore = { api: StoreApi<TenderState>; dispatch(action: TenderAction): void; actions: TenderActions; clock: () => number }
startTenderRuntime(store): () => void   // what <TenderProvider> runs in its effect; returns cleanup
```

---

## `MarketView` (what the UI renders)

`useMarketView(id)` / `selectMarketView(marketState)` / `getInitialMarketView(id)`.

```ts
interface MarketView {
  id: MarketId;
  definition: MarketDefinition;            // static: names, identifier, contract, time zone, inputs, code samples
  policy: RoutingPolicy;
  defaultPolicy: RoutingPolicy;
  policyModified: boolean;                 // policy (excluding mode) differs from default
  modifiedPolicyFields: (keyof RoutingPolicy)[];
  providers: ProviderRow[];                // display order: active, qualified by rank, excluded by status priority then price
  providersById: Record<ProviderId, ProviderRow>;
  qualifiedCount: number;
  excludedCount: number;
  route: RouteView;                        // { activeProviderId, activeProvider, mode, since, lastSwitchAt, pending }
  decision: RoutingDecision;               // routing decision callout
  recommended: ProviderRow | null;         // rank 1
  bestPrice: ProviderRow | null;           // lowest-priced qualified provider
  lastResult: RequestResult | null;        // newest request, any status
  lastServed: ServedRequestResult | null;
  recentResults: RequestResult[];          // newest first, ≤ 50
  metrics: SummaryMetrics;                 // active provider name, bid, request price, P95, data age, success rate, counters, spend, avg latency
  activity: ActivityEntry[];               // newest first, ≤ 200
  series: SeriesPoint[];                   // recent BTC price / temperature points, oldest first (≥ 40 seeded)
  autoRun: boolean;
  conditionsModified: boolean;             // some provider differs from defaults
}

interface ProviderRow extends ProviderIdentity {        // id, name, logo ("/providers/fernline.svg")
  identity: ProviderIdentity;
  conditions: ProviderConditions;          // current (what the monitor measures now)
  defaults: ProviderConditions;
  successRate: number;                     // 1 − errorRate
  evaluation: ProviderEvaluation;          // status, reasons (all failing checks), checks (all five), rank
  status: QualificationStatus;
  statusLabel: string;                     // "Eligible", "Too slow", …
  role: "active" | "standby" | "excluded" | "pinned" | "pinned-failing";
  isActive: boolean;                       // serves requests now
  isRecommended: boolean;
  isBestPrice: boolean;
  isPendingTarget: boolean;
  modified: boolean;
  modifiedFields: (keyof ProviderConditions)[];
  requestPrice: number;                    // USD per request
  history: ProviderSample[];               // 30 monitor samples (P95, data age, success rate, bid, available)
  latencies: LatencySample[];              // latencies of requests it served/failed, ≤ 30
}

interface RoutingDecision {
  kind: "routing" | "pending-switch" | "no-eligible" | "pinned" | "pinned-failing";
  tone: "neutral" | "positive" | "warning" | "negative";
  title: string;                           // "Routing to Fernline"
  summary: string;                         // one sentence
  details: string[];                       // check lines, cheaper-but-excluded lines, best price
  activeProviderId: ProviderId | null;
  recommendedProviderId: ProviderId | null;
  pending: PendingSwitchView | null;       // countdown: formatPendingSwitch(pending, now)
  actions: ({ kind: "switch-to-recommended"; providerId; label } | { kind: "use-automatic"; label })[];
}
```

`ActivityEntry` is discriminated by `kind`: `route-established`, `route-switch`
(`fromProviderId`, `toProviderId`, `trigger`), `no-eligible`, `switch-scheduled`,
`switch-cancelled`, `pin-violation`, `pin-recovered`, `request-served`,
`request-failed`, `request-rejected`, `bid-updated`, `conditions-updated`,
`provider-restored`, `conditions-reset`, `policy-updated`, `policy-reset`,
`policy-restored`, `mode-changed`, `auto-run`. Every entry has `id`, `seq`,
`marketId`, `at`, `title`, `details[]`, `tone`, `notify` — final product copy.
Route switch details state the trigger (failing check with value vs limit) and
why the replacement qualifies (all four checks with value vs limit).

`RequestResult` is discriminated by `status` (`"ok" | "failed" | "rejected"`), then
by `payload.kind`: `"weather"` (`weather.current`), `"btc"` (`prices.spot`), or `"fields"`
(`FieldsPayload`: `contractId`, schema-shaped `values`, `sourceTimestamp`, `change`) for every other contract.
The chart value is `seriesValue(result)`: temperature, spot price, or `values[definition.seriesField]`
(`null` when the contract has no series field, so the market has no chart).

---

## Server-safe: `@/lib/tender`

### Markets (built from the registry)

```ts
MARKET_IDS: readonly MarketId[]           // registry order (MARKET_SPECS)
MARKETS: Record<MarketId, MarketDefinition>
DEFAULT_MARKET_ID: "sf-weather"
isMarketId(value: unknown): value is MarketId
getMarketDefinition(marketId): MarketDefinition
getProviderFixture(marketId, providerId): ProviderFixture | undefined
getDefaultPolicy(marketId): RoutingPolicy                     // fresh copy
getDefaultConditions(marketId): Record<ProviderId, ProviderConditions>
toDisplayValue(spec: NumericInputSpec, value): number           // 900000 ms → 15 (min), 0.995 → 99.5 (%)
fromDisplayValue(spec: NumericInputSpec, display): number
SF_WEATHER, BTC_USD, *_DEFAULT_POLICY, *_PROVIDERS
```

`MarketDefinition`: `id`, `contractId`, `categoryId`, `name`, `shortName`, `identifier`
(`{namespace}/{market id}`, e.g. `weather/sf-weather`), `contract` (`weather.current({ location: "san-francisco" })`),
`contractUrl`, `description`, `timeZone` (IANA), `timeZoneLabel`, `icon` (lucide name: market icon, else
category icon), `units` (`dataAge` from `contract.freshness.unit`), `seriesField` (chart field or `null`),
`priceDefinition?` (price-view contracts), `resultFields` (contract output), `defaultPolicy`,
`policyInputs` / `conditionInputs` (`NumericInputSpec`: `label`, `prefix?`, `unit`, `min`, `max`, `step`,
`decimals`, `factor`, `hint`; minute-unit contracts use the weather template, millisecond-unit contracts the
spot template, widened to fit the listings), `providers` (registry listings), `codeSamples`, `sampleResponse`.

Default policy: the fifteen markets that ran before the registry keep theirs (`POLICY_OVERRIDES` in
`markets.ts`). Others: max price = nice ≥ 1.5 × median bid, max P95 = nice ≥ 1.5 × median P95,
max data age = nice ≥ 2 × median data age, min success 99.5% (99.9% for `prices.spot`), lowest cost, automatic.
`latencyStepMs(id)` / `dataDelayStepMs(id)`: scenario steps (300 ms / 15 min for minute-unit markets, else 100 ms / 1 s).

### Evaluation

```ts
evaluateMarket(providers: { id; name; conditions }[], policy): MarketEvaluation
  // { byId: Record<id, ProviderEvaluation>; ranking: id[]; recommendedId; bestPriceId }
evaluateProvider(providerId, conditions, policy): ProviderEvaluation     // without rank/markers
runChecks(conditions, policy): CheckResult[]                             // all five, priority order
checkMessage(check, value, limit, passed): string   // "P95 640 ms exceeds 400 ms" / "P95 180 ms ≤ 400 ms"
qualificationLines(conditions, policy): string[]    // price, latency, data age, success lines
compareProviders(a, b, preference): number          // ranking comparator with tie-breakers, then name
preferenceKey(preference), successRateOf(conditions), statusPriority(status)
STATUS_PRIORITY, STATUS_LABELS, CHECK_ORDER, CHECK_STATUS, CHECK_LABELS, PREFERENCES, PREFERENCE_LABELS
evaluateMarketState(marketState): MarketEvaluation
```

### Stateless route selection (Route Handlers)

No route history: automatic mode always selects rank 1 (no cooldown). Select
once, quote the selection, execute the same object.

```ts
selectRoute(marketId, options?: {
  policy?: Partial<RoutingPolicy>;     // merged over the default policy
  pin?: ProviderId | null;             // pin (overrides policy.mode); null forces automatic
  conditions?: Partial<Record<ProviderId, ProviderConditions>>;   // default: fixture defaults
}): RouteSelection
// RouteSelection: { marketId, kind: "recommended" | "pinned" | "pinned-failing" | "no-eligible", policy,
//   providerId, provider, conditions, bidPrice, requestPrice, recommendedId, bestPriceId, ranking,
//   candidates: SelectionCandidate[], evaluation, policyViolation, violations, summary, details }

executeSelection(selection, options: {
  now: number; seed: number; requestId?: string;
  reference?: MarketReference | null;   // upstream SF conditions / BTC spot; default: deterministic signal
  signalOrigin?: number;                // default FIXTURE_EPOCH
  previousValue?: number | null;        // spot changeUsd / fields change
}): SelectionExecution   // { selection, result: RequestResult, rng, reference: { source: "upstream" | "signal", at, value } }

routeRequest(marketId, selectOptions & executeOptions): SelectionExecution
```

`MarketReference` = `WeatherReference` (`kind: "weather"`, optional `at`,
`temperatureF`, `feelsLikeF`, `condition`, `humidityPct`, `windMph`,
`windDirectionDeg`, `pressureHpa`, `visibilityMi`, `dewPointF`, `cloudCoverPct`;
missing fields use the signal) | `BtcReference` (`kind: "btc"`, optional `at`,
`priceUsd`). The payload is the reference moved by the signal's drift between
`reference.at` and the provider observation time, plus the provider's bias.
Payload `observedAt` / `sourceTimestamp` are always the provider observation time
(`now − dataAgeMs`); the upstream time is reported separately in
`execution.reference.at`.

### Request sampling and signals

```ts
sampleRequest(input: RequestSampleInput): { result: RequestResult; rng: number }
  // { marketId, providerId | null, conditions?, requestId, now, seed, routingMode?, signalOrigin?, previousValue?, reference? }
sampleLatency(rng, p95LatencyMs): number    // ~95% ≤ P95, rest ≤ 1.35×, median ≈ 0.6×
sampleDataAge(rng, dataAgeMs, marketId): number   // ± 20%
weatherPayload(observedAt, origin, bias, reference?, referenceAt?): WeatherPayload
btcProviderPrice(sourceTimestamp, origin, bias, reference?, referenceAt?): number
anchoredWeatherAt(...), anchoredBtcPriceAt(...), signalReference(marketId, at, origin?): MarketReference
weatherAt(at, origin), btcPriceAt(at, origin), conditionLabel(cloudCoverPct), dewPointF(tempF, humidityPct)
SF_BASELINE, SF_LOCATION, BTC_BASELINE_PRICE
createRng(seed): Rng, mulberry32(state), seedFromString(text), hash01, hashNormal
formatRequestId(seq): string                // 123 → "req_000123"
```

Failures: unavailable → `503 Service Unavailable`; otherwise probability
`errorRate` → 500/502/504. No route → `{ status: "rejected", reason: "No eligible provider" }`.

### Pure engine

```ts
createInitialState(options?: { epoch?: number; seed?: number }): TenderState   // fixed at FIXTURE_EPOCH
reduce(state, action: TenderAction): TenderState                               // pure; same input ⇒ same output
rebaseState(state, now): TenderState                                           // shift all timestamps, keep ages
selectMarketView(marketState), selectMarketViewFromState(state, marketId)
getInitialState(), getInitialMarketView(marketId)                              // static previews
buildRoutingDecision, sortRows, servingProviderId, formatPendingSwitch(pending, now), pendingSecondsRemaining(pending, now)
```

`TenderAction` (every action carries `now`): `rebase`, `tick`, `monitor`,
`run-request`, `set-auto-run`, `set-policy`, `set-routing-mode`, `reset-policy`,
`update-provider`, `restore-provider`, `reset-conditions`, `switch-to-recommended`,
`hydrate-policies`.

Routing rules (automatic mode): failover is immediate; policy and mode changes
re-route immediately; an optimization switch (another provider outranks the
active one after a bid/condition change) waits until 10 s after the last switch
and is kept as `route.pending` until the tick executes it, or cancelled if the
advantage disappears; with no qualifying provider the route is `null` and
requests are rejected until one qualifies again. Pinned mode never switches by
itself; violations are logged and notified once per distinct set of failing checks.

### Persistence and validation

```ts
POLICIES_STORAGE_KEY = "tender:v1:policies"
serializePolicies(state): string            // { version: 1, policies: Partial<Record<MarketId, RoutingPolicy>> } — changed policies only
parsePersistedPolicies(raw): Partial<Record<MarketId, RoutingPolicy>>   // invalid input → {}
policiesChanged(a, b): boolean
sanitizePolicy(marketId, value: unknown): RoutingPolicy | null          // missing/invalid fields → defaults
sanitizePolicyPatch(marketId, patch), sanitizeConditionsPatch(marketId, patch), sanitizeMode(marketId, value)
```

### Formatting (`format.*`)

All pure and hydration-safe (`en-US`, explicit time zones).

```ts
format.price(18)                 // "$18.00"          format.priceWithUnit(18) // "$18.00 /M req"; format.priceUnit
format.requestCost(18)           // "$0.000018"       format.cost(0.0000007)   // "$0.0000007"
format.usd(75230.75)             // "$75,230.75"      format.signedUsd(-3.1)   // "−$3.10"; format.signedPercent(0.012) // "+0.01%"
format.latency(210)              // "210 ms"          format.latency(1200)     // "1.2 s"
format.dataAge(220)              // "220 ms"  2400 → "2.4 s"  360000 → "6 min"  4320000 → "1 h 12 min" (alias format.duration)
format.percent(0.9994)           // "99.94%"          format.errorRate(0.0006) // "0.06%"
format.temperature(61.2)         // "61°F"            format.compass(278)      // "W"
format.number(v, decimals), format.count(1234) // "1,234"
format.time(ms, "America/Los_Angeles")   // "10:42 AM PT" ({ seconds: true } → "10:42:07 AM PT")
format.time(ms, "UTC")                   // "18:04:31.220 UTC"
format.dateTime(ms, timeZone)            // "Nov 9, 10:42 AM PT"
format.isoTimestamp(ms), format.timeZoneLabel(timeZone)
format.relativeTime(at, now)             // "12 s ago", "just now", "in 7 s"
format.countdown(at, now)                // "7 s"
```

### Copy helpers and code samples

```ts
providerName(marketId, providerId), pinViolationText(marketId, providerId, reasons)
recommendedSummaryText(preference, name), NO_ELIGIBLE_TEXT
getApiSnippets({ id }, policy): CodeSample[]     // TypeScript (@heyarca/tender) + Python (HTTP) with the current policy
getResponseJson({ id }, result): string          // JSON body for a RequestResult, in the HTTP API shape
resultData(result), resultField(result, key)     // contract-shaped `data` of a served result
```

### Constants

`FIXTURE_EPOCH` (2026-11-09T18:30:00Z), `SWITCH_COOLDOWN_MS` 10 000,
`MONITOR_INTERVAL_MS` 5 000, `CLOCK_TICK_MS` 1 000, `AUTO_RUN_INTERVAL_MS` 2 000,
`HISTORY_LIMIT` 30, `LATENCY_LIMIT` 30, `REQUEST_LOG_LIMIT` 50, `ACTIVITY_LIMIT` 200,
`SERIES_LIMIT` 60, `SERIES_SEED_POINTS` 40, `PRICE_UNIT` "/M req".

---

## Files

| File | Role |
| --- | --- |
| `types.ts` | All domain, state, and view types |
| `constants.ts` | Timing, caps, storage key |
| `random.ts` | Seeded PRNG (mulberry32), hashes |
| `markets.ts` | Market definitions from the registry: providers, inputs, default policies (legacy overrides) |
| `evaluate.ts` | Qualification, reasons, ranking, best price |
| `router.ts` | Routing state machine |
| `requests.ts` | Request sampling, payloads, reference anchoring |
| `signals.ts` | Deterministic BTC walk, weather drift, and per-market series drift (baselines from registry samples) |
| `monitor.ts` | Monitor samples and history |
| `activity.ts` | Activity entry builders (final copy) |
| `context.ts` | Per-step id counters |
| `engine.ts` | `createInitialState`, `reduce`, `rebaseState` |
| `selectors.ts` | `MarketView`, routing decision |
| `selection.ts` | Stateless `selectRoute` / `executeSelection` for server code |
| `persistence.ts`, `sanitize.ts` | Policy storage and input validation |
| `snippets.ts` | API dialog code samples and JSON |
| `sample-state.ts` | Initial state/view for static previews |
| `format.ts` | Display formatting |
| `store.tsx`, `client.ts` | Client store, provider, hooks |
| `*.test.ts(x)` | Vitest suites (`bun run test`) |
