/**
 * Code samples and JSON views for the API dialog, in the HTTP API's response shape.
 * Pure string builders; safe on the server.
 */
import { contractPath, getContract, getMarketSpec, readField, sampleFor } from "@/lib/registry";
import type { CodeSample, MarketId, ProviderFixture, RequestResult, RoutingPolicy, ServedRequestResult } from "./types";

/** Market reference for snippets. Everything else comes from the registry. */
interface SnippetMarket {
  id: MarketId;
  /** Unused; kept for callers that pass a definition. */
  identifier?: string;
  /** Unused; kept for callers that pass a definition. */
  dataAgeUnit?: "min" | "ms";
}

const BASE_URL = "https://tender.heyarca.app";

function tsNumber(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) >= 10_000) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "_");
  }
  return String(Number(value.toFixed(6)));
}

function ageComment(ms: number, marker: "//" | "#"): string {
  if (ms >= 60_000 && ms % 60_000 === 0) return `  ${marker} ${ms / 60_000} min`;
  if (ms >= 1000 && ms % 1000 === 0) return `  ${marker} ${ms / 1000} s`;
  return "";
}

/** JS/TS property access for a dotted key: `home.score` → `.home.score`. */
const tsPath = (key: string) => key.split(".").map((part) => (/^[A-Za-z_$][\w$]*$/.test(part) ? `.${part}` : `[${JSON.stringify(part)}]`)).join("");
/** Python dict access for a dotted key: `home.score` → `["home"]["score"]`. */
const pyPath = (key: string) => key.split(".").map((part) => `[${JSON.stringify(part)}]`).join("");

/**
 * TypeScript (SDK) and Python (HTTP) samples that request the market with the given policy.
 * The policy values are embedded, so the dialog matches the current form.
 */
export function getApiSnippets(market: SnippetMarket, policy: RoutingPolicy): CodeSample[] {
  const spec = getMarketSpec(market.id);
  const contract = spec ? getContract(spec.contractId) : undefined;
  const primary = contract?.output.find((field) => field.primary)?.key ?? "";
  const pin = policy.mode.kind === "pinned" ? policy.mode.providerId : null;

  const typescript = `import { createTender } from "@heyarca/tender";

// Pass an x402-aware fetch (for example from @x402/fetch) to pay per request in USDC.
const tender = createTender({ fetch: x402Fetch });

const result = await tender.request("${market.id}", {
  maxPrice: ${tsNumber(policy.maxPrice)}, // USD per 1M requests
  maxP95LatencyMs: ${tsNumber(policy.maxP95LatencyMs)},
  maxDataAgeMs: ${tsNumber(policy.maxDataAgeMs)},${ageComment(policy.maxDataAgeMs, "//").trimEnd().replace(/^ {2}/, " ")}
  minSuccessRate: ${tsNumber(policy.minSuccessRate)},
  preference: "${policy.preference}",${pin ? `\n  pin: "${pin}",` : ""}
});

console.log(result.provider, result.data${primary ? tsPath(primary) : ""});
`;

  const params = Object.entries(spec?.params ?? {}).map(([key, value]) => `        "${key}": ${JSON.stringify(value)},`);
  const python = `import requests

# The first call returns 402 with the x402 payment requirements (price, provider, payee).
# Pay with an x402 client and retry with the PAYMENT-SIGNATURE header.
response = requests.get(
    "${BASE_URL}${contractPath(spec?.contractId ?? "")}",
    params={
${[...params,
    `        "max_price": ${tsNumber(policy.maxPrice)},  # USD per 1M requests`,
    `        "max_p95_ms": ${tsNumber(policy.maxP95LatencyMs)},`,
    `        "max_data_age_ms": ${policy.maxDataAgeMs},${ageComment(policy.maxDataAgeMs, "#")}`,
    `        "min_success_rate": ${tsNumber(policy.minSuccessRate)},`,
    `        "preference": "${policy.preference}",`,
    ...(pin ? [`        "pin": "${pin}",`] : []),
  ].join("\n")}
    },
)

result = response.json()
print(response.headers.get("Tender-Provider"), result.get("data", {})${primary ? pyPath(primary).replace(/^\[("[^"]+")\]/, ".get($1)") : ""})
`;

  return [
    { language: "typescript", label: "TypeScript", code: typescript },
    { language: "python", label: "Python", code: python },
  ];
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Contract-shaped `data` of a served result (timestamps as ISO strings). */
export function resultData(result: ServedRequestResult): Record<string, unknown> {
  const p = result.payload;
  if (p.kind === "fields") return p.values;
  if (p.kind === "btc") {
    return {
      pair: p.pair,
      priceUsd: p.priceUsd,
      ...(p.changeUsd !== null ? { changeUsd: p.changeUsd } : {}),
      sourceTimestamp: iso(p.sourceTimestamp),
    };
  }
  return {
    location: p.location,
    observedAt: iso(p.observedAt),
    temperatureF: p.temperatureF,
    feelsLikeF: p.feelsLikeF,
    condition: p.condition,
    humidityPct: p.humidityPct,
    windMph: p.windMph,
    windDirectionDeg: p.windDirectionDeg,
    windDirection: p.windDirection,
    pressureHpa: p.pressureHpa,
    visibilityMi: p.visibilityMi,
    dewPointF: p.dewPointF,
    cloudCoverPct: p.cloudCoverPct,
  };
}

/** Value of a dotted field in a served result's data (`readField` over `resultData`). */
export function resultField(result: ServedRequestResult, key: string): unknown {
  return readField(resultData(result), key);
}

/** JSON body the API returns for a request result (pretty-printed). */
export function getResponseJson(market: SnippetMarket, result: RequestResult): string {
  const spec = getMarketSpec(market.id);
  const base = { request_id: result.requestId, market: market.id, contract: spec?.contractId ?? null };
  if (result.status === "rejected") {
    return JSON.stringify({ error: { code: "no_eligible_provider", message: "No eligible provider" }, ...base }, null, 2);
  }
  if (result.status === "failed") {
    return JSON.stringify(
      { error: { code: "provider_error", message: result.error.message }, ...base, provider: result.providerId, latency_ms: result.latencyMs },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      ...base,
      provider: result.providerId,
      latency_ms: result.latencyMs,
      data_age_ms: result.dataAgeMs,
      price_usd: Number(result.cost.toFixed(12)),
      requested_at: iso(result.requestedAt),
      data: resultData(result),
    },
    null,
    2,
  );
}

/** Example response of a market before any request ran, from the registry sample. */
export function sampleResponseJson(marketId: MarketId, provider: ProviderFixture | undefined): string {
  const spec = getMarketSpec(marketId);
  const data = spec ? sampleFor(spec) : {};
  return JSON.stringify(
    {
      request_id: "req_000001",
      market: marketId,
      contract: spec?.contractId ?? null,
      provider: provider?.id ?? null,
      latency_ms: provider ? Math.round(provider.defaults.p95LatencyMs * 0.6) : 0,
      data_age_ms: provider?.defaults.dataAgeMs ?? 0,
      price_usd: provider ? provider.defaults.bidPrice / 1e6 : 0,
      requested_at: "2026-11-09T18:30:00.000Z",
      data,
    },
    null,
    2,
  );
}
