/**
 * Server-safe entry point of the Tender engine: types, market definitions
 * (built from `@/lib/registry`), formatting, evaluation, the pure reducer, selectors, and
 * stateless route selection for Route Handlers. Never imports React or zustand.
 * Client hooks live in `@/lib/tender/client`. Reference: `./README.md`.
 */
export type * from "./types";

export * from "./constants";
export {
  BTC_USD,
  BTC_USD_DEFAULT_POLICY,
  BTC_USD_PROVIDERS,
  buildMarketDefinition,
  dataDelayStepMs,
  DEFAULT_MARKET_ID,
  fromDisplayValue,
  getDefaultPolicy,
  getMarketDefinition,
  getProviderFixture,
  isMarketId,
  latencyStepMs,
  MARKET_IDS,
  MARKETS,
  niceCeil,
  seriesFieldOf,
  SF_WEATHER,
  SF_WEATHER_DEFAULT_POLICY,
  SF_WEATHER_PROVIDERS,
  timeZoneLabel,
  toDisplayValue,
} from "./markets";
export * as format from "./format";
export {
  CHECK_LABELS,
  CHECK_ORDER,
  CHECK_STATUS,
  checkMessage,
  compareProviders,
  evaluateMarket,
  evaluateProvider,
  PREFERENCE_LABELS,
  PREFERENCES,
  preferenceKey,
  qualificationLines,
  runChecks,
  STATUS_LABELS,
  STATUS_PRIORITY,
  statusPriority,
  successRateOf,
} from "./evaluate";
export type { RankableProvider } from "./evaluate";
export { fieldsSummary, NO_ELIGIBLE_TEXT, pinViolationText, providerName, recommendedSummaryText } from "./activity";
export { createInitialState, marketSeed, rebaseState, reduce, seriesStepMs } from "./engine";
export type { InitialStateOptions, TenderAction } from "./engine";
export { evaluateMarketState } from "./router";
export {
  buildRoutingDecision,
  formatPendingSwitch,
  pendingSecondsRemaining,
  selectMarketView,
  selectMarketViewFromState,
  servingProviderId,
  sortRows,
} from "./selectors";
export { parsePersistedPolicies, policiesChanged, serializePolicies } from "./persistence";
export type { PersistedPolicies } from "./persistence";
export { sanitizeConditionsPatch, sanitizeMode, sanitizePolicy, sanitizePolicyPatch } from "./sanitize";
export { getApiSnippets, getResponseJson, resultData, resultField, sampleResponseJson } from "./snippets";
export { getInitialMarketView, getInitialState } from "./sample-state";
export { BTC_BASELINE_PRICE, btcPriceAt, conditionLabel, SF_BASELINE, SF_LOCATION, weatherAt } from "./signals";
export type { WeatherState } from "./signals";
export {
  anchoredBtcPriceAt,
  anchoredWeatherAt,
  btcProviderPrice,
  dewPointF,
  fieldsPayload,
  payloadKindOf,
  sampleDataAge,
  sampleLatency,
  sampleRequest,
  seriesValue,
  seriesValueOf,
  signalReference,
  weatherPayload,
} from "./requests";
export type { AnchoredWeather, RequestSampleInput } from "./requests";
export { executeSelection, getDefaultConditions, routeRequest, selectRoute } from "./selection";
export type {
  ConditionsById,
  ExecuteSelectionOptions,
  RouteSelection,
  RouteSelectionKind,
  SelectionCandidate,
  SelectionExecution,
  SelectRouteOptions,
} from "./selection";
export { createRng, hash01, hashNormal, mulberry32, seedFromString } from "./random";
export type { Rng } from "./random";
export { formatRequestId } from "./context";
