/**
 * Server-safe entry point of the Tender engine: types, static market
 * definitions, formatting, evaluation, the pure reducer, and selectors.
 * Client hooks live in `@/lib/tender/client`.
 */
export type * from "./types";

export * from "./constants";
export {
  BTC_USD,
  BTC_USD_DEFAULT_POLICY,
  BTC_USD_PROVIDERS,
  DEFAULT_MARKET_ID,
  fromDisplayValue,
  getDefaultPolicy,
  getMarketDefinition,
  getProviderFixture,
  isMarketId,
  MARKET_IDS,
  MARKETS,
  SF_WEATHER,
  SF_WEATHER_DEFAULT_POLICY,
  SF_WEATHER_PROVIDERS,
  toDisplayValue,
} from "./fixtures";
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
export { pinViolationText, providerName } from "./activity";
export { createInitialState, rebaseState, reduce } from "./engine";
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
export { sanitizePolicy, sanitizePolicyPatch, sanitizeConditionsPatch } from "./sanitize";
export { getApiSnippets, getResponseJson } from "./snippets";
export { getInitialMarketView, getInitialState } from "./sample-state";
export { BTC_BASELINE_PRICE, btcPriceAt, SF_BASELINE, SF_LOCATION, weatherAt } from "./signals";
export type { WeatherState } from "./signals";
export {
  anchoredBtcPriceAt,
  anchoredWeatherAt,
  btcProviderPrice,
  sampleDataAge,
  sampleLatency,
  sampleRequest,
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
