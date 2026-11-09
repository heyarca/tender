import type { BitcoinQuote, ResultProvider, ResultRequest, WeatherReading } from "@/components/result";
import { providerColor } from "@/components/viz/colors";
import type { PricePoint, TimelineRequest, VizProviders } from "@/components/viz/types";
import type {
  MarketDefinition,
  ProviderIdentity,
  RequestResult,
  SeriesPoint,
  ServedRequestResult,
} from "@/lib/tender";

/** Provider ids in fixture order, so every chart gives a provider the same color. */
export function providerIdsOf(definition: Pick<MarketDefinition, "providers">): string[] {
  return definition.providers.map((provider) => provider.id);
}

/** Provider identities (name, logo, stable color) for charts and tooltips. */
export function vizProvidersOf(definition: Pick<MarketDefinition, "providers">): VizProviders {
  const ids = providerIdsOf(definition);
  return Object.fromEntries(
    definition.providers.map((provider) => [
      provider.id,
      { name: provider.name, logo: provider.logo, color: providerColor(provider.id, ids) },
    ]),
  );
}

function resultProvider(
  providerId: string | null,
  fallbackName: string | undefined,
  identities: Readonly<Record<string, Pick<ProviderIdentity, "name" | "logo">>>,
): ResultProvider | null {
  if (!providerId) return null;
  const identity = identities[providerId];
  return { id: providerId, name: identity?.name ?? fallbackName ?? providerId, logo: identity?.logo };
}

/** The latest request (any outcome) as the result components show it. */
export function toResultRequest(
  result: RequestResult | null,
  identities: Readonly<Record<string, Pick<ProviderIdentity, "name" | "logo">>>,
): ResultRequest | null {
  if (!result) return null;
  switch (result.status) {
    case "ok":
      return {
        id: result.requestId,
        status: "ok",
        provider: resultProvider(result.providerId, result.providerName, identities),
        latencyMs: result.latencyMs,
      };
    case "failed":
      return {
        id: result.requestId,
        status: "failed",
        provider: resultProvider(result.providerId, result.providerName, identities),
        latencyMs: result.latencyMs,
        error: `${result.error.code} ${result.error.message}`.trim(),
      };
    case "rejected":
      return { id: result.requestId, status: "rejected", provider: null, latencyMs: null, error: result.reason };
  }
}

/** Normalized weather payload of the newest served request, or `null`. */
export function toWeatherReading(served: ServedRequestResult | null): WeatherReading | null {
  if (!served || served.payload.kind !== "weather") return null;
  const p = served.payload;
  return {
    location: p.location.name,
    observedAt: p.observedAt,
    dataAgeMs: served.dataAgeMs,
    temperatureF: p.temperatureF,
    feelsLikeF: p.feelsLikeF,
    condition: p.condition,
    humidityPct: p.humidityPct,
    windMph: p.windMph,
    windDirectionDeg: p.windDirectionDeg,
    pressureHpa: p.pressureHpa,
    visibilityMi: p.visibilityMi,
    dewPointF: p.dewPointF,
    cloudCoverPct: p.cloudCoverPct,
  };
}

/** Normalized BTC/USD quote of the newest served request, or `null`. */
export function toBitcoinQuote(served: ServedRequestResult | null): BitcoinQuote | null {
  if (!served) return null;
  const p = served.payload;
  if (p.kind !== "btc") return null;
  return {
    pair: p.pair.replace("-", "/"),
    price: p.priceUsd,
    change: p.changeUsd,
    sourceTimestamp: p.sourceTimestamp,
    dataAgeMs: served.dataAgeMs,
    latencyMs: served.latencyMs,
  };
}

/**
 * Chart points: the market's price series (oldest first) plus failed requests in the same
 * window, which the chart marks on the time axis.
 */
export function toPricePoints(series: readonly SeriesPoint[], recent: readonly RequestResult[] = []): PricePoint[] {
  const points: PricePoint[] = series.map((point) => ({
    t: point.at,
    price: point.value,
    ...(point.providerId ? { providerId: point.providerId } : {}),
    ...(point.requestId ? { id: point.requestId } : {}),
  }));
  const start = points.length ? points[0].t : -Infinity;
  for (const result of recent) {
    if (result.status !== "failed" || result.requestedAt < start) continue;
    points.push({ t: result.requestedAt, price: Number.NaN, providerId: result.providerId, status: "failed", id: result.requestId });
  }
  return points.sort((a, b) => a.t - b.t);
}

/** Recent requests for the latency strip, oldest first. */
export function toTimelineRequests(recent: readonly RequestResult[]): TimelineRequest[] {
  const timeline: TimelineRequest[] = [];
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const result = recent[i];
    timeline.push({
      id: result.requestId,
      t: result.requestedAt,
      latencyMs: result.status === "rejected" ? null : result.latencyMs,
      providerId: result.status === "rejected" ? null : result.providerId,
      status: result.status,
    });
  }
  return timeline;
}
