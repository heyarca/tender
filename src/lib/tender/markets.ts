/**
 * Market definitions built from the registry (`@/lib/registry`). Server-safe.
 *
 * Every registry market becomes the engine's `MarketDefinition`: providers from its listings,
 * policy and condition inputs by the contract's freshness unit (the weather "min" and spot "ms"
 * templates, widened to fit the listings), and a default policy derived from the listings.
 * The fifteen markets that ran before the registry keep their default policies (see `POLICY_OVERRIDES`).
 */
import {
  contractCall,
  contractUrl,
  getCategory,
  getContract,
  getMarketSpec,
  getProvider,
  isRegisteredMarket,
  MARKET_SPECS,
  type ContractSpec,
  type MarketSpec,
} from "@/lib/registry";
import { FIXTURE_EPOCH, PRICE_UNIT } from "./constants";
import { timeZoneLabel } from "./time-zone";
export { timeZoneLabel } from "./time-zone";
import { getApiSnippets, sampleResponseJson } from "./snippets";
import type {
  ConditionInputSpecs,
  MarketDefinition,
  MarketId,
  NumericInputSpec,
  PolicyInputSpecs,
  ProviderFixture,
  ProviderId,
  RoutingPolicy,
} from "./types";

const MIN = 60_000;

// ---------------------------------------------------------------------------
// Default policies
// ---------------------------------------------------------------------------

type PolicyLimits = Pick<RoutingPolicy, "maxPrice" | "maxP95LatencyMs" | "maxDataAgeMs" | "minSuccessRate">;

const WEATHER_POLICY: PolicyLimits = { maxPrice: 40, maxP95LatencyMs: 400, maxDataAgeMs: 15 * MIN, minSuccessRate: 0.995 };
const SPOT_POLICY: PolicyLimits = { maxPrice: 2, maxP95LatencyMs: 150, maxDataAgeMs: 1000, minSuccessRate: 0.999 };

/** Default policies of the markets that ran before the registry, kept exactly. */
const POLICY_OVERRIDES: Readonly<Record<MarketId, PolicyLimits>> = {
  "sf-weather": WEATHER_POLICY,
  "ny-weather": WEATHER_POLICY,
  "london-weather": WEATHER_POLICY,
  "seoul-weather": WEATHER_POLICY,
  "tokyo-weather": WEATHER_POLICY,
  "singapore-weather": WEATHER_POLICY,
  "btc-usd": SPOT_POLICY,
  "eth-usd": SPOT_POLICY,
  "sol-usd": SPOT_POLICY,
  "xrp-usd": SPOT_POLICY,
  "eur-usd": SPOT_POLICY,
  "gbp-usd": SPOT_POLICY,
  "sz-mlcc": { maxPrice: 60, maxP95LatencyMs: 800, maxDataAgeMs: 60 * MIN, minSuccessRate: 0.99 },
  "lithium-carbonate": { maxPrice: 80, maxP95LatencyMs: 600, maxDataAgeMs: 30 * MIN, minSuccessRate: 0.995 },
  "freight-sha-lax": { maxPrice: 50, maxP95LatencyMs: 900, maxDataAgeMs: 120 * MIN, minSuccessRate: 0.99 },
};

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Smallest "nice" number (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ) that is ≥ `value`. */
export function niceCeil(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return 0;
  const base = 10 ** Math.floor(Math.log10(value));
  for (const step of NICE_STEPS) {
    const nice = Number((step * base).toPrecision(12));
    if (nice >= value * (1 - 1e-12)) return nice;
  }
  return Number((10 * base).toPrecision(12));
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Default limits from the listings: max price ≥ 1.5 × median bid, max P95 ≥ 1.5 × median P95,
 * max data age ≥ 2 × median data age (whole minutes for minute-unit contracts), all rounded up
 * to a nice number; min success rate 99.9% for spot prices, else 99.5%.
 */
function derivedPolicy(spec: MarketSpec, contract: ContractSpec): PolicyLimits {
  const listings = spec.listings;
  const age = 2 * median(listings.map((l) => l.dataAgeMs));
  return {
    maxPrice: niceCeil(1.5 * median(listings.map((l) => l.bidPrice))),
    maxP95LatencyMs: niceCeil(1.5 * median(listings.map((l) => l.p95LatencyMs))),
    maxDataAgeMs: contract.freshness.unit === "min" ? niceCeil(Math.max(1, age / MIN)) * MIN : niceCeil(Math.max(10, age)),
    minSuccessRate: contract.id === "prices.spot" ? 0.999 : 0.995,
  };
}

// ---------------------------------------------------------------------------
// Input specs
// ---------------------------------------------------------------------------

const SUCCESS_RATE: NumericInputSpec = {
  label: "Min success rate",
  unit: "%",
  min: 90,
  max: 100,
  step: 0.01,
  decimals: 2,
  factor: 0.01,
  hint: "Share of requests that must succeed.",
};
const ERROR_RATE: NumericInputSpec = {
  label: "Error rate",
  unit: "%",
  min: 0,
  max: 20,
  step: 0.01,
  decimals: 2,
  factor: 0.01,
  hint: "Share of requests that fail.",
};
const PRICE_HINT = "Highest bid you accept, in USD per 1M requests.";
const BID_HINT = "What the provider charges, in USD per 1M requests.";
const P95_HINT = "95% of requests must finish within this time.";

interface InputTemplate {
  policy: PolicyInputSpecs;
  conditions: ConditionInputSpecs;
}

/** Inputs of minute-unit contracts (the weather template). */
const MINUTE_TEMPLATE: InputTemplate = {
  policy: {
    maxPrice: { label: "Max price", prefix: "$", unit: PRICE_UNIT, min: 0, max: 100, step: 0.5, decimals: 2, factor: 1, hint: PRICE_HINT },
    maxP95LatencyMs: { label: "Max P95 latency", unit: "ms", min: 50, max: 2000, step: 10, decimals: 0, factor: 1, hint: P95_HINT },
    maxDataAgeMs: { label: "Max data age", unit: "min", min: 1, max: 120, step: 1, decimals: 0, factor: MIN, hint: "" },
    minSuccessRate: SUCCESS_RATE,
  },
  conditions: {
    bidPrice: { label: "Bid", prefix: "$", unit: PRICE_UNIT, min: 0.5, max: 200, step: 0.5, decimals: 2, factor: 1, hint: BID_HINT },
    p95LatencyMs: { label: "P95 latency", unit: "ms", min: 10, max: 3000, step: 10, decimals: 0, factor: 1, hint: "95th percentile request latency." },
    dataAgeMs: { label: "Data age", unit: "min", min: 0, max: 240, step: 1, decimals: 0, factor: MIN, hint: "" },
    errorRate: ERROR_RATE,
  },
};

/** Inputs of millisecond-unit contracts (the spot price template). */
const MILLISECOND_TEMPLATE: InputTemplate = {
  policy: {
    maxPrice: { label: "Max price", prefix: "$", unit: PRICE_UNIT, min: 0, max: 10, step: 0.05, decimals: 2, factor: 1, hint: PRICE_HINT },
    maxP95LatencyMs: { label: "Max P95 latency", unit: "ms", min: 10, max: 1000, step: 5, decimals: 0, factor: 1, hint: P95_HINT },
    maxDataAgeMs: { label: "Max data age", unit: "ms", min: 10, max: 10_000, step: 10, decimals: 0, factor: 1, hint: "" },
    minSuccessRate: SUCCESS_RATE,
  },
  conditions: {
    bidPrice: { label: "Bid", prefix: "$", unit: PRICE_UNIT, min: 0.05, max: 20, step: 0.05, decimals: 2, factor: 1, hint: BID_HINT },
    p95LatencyMs: { label: "P95 latency", unit: "ms", min: 5, max: 2000, step: 1, decimals: 0, factor: 1, hint: "95th percentile request latency." },
    dataAgeMs: { label: "Data age", unit: "ms", min: 0, max: 60_000, step: 10, decimals: 0, factor: 1, hint: "" },
    errorRate: ERROR_RATE,
  },
};

/** What the data age measures, for input hints ("Oldest observation you accept …"). */
const FRESHNESS_NOUNS: Readonly<Record<string, string>> = {
  "Observation age": "observation",
  "Quote age": "quote",
  "Rate age": "rate",
  "Status age": "status update",
  "Event age": "tracking event",
  "Traffic age": "traffic reading",
  "List age": "list update",
  "Index age": "index update",
  "Crawl age": "crawl",
  "Score age": "score update",
};

function freshnessNoun(contract: ContractSpec): string {
  if (contract.id === "prices.spot") return "price";
  return FRESHNESS_NOUNS[contract.freshness.label] ?? "data";
}

/** Raise `max` (display units) so it covers `needed` (engine units). */
function widen(spec: NumericInputSpec, needed: number): NumericInputSpec {
  const display = needed / spec.factor;
  return display > spec.max ? { ...spec, max: niceCeil(display) } : spec;
}

function inputsFor(spec: MarketSpec, contract: ContractSpec, policy: PolicyLimits): InputTemplate {
  const template = contract.freshness.unit === "min" ? MINUTE_TEMPLATE : MILLISECOND_TEMPLATE;
  const bids = spec.listings.map((l) => l.bidPrice);
  const p95s = spec.listings.map((l) => l.p95LatencyMs);
  const ages = spec.listings.map((l) => l.dataAgeMs);
  const maxOf = (values: number[]) => Math.max(0, ...values);
  const noun = freshnessNoun(contract);

  // Bids: room to raise every bid 50% in the policy and triple it in the conditions; fine steps for small bids.
  let maxPrice = widen(template.policy.maxPrice, Math.max(1.5 * maxOf(bids), 2 * policy.maxPrice));
  let bidPrice = widen(template.conditions.bidPrice, 3 * maxOf(bids));
  if (Math.min(...bids) / 2 < bidPrice.min) {
    bidPrice = { ...bidPrice, min: 0.01, step: 0.01 };
    if (maxPrice.step > 0.05) maxPrice = { ...maxPrice, step: 0.05 };
  }
  // Latency and data age: twice the slowest listing (or the default) in the policy, three times in the conditions.
  const maxP95LatencyMs = widen(template.policy.maxP95LatencyMs, Math.max(2 * maxOf(p95s), 2 * policy.maxP95LatencyMs));
  const p95LatencyMs = widen(template.conditions.p95LatencyMs, 3 * maxOf(p95s));
  const maxDataAgeMs = widen(
    { ...template.policy.maxDataAgeMs, hint: `Oldest ${noun} you accept at response time.` },
    Math.max(2 * maxOf(ages), 2 * policy.maxDataAgeMs),
  );
  let dataAgeMs = widen({ ...template.conditions.dataAgeMs, hint: `Age of the ${noun} the provider returns.` }, 3 * maxOf(ages));
  // Minute inputs show tenths when a listing reports sub-minute ages.
  if (dataAgeMs.factor === MIN && ages.some((age) => age % MIN !== 0)) dataAgeMs = { ...dataAgeMs, step: 0.1, decimals: 1 };

  return {
    policy: { maxPrice, maxP95LatencyMs, maxDataAgeMs, minSuccessRate: template.policy.minSuccessRate },
    conditions: { bidPrice, p95LatencyMs, dataAgeMs, errorRate: template.conditions.errorRate },
  };
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

const PRICE_DEFINITIONS: Readonly<Record<MarketId, string>> = {
  "btc-usd": "BTC/USD spot mid price in USD, volume-weighted across major USD venues.",
};

function priceDefinition(spec: MarketSpec, contract: ContractSpec): string | undefined {
  if (contract.resultView !== "price") return undefined;
  const override = PRICE_DEFINITIONS[spec.id];
  if (override) return override;
  if (contract.id === "prices.spot") {
    return `${String(spec.params.pair ?? "").replace("-", "/")} spot mid price in USD, volume-weighted across major venues.`;
  }
  return contract.description;
}

/** Field plotted in a contract's chart, or `null`. */
export function seriesFieldOf(contract: ContractSpec | undefined): string | null {
  return contract?.output.find((field) => field.series)?.key ?? null;
}

function providersOf(spec: MarketSpec): ProviderFixture[] {
  return spec.listings.map((listing) => {
    const provider = getProvider(listing.providerId);
    return {
      id: listing.providerId,
      name: provider?.name ?? listing.providerId,
      logo: provider?.logo ?? "",
      defaults: {
        bidPrice: listing.bidPrice,
        p95LatencyMs: listing.p95LatencyMs,
        dataAgeMs: listing.dataAgeMs,
        errorRate: listing.errorRate,
        available: listing.available,
      },
      bias: listing.bias,
    };
  });
}

/** Turn a registry market and its contract into the engine's market definition. */
export function buildMarketDefinition(spec: MarketSpec): MarketDefinition {
  const contract = getContract(spec.contractId);
  if (!contract) throw new Error(`Market ${spec.id}: unknown contract ${spec.contractId}`);
  const limits = POLICY_OVERRIDES[spec.id] ?? derivedPolicy(spec, contract);
  const defaultPolicy: RoutingPolicy = { ...limits, preference: "lowest-cost", mode: { kind: "auto" } };
  const inputs = inputsFor(spec, contract, limits);
  const providers = providersOf(spec);
  const primary = contract.output.find((field) => field.primary);
  const identifier = `${spec.contractId.split(".")[0]}/${spec.id}`;
  const definition: MarketDefinition = {
    id: spec.id,
    contractId: contract.id,
    categoryId: spec.categoryId,
    name: spec.name,
    shortName: spec.shortName,
    identifier,
    contract: contractCall(spec),
    contractUrl: contractUrl(spec),
    description: spec.description,
    timeZone: spec.timeZone,
    timeZoneLabel: timeZoneLabel(spec.timeZone, FIXTURE_EPOCH),
    icon: spec.icon ?? getCategory(spec.categoryId)?.icon ?? "circle",
    units: { price: PRICE_UNIT, dataAge: contract.freshness.unit, value: primary?.unit ?? "" },
    seriesField: seriesFieldOf(contract),
    resultFields: contract.output.map((field) => ({ key: field.key, label: field.label, ...(field.unit ? { unit: field.unit } : {}) })),
    defaultPolicy,
    policyInputs: inputs.policy,
    conditionInputs: inputs.conditions,
    providers,
    codeSamples: getApiSnippets({ id: spec.id }, defaultPolicy),
    sampleResponse: sampleResponseJson(spec.id, providers[0]),
  };
  const definitionText = priceDefinition(spec, contract);
  if (definitionText) definition.priceDefinition = definitionText;
  return definition;
}

/** Market ids in registry (display) order. */
export const MARKET_IDS: readonly MarketId[] = MARKET_SPECS.map((market) => market.id);

/** Market definitions by id, for every registry market. */
export const MARKETS: Readonly<Record<MarketId, MarketDefinition>> = Object.fromEntries(
  MARKET_SPECS.map((market) => [market.id, buildMarketDefinition(market)]),
);

/** Default market for `/`. */
export const DEFAULT_MARKET_ID: MarketId = "sf-weather";

/** True exactly for registry market ids. */
export function isMarketId(value: unknown): value is MarketId {
  return isRegisteredMarket(value);
}

/** Market definition by id (registry market ids only). */
export function getMarketDefinition(marketId: MarketId): MarketDefinition {
  const definition = MARKETS[marketId];
  if (!definition) throw new Error(`Unknown market ${marketId}`);
  return definition;
}

/** Provider fixture by id, or `undefined`. */
export function getProviderFixture(marketId: MarketId, providerId: ProviderId): ProviderFixture | undefined {
  return MARKETS[marketId]?.providers.find((provider) => provider.id === providerId);
}

/** A copy of the market's default policy. */
export function getDefaultPolicy(marketId: MarketId): RoutingPolicy {
  const policy = getMarketDefinition(marketId).defaultPolicy;
  return { ...policy, mode: { ...policy.mode } };
}

/** Engine value → input display value (e.g. 900000 ms → 15 min, 0.995 → 99.5). */
export function toDisplayValue(spec: NumericInputSpec, value: number): number {
  return Number((value / spec.factor).toFixed(spec.decimals + 2));
}

/** Input display value → engine value (e.g. 15 min → 900000 ms, 99.5 → 0.995). */
export function fromDisplayValue(spec: NumericInputSpec, display: number): number {
  return Number((display * spec.factor).toFixed(10));
}

/** Latency added by the "Add latency" scenario: 300 ms for minute-unit markets, else 100 ms. */
export function latencyStepMs(marketId: MarketId): number {
  return MARKETS[marketId]?.units.dataAge === "min" ? 300 : 100;
}

/** Data delay added by the "Delay data" scenario: 15 min for minute-unit markets, else 1 s. */
export function dataDelayStepMs(marketId: MarketId): number {
  return MARKETS[marketId]?.units.dataAge === "min" ? 15 * MIN : 1_000;
}

/** Registry spec of an engine market (always defined for engine market ids). */
export function marketSpecOf(marketId: MarketId): MarketSpec | undefined {
  return getMarketSpec(marketId);
}

export const SF_WEATHER: MarketDefinition = MARKETS["sf-weather"];
export const SF_WEATHER_DEFAULT_POLICY: RoutingPolicy = SF_WEATHER.defaultPolicy;
export const SF_WEATHER_PROVIDERS: ProviderFixture[] = SF_WEATHER.providers;
export const BTC_USD: MarketDefinition = MARKETS["btc-usd"];
export const BTC_USD_DEFAULT_POLICY: RoutingPolicy = BTC_USD.defaultPolicy;
export const BTC_USD_PROVIDERS: ProviderFixture[] = BTC_USD.providers;
