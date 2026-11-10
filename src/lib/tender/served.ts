/**
 * Requests served on the server (Ask Tender's `run_request`, Run with credits) recorded in the
 * console: each envelope becomes the same served result the engine produces, so the market's
 * latest result, recent requests, counters, chart, and activity show it. Routing is untouched.
 */
import { compass } from "./format";
import { type StepContext } from "./context";
import { getProviderFixture, MARKETS } from "./markets";
import { applyResult, payloadKindOf, seriesValueOf } from "./requests";
import { pairFor, priceDecimalsFor } from "./signals";
import type { FieldsPayload, MarketState, RequestSource, ServedEnvelope, ServedRequestResult } from "./types";

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const time = (value: unknown, fallback: number) => {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** The served result of an envelope, or `null` when the market does not know its provider. */
export function servedResult(
  market: MarketState,
  envelope: ServedEnvelope,
  source: RequestSource,
  now: number,
): ServedRequestResult | null {
  const marketId = market.id;
  const fixture = getProviderFixture(marketId, envelope.provider);
  if (!fixture) return null;
  // Keep the request log in time order: never before the newest request, never in the future.
  const newest = market.requests[0]?.requestedAt ?? 0;
  const requestedAt = Math.min(now, Math.max(newest, time(envelope.served_at, now)));
  const data = envelope.data;
  const previous = market.requests.find((r): r is ServedRequestResult => r.status === "ok");
  const previousValue = previous ? seriesValueOf(marketId, previous.payload) : null;
  const base = {
    status: "ok" as const,
    marketId,
    requestId: envelope.request_id,
    requestedAt,
    routingMode: market.policy.mode.kind,
    providerId: fixture.id,
    providerName: fixture.name,
    latencyMs: num(envelope.latency_ms),
    dataAgeMs: num(envelope.data_age_ms),
    cost: envelope.charged_micros !== undefined ? envelope.charged_micros / 1e6 : num(envelope.price_usd),
    source,
    params: envelope.params ? { ...envelope.params } : undefined,
  };
  const kind = payloadKindOf(marketId);
  if (kind === "weather") {
    const location = data.location as { name?: unknown; latitude?: unknown; longitude?: unknown } | undefined;
    const windDirectionDeg = num(data.windDirectionDeg);
    return {
      ...base,
      payload: {
        kind: "weather",
        location: { name: String(location?.name ?? MARKETS[marketId].name), latitude: num(location?.latitude), longitude: num(location?.longitude) },
        observedAt: time(data.observedAt, requestedAt - base.dataAgeMs),
        temperatureF: num(data.temperatureF),
        feelsLikeF: num(data.feelsLikeF),
        condition: String(data.condition ?? ""),
        humidityPct: num(data.humidityPct),
        windMph: num(data.windMph),
        windDirectionDeg,
        windDirection: typeof data.windDirection === "string" ? data.windDirection : compass(windDirectionDeg),
        pressureHpa: num(data.pressureHpa),
        visibilityMi: num(data.visibilityMi),
        dewPointF: num(data.dewPointF),
        cloudCoverPct: num(data.cloudCoverPct),
      },
    };
  }
  if (kind === "btc") {
    const priceUsd = num(data.priceUsd);
    const changeUsd = previousValue !== null ? round(priceUsd - previousValue, priceDecimalsFor(marketId)) : null;
    return {
      ...base,
      payload: {
        kind: "btc",
        pair: typeof data.pair === "string" ? data.pair : pairFor(marketId),
        priceUsd,
        changeUsd,
        changePct: previousValue && changeUsd !== null ? round((changeUsd / previousValue) * 100, 4) : null,
        sourceTimestamp: time(data.sourceTimestamp, requestedAt - base.dataAgeMs),
      },
    };
  }
  const payload: FieldsPayload = {
    kind: "fields",
    contractId: MARKETS[marketId].contractId,
    values: data,
    sourceTimestamp: requestedAt - base.dataAgeMs,
    change: null,
  };
  const value = seriesValueOf(marketId, payload);
  return { ...base, payload: value !== null && previousValue !== null ? { ...payload, change: round(value - previousValue, 6) } : payload };
}

/** Record server-served requests of one market. Envelopes already in the log are skipped. */
export function ingestServed(market: MarketState, ctx: StepContext, envelopes: readonly ServedEnvelope[], source: RequestSource): MarketState {
  let updated = market;
  for (const envelope of envelopes) {
    if (envelope.market !== market.id || updated.requests.some((r) => r.requestId === envelope.request_id)) continue;
    const result = servedResult(updated, envelope, source, ctx.now);
    if (result) updated = applyResult(updated, ctx, result);
  }
  return updated;
}
