/**
 * Code samples and JSON views for the API dialog.
 * Pure string builders; safe on the server.
 */
import { isQuoteMarketId, QUOTE_CONTRACTS } from "./fixtures/quote-contracts";
import type { CodeSample, MarketId, RequestResult, RoutingPolicy } from "./types";

interface SnippetMarket {
  id: MarketId;
  identifier: string;
}

function tsNumber(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) >= 10_000) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "_");
  }
  return String(Number(value.toFixed(6)));
}

function ageComment(ms: number): string {
  if (ms >= 60_000 && ms % 60_000 === 0) return ` // ${ms / 60_000} min`;
  if (ms >= 1000 && ms % 1000 === 0) return ` // ${ms / 1000} s`;
  return "";
}

function modeValue(policy: RoutingPolicy): string {
  return policy.mode.kind === "auto" ? "auto" : `pinned:${policy.mode.providerId}`;
}

/**
 * TypeScript and Python SDK samples that request the market with the given policy.
 * The policy values are embedded, so the dialog matches the current form.
 */
export function getApiSnippets(market: SnippetMarket, policy: RoutingPolicy): CodeSample[] {
  const quote = isQuoteMarketId(market.id) ? QUOTE_CONTRACTS[market.id] : null;
  const call = quote
    ? { ts: `tender.${quote.namespace}({ ${quote.key}: "${quote.value}" }`, py: `tender.${quote.namespace}(\n    ${quote.key}="${quote.value}",` }
    : market.id === "sf-weather"
      ? { ts: `tender.weather.current({ location: "san-francisco" }`, py: `tender.weather.current(\n    location="san-francisco",` }
      : { ts: `tender.prices.spot({ pair: "BTC-USD" }`, py: `tender.prices.spot(\n    pair="BTC-USD",` };
  const read = quote
    ? { ts: "result.data.value", py: 'result.data["value"]' }
    : market.id === "sf-weather"
      ? { ts: "result.data.temperatureF", py: 'result.data["temperatureF"]' }
      : { ts: "result.data.priceUsd", py: 'result.data["priceUsd"]' };

  const typescript = `import { Tender } from "@tender/sdk";

const tender = new Tender({ apiKey: process.env.TENDER_API_KEY });

const result = await ${call.ts}, {
  policy: {
    maxPrice: ${tsNumber(policy.maxPrice)}, // USD per 1M requests
    maxP95LatencyMs: ${tsNumber(policy.maxP95LatencyMs)},
    maxDataAgeMs: ${tsNumber(policy.maxDataAgeMs)},${ageComment(policy.maxDataAgeMs)}
    minSuccessRate: ${tsNumber(policy.minSuccessRate)},
    preference: "${policy.preference}",
    mode: "${modeValue(policy)}",
  },
});

console.log(result.servedBy, ${read.ts});
`;

  const python = `import os
from tender import Tender

tender = Tender(api_key=os.environ["TENDER_API_KEY"])

result = ${call.py}
    policy={
        "max_price": ${tsNumber(policy.maxPrice)},  # USD per 1M requests
        "max_p95_latency_ms": ${tsNumber(policy.maxP95LatencyMs)},
        "max_data_age_ms": ${tsNumber(policy.maxDataAgeMs)},
        "min_success_rate": ${tsNumber(policy.minSuccessRate)},
        "preference": "${policy.preference}",
        "mode": "${modeValue(policy)}",
    },
)

print(result.served_by, ${read.py})
`;

  return [
    { language: "typescript", label: "TypeScript", code: typescript },
    { language: "python", label: "Python", code: python },
  ];
}

const iso = (ms: number) => new Date(ms).toISOString();
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

/** JSON body the API returns for a request result (pretty-printed). */
export function getResponseJson(market: SnippetMarket, result: RequestResult): string {
  const base = { id: result.requestId, market: market.identifier, requestedAt: iso(result.requestedAt) };
  if (result.status === "rejected") {
    return JSON.stringify(
      { ...base, status: "rejected", error: { code: "no_eligible_provider", message: "No eligible provider" } },
      null,
      2,
    );
  }
  if (result.status === "failed") {
    return JSON.stringify(
      {
        ...base,
        status: "failed",
        servedBy: result.providerId,
        latencyMs: result.latencyMs,
        error: { code: result.error.code, message: result.error.message },
      },
      null,
      2,
    );
  }
  const common = {
    ...base,
    status: "ok",
    servedBy: result.providerId,
    latencyMs: result.latencyMs,
    dataAgeMs: result.dataAgeMs,
    costUsd: round(result.cost, 10),
  };
  if (result.payload.kind === "weather") {
    const p = result.payload;
    return JSON.stringify(
      {
        ...common,
        data: {
          location: p.location,
          observedAt: iso(p.observedAt),
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
        },
      },
      null,
      2,
    );
  }
  const p = result.payload;
  if (p.kind === "quote") {
    return JSON.stringify(
      { ...common, data: { symbol: p.symbol, value: p.value, unit: p.unit, changeValue: p.changeValue, sourceTimestamp: iso(p.sourceTimestamp) } },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      ...common,
      data: {
        pair: p.pair,
        priceUsd: p.priceUsd,
        changeUsd: p.changeUsd,
        sourceTimestamp: iso(p.sourceTimestamp),
      },
    },
    null,
    2,
  );
}
