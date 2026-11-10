/**
 * Deterministic request execution (SPEC §4.3). Requests never wait for an
 * auction: they use the current route immediately.
 */
import { requestEntry } from "./activity";
import { FIXTURE_EPOCH, LATENCY_LIMIT, REQUEST_LOG_LIMIT, SERIES_LIMIT } from "./constants";
import { nextRequestId, pushActivity, type StepContext } from "./context";
import { compass } from "./format";
import { createRng, type Rng } from "./random";
import { getContract, getMarketSpec, readField, sampleFor, type ContractSpec, type FieldSpec } from "@/lib/registry";
import {
  conditionLabel,
  pairFor,
  priceAtFor,
  priceBiasScaleFor,
  priceDecimalsFor,
  seriesMoveAt,
  weatherAtFor,
  weatherLocationFor,
  type WeatherState,
} from "./signals";
import { getProviderFixture, MARKETS } from "./markets";
import type {
  BtcPayload,
  BtcReference,
  FieldsPayload,
  MarketId,
  MarketReference,
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

/** Minute-unit markets timestamp their data to the second. */
function isWeatherMarket(marketId: MarketId): boolean {
  return MARKETS[marketId]?.units.dataAge === "min";
}

/** Result payload kind of a market: `weather.current` → weather, `prices.spot` → btc, else fields. */
export function payloadKindOf(marketId: MarketId): "weather" | "btc" | "fields" {
  const contractId = MARKETS[marketId]?.contractId;
  return contractId === "weather.current" ? "weather" : contractId === "prices.spot" ? "btc" : "fields";
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

/** Spot price a provider reports for the source time `sourceTimestamp` (true price + bias; BTC: ≤ $1.50). */
export function btcProviderPrice(
  sourceTimestamp: number,
  origin: number,
  bias: number,
  reference?: BtcReference,
  referenceAt?: number,
  marketId: MarketId = "btc-usd",
): number {
  const scale = priceBiasScaleFor(marketId);
  return round(anchoredBtcPriceAt(sourceTimestamp, origin, reference, referenceAt, marketId) + bias * 1.5 * scale, priceDecimalsFor(marketId));
}

// ---------------------------------------------------------------------------
// Fields payloads (every contract besides weather.current and prices.spot)
// ---------------------------------------------------------------------------

/** Timestamp fields that carry the source time ("as of", "updated", "observed"). */
const SOURCE_TIME_KEYS = new Set(["observedAt", "sourceTimestamp", "asOf", "updatedAt"]);

interface FieldsModel {
  contract: ContractSpec;
  sample: Record<string, unknown>;
  series: FieldSpec | null;
  /** Money fields that move with the series field (same unit), e.g. bid and ask with last. */
  linked: FieldSpec[];
  sourceTimeKeys: string[];
}

const fieldsModels = new Map<MarketId, FieldsModel | null>();

function fieldsModel(marketId: MarketId): FieldsModel | null {
  if (fieldsModels.has(marketId)) return fieldsModels.get(marketId)!;
  const spec = getMarketSpec(marketId);
  const contract = spec ? getContract(spec.contractId) : undefined;
  let model: FieldsModel | null = null;
  if (spec && contract) {
    const series = contract.output.find((field) => field.series) ?? null;
    model = {
      contract,
      sample: sampleFor(spec),
      series,
      linked:
        series?.type === "money"
          ? contract.output.filter((field) => field !== series && field.type === "money" && field.unit === series.unit)
          : [],
      sourceTimeKeys: contract.output
        .filter((field) => field.type === "timestamp" && SOURCE_TIME_KEYS.has(field.key.split(".").pop() ?? ""))
        .map((field) => field.key),
    };
  }
  fieldsModels.set(marketId, model);
  return model;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Set a dotted key, copying the objects on the path (the sample stays untouched). */
function setField(target: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    const child = node[part];
    const copy: Record<string, unknown> = isPlainObject(child) ? { ...child } : {};
    node[part] = copy;
    node = copy;
  }
  node[parts[parts.length - 1]] = value;
}

const decimalsOf = (value: number) => {
  const text = String(value);
  const dot = text.indexOf(".");
  return dot === -1 || text.includes("e") ? 0 : text.length - dot - 1;
};

/** Decimals a numeric field is reported with: integers 0, money ≥ 2 (≥ 4 below 10), other numbers ≥ 1. */
function fieldDecimals(field: FieldSpec, base: number): number {
  if (field.type === "integer") return 0;
  const minimum = field.type === "money" ? (Math.abs(base) < 10 ? 4 : 2) : 1;
  return Math.min(6, Math.max(minimum, decimalsOf(base)));
}

/** Value of the series field at `sourceTimestamp` (unrounded), or `null` when the contract has none. */
function seriesValueAt(model: FieldsModel, marketId: MarketId, sourceTimestamp: number, origin: number, bias: number): number | null {
  const field = model.series;
  const base = field ? readField(model.sample, field.key) : undefined;
  if (!field || typeof base !== "number" || !Number.isFinite(base)) return null;
  // Money moves gently like prices; counts and scores a few percent. Providers report a small bias.
  const biasMove = bias * (field.type === "money" ? 0.0002 : 0.01);
  return base * (1 + seriesMoveAt(marketId, sourceTimestamp, origin) + biasMove);
}

/**
 * Fields payload a provider reports for data at `sourceTimestamp`: the registry sample with the
 * series field drifted by the market signal (linked money fields move with it), source-time
 * timestamps set to `sourceTimestamp`, and the change vs `previousValue`.
 */
export function fieldsPayload(
  marketId: MarketId,
  sourceTimestamp: number,
  origin: number,
  bias: number,
  previousValue: number | null = null,
): FieldsPayload {
  const model = fieldsModel(marketId);
  if (!model) return { kind: "fields", contractId: "", values: {}, sourceTimestamp, change: null };
  const values: Record<string, unknown> = { ...model.sample };
  let change: number | null = null;
  const field = model.series;
  const raw = seriesValueAt(model, marketId, sourceTimestamp, origin, bias);
  if (field && raw !== null) {
    const base = readField(model.sample, field.key) as number;
    const decimals = fieldDecimals(field, base);
    const value = round(Math.max(0, raw), decimals);
    setField(values, field.key, value);
    const ratio = base === 0 ? 1 : raw / base;
    for (const linked of model.linked) {
      const current = readField(model.sample, linked.key);
      if (typeof current === "number") setField(values, linked.key, round(Math.max(0, current * ratio), fieldDecimals(linked, current)));
    }
    if (previousValue !== null && Number.isFinite(previousValue)) change = round(value - previousValue, decimals);
  }
  const at = new Date(sourceTimestamp).toISOString();
  for (const key of model.sourceTimeKeys) setField(values, key, at);
  return { kind: "fields", contractId: model.contract.id, values, sourceTimestamp, change };
}

/** Rewrite the source-time fields of a fields payload after its `sourceTimestamp` moved (rebase). */
export function shiftFieldsPayload(payload: FieldsPayload, delta: number, marketId: MarketId): FieldsPayload {
  const sourceTimestamp = payload.sourceTimestamp + delta;
  const values: Record<string, unknown> = { ...payload.values };
  const at = new Date(sourceTimestamp).toISOString();
  for (const key of fieldsModel(marketId)?.sourceTimeKeys ?? []) setField(values, key, at);
  return { ...payload, values, sourceTimestamp };
}

/**
 * Deterministic reference value of a market at `at` (the fallback when no
 * upstream value is available). `null` for `fields` markets.
 */
export function signalReference(marketId: MarketId, at: number, origin: number = FIXTURE_EPOCH): MarketReference | null {
  const kind = payloadKindOf(marketId);
  if (kind === "fields") return null;
  if (kind === "btc") return { kind: "btc", at, priceUsd: round(priceAtFor(marketId, at, origin), priceDecimalsFor(marketId)) };
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

/**
 * Value plotted in the market chart for a served result: temperature, spot price, or the
 * contract's series field. `null` when the market has no chart.
 */
export function seriesValue(result: ServedRequestResult): number | null {
  return seriesValueOf(result.marketId, result.payload);
}

/** `seriesValue` for a payload of the given market. */
export function seriesValueOf(marketId: MarketId, payload: ServedRequestResult["payload"]): number | null {
  if (payload.kind === "btc") return payload.priceUsd;
  if (payload.kind === "weather") return payload.temperatureF;
  const key = MARKETS[marketId]?.seriesField;
  const value = key ? readField(payload.values, key) : undefined;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  /** Spot and fields markets: series value of the previous served request, for the change. */
  previousValue?: number | null;
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
  const sourceTimestamp = now - dataAgeMs;
  const previous = input.previousValue ?? null;
  const kind = payloadKindOf(marketId);
  if (kind === "weather") {
    const payload = weatherPayload(
      sourceTimestamp,
      origin,
      fixture.bias,
      reference?.kind === "weather" ? reference : undefined,
      reference?.at ?? now,
      marketId,
    );
    return { result: { ...base, marketId, payload }, rng: rng.state };
  }
  if (kind === "fields") {
    return { result: { ...base, marketId, payload: fieldsPayload(marketId, sourceTimestamp, origin, fixture.bias, previous) }, rng: rng.state };
  }
  const priceUsd = btcProviderPrice(
    sourceTimestamp,
    origin,
    fixture.bias,
    reference?.kind === "btc" ? reference : undefined,
    now,
    marketId,
  );
  const changeUsd = previous !== null ? round(priceUsd - previous, priceDecimalsFor(marketId)) : null;
  const payload: BtcPayload = {
    kind: "btc",
    pair: pairFor(marketId),
    priceUsd,
    changeUsd,
    changePct: previous !== null && changeUsd !== null ? round((changeUsd / previous) * 100, 4) : null,
    sourceTimestamp,
  };
  return { result: { ...base, marketId, payload }, rng: rng.state };
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
    previousValue: previous && previous.payload.kind !== "weather" ? seriesValue(previous) : null,
  });
}

/** Run one request on the market: log it, update counters, spend, history, chart, and activity. */
export function runRequest(market: MarketState, ctx: StepContext): MarketState {
  const requestId = nextRequestId(ctx);
  const { result, rng } = executeRequest(market, requestId, ctx.now);
  return applyResult({ ...market, rng }, ctx, result);
}

/** Record a request result on the market: log, counters, spend, provider latencies, chart, and activity. */
export function applyResult(market: MarketState, ctx: StepContext, result: RequestResult): MarketState {
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
  const value = result.status === "ok" ? seriesValue(result) : null;
  if (result.status === "ok" && value !== null) {
    series = [
      ...market.series,
      { at: result.requestedAt, value, providerId: result.providerId, requestId: result.requestId },
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
