/**
 * Deterministic request execution (SPEC §4.3). Requests never wait for an
 * auction: they use the current route immediately.
 */
import { requestEntry, providerName } from "./activity";
import { LATENCY_LIMIT, REQUEST_LOG_LIMIT, SERIES_LIMIT } from "./constants";
import { nextRequestId, pushActivity, type StepContext } from "./context";
import { compass } from "./format";
import { createRng, type Rng } from "./random";
import { btcPriceAt, conditionLabel, SF_LOCATION, weatherAt } from "./signals";
import { getProviderFixture } from "./fixtures";
import type {
  BtcPayload,
  MarketId,
  MarketState,
  ProviderConditions,
  ProviderId,
  RequestResult,
  ServedRequestResult,
  WeatherPayload,
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
  return marketId === "sf-weather" ? Math.round(value / 1000) * 1000 : Math.max(0, Math.round(value));
}

/** Weather payload a provider reports for an observation at `observedAt`. */
export function weatherPayload(observedAt: number, origin: number, bias: number): WeatherPayload {
  const w = weatherAt(observedAt, origin);
  const temperatureF = w.temperatureF + bias * 0.5;
  const humidityPct = Math.min(100, Math.max(0, w.humidityPct - bias * 2));
  const windDirectionDeg = Math.round(w.windDirectionDeg) % 360;
  return {
    kind: "weather",
    location: { ...SF_LOCATION },
    observedAt,
    temperatureF: round(temperatureF, 1),
    feelsLikeF: round(temperatureF - 0.1 * w.windMph, 1),
    condition: conditionLabel(w.cloudCoverPct),
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

/** BTC price a provider reports for the source time `sourceTimestamp`. */
export function btcProviderPrice(sourceTimestamp: number, origin: number, bias: number): number {
  return round(btcPriceAt(sourceTimestamp, origin) + bias * 1.5, 2);
}

const FAILURES = [
  { code: 500, message: "Internal Server Error" },
  { code: 502, message: "Bad Gateway" },
  { code: 504, message: "Gateway Timeout" },
] as const;

/** Value plotted in the market chart for a served result. */
export function seriesValue(result: ServedRequestResult): number {
  return result.marketId === "btc-usd" ? result.payload.priceUsd : result.payload.temperatureF;
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
  const routingMode = market.policy.mode.kind;
  const providerId: ProviderId | null =
    market.policy.mode.kind === "pinned" ? market.policy.mode.providerId : market.route.activeProviderId;
  const provider = providerId ? market.providers.find((p) => p.id === providerId) : undefined;
  if (!providerId || !provider) {
    return {
      result: {
        status: "rejected",
        marketId: market.id,
        requestId,
        requestedAt: now,
        routingMode,
        providerId: null,
        reason: "No eligible provider",
        cost: 0,
      },
      rng: market.rng,
    };
  }

  const rng = createRng(market.rng);
  const c: ProviderConditions = provider.conditions;
  const name = providerName(market.id, providerId);
  // Fixed draw order keeps sequences stable.
  const failureRoll = rng.next();
  const failureKind = rng.next();
  const latencyMs = sampleLatency(rng, c.p95LatencyMs);
  const dataAgeMs = sampleDataAge(rng, c.dataAgeMs, market.id);

  if (!c.available) {
    return {
      result: {
        status: "failed",
        marketId: market.id,
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
        marketId: market.id,
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

  const bias = getProviderFixture(market.id, providerId)?.bias ?? 0;
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
  if (market.id === "sf-weather") {
    return {
      result: { ...base, marketId: "sf-weather", payload: weatherPayload(now - dataAgeMs, market.signalOrigin, bias) },
      rng: rng.state,
    };
  }
  const sourceTimestamp = now - dataAgeMs;
  const priceUsd = btcProviderPrice(sourceTimestamp, market.signalOrigin, bias);
  const previous = market.requests.find(
    (r): r is Extract<RequestResult, { status: "ok"; marketId: "btc-usd" }> => r.status === "ok" && r.marketId === "btc-usd",
  );
  const changeUsd = previous ? round(priceUsd - previous.payload.priceUsd, 2) : null;
  const payload: BtcPayload = {
    kind: "btc",
    pair: "BTC-USD",
    priceUsd,
    changeUsd,
    changePct: previous && changeUsd !== null ? round((changeUsd / previous.payload.priceUsd) * 100, 4) : null,
    sourceTimestamp,
  };
  return { result: { ...base, marketId: "btc-usd", payload }, rng: rng.state };
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
