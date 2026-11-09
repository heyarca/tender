/**
 * Deterministic request execution (SPEC §4.3). Requests never wait for an
 * auction: they use the current route immediately.
 */
import { requestEntry } from "./activity";
import { FIXTURE_EPOCH, LATENCY_LIMIT, REQUEST_LOG_LIMIT, SERIES_LIMIT } from "./constants";
import { nextRequestId, pushActivity, type StepContext } from "./context";
import { compass } from "./format";
import { createRng, type Rng } from "./random";
import { conditionLabel, pairFor, priceAtFor, weatherAtFor, weatherLocationFor, type WeatherState } from "./signals";
import { getProviderFixture, MARKETS } from "./fixtures";
import type {
  BtcPayload,
  BtcReference,
  MarketId,
  MarketReference,
  PriceMarketId,
  WeatherMarketId,
  MarketState,
  ProviderConditions,
  ProviderId,
  RequestResult,
  RoutingMode,
  ServedRequestResult,
  WeatherPayload,
  WeatherReference,
} from "./types";

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Request latency for a provider: ~95% of draws ≤ P95, the rest up to 1.35× P95,
 * median ≈ 0.6× P95. Integer milliseconds.
 */
export function sampleLatency(rng: Rng, p95LatencyMs: number): number {
  const u = rng.next();
  let factor: number;
  if (u < 0.5) factor = 0.3 + 0.3 * (u / 0.5);
  else if (u < 0.95) factor = 0.6 + 0.4 * ((u - 0.5) / 0.45) ** 1.6;
  else factor = 1 + 0.35 * ((u - 0.95) / 0.05);
  const value = Math.max(1, Math.round(p95LatencyMs * factor));
  return u < 0.95 ? Math.max(1, Math.min(value, Math.floor(p95LatencyMs))) : value;
}

/** Data age at response: the provider's data age ± 20%. */
export function sampleDataAge(rng: Rng, dataAgeMs: number, marketId: MarketId): number {
  const value = dataAgeMs * (1 + rng.range(-0.2, 0.2));
  // Weather observations are timestamped to the second.
  return isWeatherMarket(marketId) ? Math.round(value / 1000) * 1000 : Math.max(0, Math.round(value));
}

/** Weather-style markets report data age in minutes; price markets in milliseconds. */
function isWeatherMarket(marketId: MarketId): boolean {
  return MARKETS[marketId].units.dataAge === "min";
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Dew point (°F) from temperature (°F) and relative humidity (%), Magnus formula. */
export function dewPointF(temperatureF: number, humidityPct: number): number {
  const c = ((temperatureF - 32) * 5) / 9;
  const gamma = Math.log(Math.max(1, humidityPct) / 100) + (17.62 * c) / (243.12 + c);
  const dew = (243.12 * gamma) / (17.62 - gamma);
  return (dew * 9) / 5 + 32;
}

type WeatherNumericField = Exclude<keyof WeatherReference, "kind" | "at" | "condition" | "feelsLikeF">;

/** True conditions at an observation time, with label overrides from a reference. */
export interface AnchoredWeather extends WeatherState {
  /** Reference label, or `null` to derive it from cloud cover. */
  condition: string | null;
  /** Reference feels-like (moved by the drift), or `null` to derive it. */
  feelsLikeF: number | null;
}

/**
 * True San Francisco conditions at `observedAt`. Without a reference this is
 * the deterministic signal. With one, each given field is the reference value
 * moved by the signal's drift between `referenceAt` and `observedAt`.
 */
export function anchoredWeatherAt(
  observedAt: number,
  origin: number,
  reference?: WeatherReference,
  referenceAt: number = observedAt,
  marketId: MarketId = "sf-weather",
): AnchoredWeather {
  const w = weatherAtFor(marketId, observedAt, origin);
  if (!reference) return { ...w, condition: null, feelsLikeF: null };
  const r = weatherAtFor(marketId, referenceAt, origin);
  const shift = (key: WeatherNumericField): number => {
    const value = reference[key];
    return typeof value === "number" && Number.isFinite(value) ? value + (w[key] - r[key]) : w[key];
  };
  const feels = reference.feelsLikeF;
  const temperatureF = shift("temperatureF");
  const humidityPct = clamp(shift("humidityPct"), 0, 100);
  const given = (key: WeatherNumericField) => typeof reference[key] === "number" && Number.isFinite(reference[key]);
  // Keep the dew point consistent when the reference moves temperature or humidity but omits it.
  const dewPoint = () =>
    given("dewPointF") || (!given("temperatureF") && !given("humidityPct"))
      ? shift("dewPointF")
      : dewPointF(temperatureF, humidityPct);
  return {
    temperatureF,
    humidityPct,
    windMph: Math.max(0, shift("windMph")),
    windDirectionDeg: ((shift("windDirectionDeg") % 360) + 360) % 360,
    pressureHpa: shift("pressureHpa"),
    visibilityMi: Math.max(0, shift("visibilityMi")),
    dewPointF: dewPoint(),
    cloudCoverPct: clamp(shift("cloudCoverPct"), 0, 100),
    condition: typeof reference.condition === "string" && reference.condition ? reference.condition : null,
    feelsLikeF:
      typeof feels === "number" && Number.isFinite(feels) ? feels + (w.temperatureF - r.temperatureF) : null,
  };
}

/**
 * Weather payload a provider reports for an observation at `observedAt`:
 * the true conditions then, plus the provider's bias (≤ 0.5°F, ≤ 2% humidity).
 */
export function weatherPayload(
  observedAt: number,
  origin: number,
  bias: number,
  reference?: WeatherReference,
  referenceAt?: number,
  marketId: MarketId = "sf-weather",
): WeatherPayload {
  const w = anchoredWeatherAt(observedAt, origin, reference, referenceAt, marketId);
  const temperatureF = w.temperatureF + bias * 0.5;
  const humidityPct = clamp(w.humidityPct - bias * 2, 0, 100);
  const windDirectionDeg = Math.round(w.windDirectionDeg) % 360;
  const feelsLikeF = w.feelsLikeF === null ? temperatureF - 0.1 * w.windMph : w.feelsLikeF + bias * 0.5;
  return {
    kind: "weather",
    location: { ...weatherLocationFor(marketId) },
    observedAt,
    temperatureF: round(temperatureF, 1),
    feelsLikeF: round(feelsLikeF, 1),
    condition: w.condition ?? conditionLabel(w.cloudCoverPct),
    humidityPct: Math.round(humidityPct),
    windMph: Math.round(w.windMph),
    windDirectionDeg,
    windDirection: compass(windDirectionDeg),
    pressureHpa: Math.round(w.pressureHpa),
    visibilityMi: round(w.visibilityMi, 1),
    dewPointF: round(w.dewPointF + bias * 0.3, 1),
    cloudCoverPct: Math.round(w.cloudCoverPct),
  };
}

/**
 * True BTC/USD price at `at`. Without a reference this is the deterministic
 * walk; with one, the reference price moved by the walk between `reference.at`
 * (default `referenceAt`) and `at`.
 */
export function anchoredBtcPriceAt(
  at: number,
  origin: number,
  reference?: BtcReference,
  referenceAt: number = at,
  marketId: MarketId = "btc-usd",
): number {
  if (!reference || !Number.isFinite(reference.priceUsd)) return priceAtFor(marketId, at, origin);
  const anchor = reference.at ?? referenceAt;
  return reference.priceUsd + (priceAtFor(marketId, at, origin) - priceAtFor(marketId, anchor, origin));
}

/** Decimals a market's price is reported with. */
function priceDecimals(marketId: MarketId): number {
  return pairFor(marketId).endsWith("-USD") && (marketId === "eur-usd" || marketId === "gbp-usd") ? 4 : 2;
}

/** Provider bias scales with the price level so small-priced pairs stay realistic. */
function priceBiasScale(marketId: MarketId): number {
  return marketId === "eur-usd" || marketId === "gbp-usd" ? 0.0001 : marketId === "xrp-usd" ? 0.002 : marketId === "sol-usd" ? 0.1 : marketId === "eth-usd" ? 0.5 : 1;
}

/** BTC price a provider reports for the source time `sourceTimestamp` (true price + bias ≤ $1.50). */
export function btcProviderPrice(
  sourceTimestamp: number,
  origin: number,
  bias: number,
  reference?: BtcReference,
  referenceAt?: number,
  marketId: MarketId = "btc-usd",
): number {
  const scale = marketId === "btc-usd" ? 1 : priceBiasScale(marketId);
  return round(anchoredBtcPriceAt(sourceTimestamp, origin, reference, referenceAt, marketId) + bias * 1.5 * scale, priceDecimals(marketId));
}

/**
 * Deterministic reference value of a market at `at` (the fallback when no
 * upstream value is available).
 */
export function signalReference(marketId: MarketId, at: number, origin: number = FIXTURE_EPOCH): MarketReference {
  if (!isWeatherMarket(marketId)) return { kind: "btc", at, priceUsd: round(priceAtFor(marketId, at, origin), priceDecimals(marketId)) };
  const w = weatherAtFor(marketId, at, origin);
  return {
    kind: "weather",
    at,
    temperatureF: round(w.temperatureF, 1),
    condition: conditionLabel(w.cloudCoverPct),
    humidityPct: round(w.humidityPct, 1),
    windMph: round(w.windMph, 1),
    windDirectionDeg: round(w.windDirectionDeg, 1),
    pressureHpa: round(w.pressureHpa, 1),
    visibilityMi: round(w.visibilityMi, 2),
    dewPointF: round(w.dewPointF, 1),
    cloudCoverPct: round(w.cloudCoverPct, 1),
  };
}

const FAILURES = [
  { code: 500, message: "Internal Server Error" },
  { code: 502, message: "Bad Gateway" },
  { code: 504, message: "Gateway Timeout" },
] as const;

/** Value plotted in the market chart for a served result. */
export function seriesValue(result: ServedRequestResult): number {
  return result.payload.kind === "btc" ? result.payload.priceUsd : result.payload.temperatureF;
}

/** Input of `sampleRequest`: everything a single request depends on. */
export interface RequestSampleInput {
  marketId: MarketId;
  /** Provider the route selected; `null` means no eligible provider (the request is rejected). */
  providerId: ProviderId | null;
  /** Provider conditions at request time (default: fixture defaults). */
  conditions?: ProviderConditions;
  /** `req_000123` style id (see `formatRequestId`). */
  requestId: string;
  /** Request time (ms). */
  now: number;
  /** Seeded PRNG state (uint32). The same seed and input give the same result. */
  seed: number;
  /** Routing mode that selected the provider (default `"auto"`). */
  routingMode?: RoutingMode["kind"];
  /** Origin of the deterministic market signal (default `FIXTURE_EPOCH`). */
  signalOrigin?: number;
  /** BTC and quote markets: value of the previous served request, for the change. */
  previousPriceUsd?: number | null;
  /**
   * Upstream reference value (live SF conditions or BTC spot). Ignored when it
   * does not match the market. Default: the deterministic signal.
   */
  reference?: MarketReference | null;
}

/**
 * Sample one request deterministically. Pure: returns the result and the next
 * PRNG state. Draw order is fixed (failure roll, failure kind, latency, data age).
 * Unknown providers are rejected like a missing route.
 */
export function sampleRequest(input: RequestSampleInput): { result: RequestResult; rng: number } {
  const { marketId, providerId, requestId, now } = input;
  const routingMode = input.routingMode ?? "auto";
  const fixture = providerId ? getProviderFixture(marketId, providerId) : undefined;
  if (!providerId || !fixture) {
    return {
      result: {
        status: "rejected",
        marketId,
        requestId,
        requestedAt: now,
        routingMode,
        providerId: null,
        reason: "No eligible provider",
        cost: 0,
      },
      rng: input.seed >>> 0,
    };
  }

  const rng = createRng(input.seed);
  const c: ProviderConditions = input.conditions ?? fixture.defaults;
  const name = fixture.name;
  // Fixed draw order keeps sequences stable.
  const failureRoll = rng.next();
  const failureKind = rng.next();
  const latencyMs = sampleLatency(rng, c.p95LatencyMs);
  const dataAgeMs = sampleDataAge(rng, c.dataAgeMs, marketId);

  if (!c.available) {
    return {
      result: {
        status: "failed",
        marketId,
        requestId,
        requestedAt: now,
        routingMode,
        providerId,
        providerName: name,
        latencyMs: Math.max(1, Math.round(latencyMs * 0.25)),
        error: { code: 503, message: "Service Unavailable" },
        cost: 0,
      },
      rng: rng.state,
    };
  }
  if (failureRoll < c.errorRate) {
    const failure = FAILURES[Math.min(FAILURES.length - 1, Math.floor(failureKind * FAILURES.length))];
    return {
      result: {
        status: "failed",
        marketId,
        requestId,
        requestedAt: now,
        routingMode,
        providerId,
        providerName: name,
        latencyMs,
        error: { code: failure.code, message: failure.message },
        cost: 0,
      },
      rng: rng.state,
    };
  }

  const origin = input.signalOrigin ?? FIXTURE_EPOCH;
  const reference = input.reference ?? undefined;
  const base = {
    status: "ok" as const,
    requestId,
    requestedAt: now,
    routingMode,
    providerId,
    providerName: name,
    latencyMs,
    dataAgeMs,
    cost: c.bidPrice / 1e6,
  };
  if (isWeatherMarket(marketId)) {
    return {
      result: { ...base, marketId: marketId as WeatherMarketId, payload: weatherPayload(
          now - dataAgeMs,
          origin,
          fixture.bias,
          reference?.kind === "weather" ? reference : undefined,
          reference?.at ?? now,
          marketId,
        ),
      },
      rng: rng.state,
    };
  }
  const sourceTimestamp = now - dataAgeMs;
  const priceUsd = btcProviderPrice(
    sourceTimestamp,
    origin,
    fixture.bias,
    reference?.kind === "btc" ? reference : undefined,
    now,
    marketId,
  );
  const previous = input.previousPriceUsd ?? null;
  const changeUsd = previous !== null ? round(priceUsd - previous, priceDecimals(marketId)) : null;
  const payload: BtcPayload = {
    kind: "btc",
    pair: pairFor(marketId),
    priceUsd,
    changeUsd,
    changePct: previous !== null && changeUsd !== null ? round((changeUsd / previous) * 100, 4) : null,
    sourceTimestamp,
  };
  return { result: { ...base, marketId: marketId as PriceMarketId, payload }, rng: rng.state };
}

/**
 * Compute a request result for the market's current route. Pure: returns the
 * result and the next PRNG state; does not touch the market.
 */
export function executeRequest(
  market: MarketState,
  requestId: string,
  now: number,
): { result: RequestResult; rng: number } {
  const providerId: ProviderId | null =
    market.policy.mode.kind === "pinned" ? market.policy.mode.providerId : market.route.activeProviderId;
  const provider = providerId ? market.providers.find((p) => p.id === providerId) : undefined;
  const previous = market.requests.find((r): r is ServedRequestResult => r.status === "ok" && r.marketId === market.id);
  return sampleRequest({
    marketId: market.id,
    providerId: provider ? provider.id : null,
    conditions: provider?.conditions,
    requestId,
    now,
    seed: market.rng,
    routingMode: market.policy.mode.kind,
    signalOrigin: market.signalOrigin,
    previousPriceUsd: previous && previous.payload.kind !== "weather" ? seriesValue(previous) : null,
  });
}

/** Run one request on the market: log it, update counters, spend, history, chart, and activity. */
export function runRequest(market: MarketState, ctx: StepContext): MarketState {
  const requestId = nextRequestId(ctx);
  const { result, rng } = executeRequest(market, requestId, ctx.now);
  return applyResult({ ...market, rng }, ctx, result);
}

function applyResult(market: MarketState, ctx: StepContext, result: RequestResult): MarketState {
  const counters = {
    total: market.counters.total + 1,
    served: market.counters.served + (result.status === "ok" ? 1 : 0),
    failed: market.counters.failed + (result.status === "failed" ? 1 : 0),
    rejected: market.counters.rejected + (result.status === "rejected" ? 1 : 0),
  };
  let providers = market.providers;
  if (result.status !== "rejected") {
    providers = market.providers.map((provider) => {
      if (provider.id !== result.providerId) return provider;
      const latencies = provider.latencies.length >= LATENCY_LIMIT ? provider.latencies.slice(1) : provider.latencies.slice();
      latencies.push({ at: result.requestedAt, requestId: result.requestId, latencyMs: result.latencyMs, ok: result.status === "ok" });
      return { ...provider, latencies };
    });
  }
  let series = market.series;
  if (result.status === "ok") {
    series = [
      ...market.series,
      { at: result.requestedAt, value: seriesValue(result), providerId: result.providerId, requestId: result.requestId },
    ].slice(-SERIES_LIMIT);
  }
  const next: MarketState = {
    ...market,
    providers,
    series,
    counters,
    spend: market.spend + result.cost,
    requests: [result, ...market.requests].slice(0, REQUEST_LOG_LIMIT),
  };
  return pushActivity(ctx, next, requestEntry(result));
}
