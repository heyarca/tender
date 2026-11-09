import { POLICY_PARAMETERS, PREFERENCES } from "./policy";

const string = { type: "string" };
const number = { type: "number" };
const timestamp = { type: "string", format: "date-time" };
const nullableString = { type: ["string", "null"] };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const content = (name: string) => ({ "application/json": { schema: ref(name) } });
const policyParameters = [
  ...POLICY_PARAMETERS.flatMap((p) => [
    { name: p.query, in: "query", description: `${p.description}. Takes precedence over ${p.header}.`, schema: { type: "number", minimum: 0, maximum: p.max } },
    { name: p.header, in: "header", description: p.description, schema: { type: "number", minimum: 0, maximum: p.max } },
  ]),
  ...["query", "header"].flatMap((where) => [
    { name: where === "query" ? "preference" : "Tender-Preference", in: where, schema: { type: "string", enum: PREFERENCES } },
    { name: where === "query" ? "pin" : "Tender-Pin", in: where, description: "Provider id in this market. A pin never silently reroutes; policy violations are reported.", schema: string },
  ]),
];
const routeHeaders = {
  "Tender-Provider": { description: "Selected provider id, identical to the quoted payee's provider", schema: string },
  "Tender-Route-Reason": { description: "Automatic ranking preference or explicit pin", schema: string },
  "Tender-Policy-Violation": { description: "true when a pinned provider fails the policy", schema: { type: "string", enum: ["true", "false"] } },
};
const errors = {
  "400": { description: "Invalid contract input or policy", content: content("Error") },
  "409": { description: "No eligible provider; no payment requested", content: content("Error") },
  "503": { description: "Selected provider unavailable or payment service unavailable", content: content("Error") },
};
function paidOperation(operationId: string, parameter: string, value: string, schema: string) {
  return {
    operationId,
    summary: operationId === "weatherCurrent" ? "Current San Francisco conditions" : "BTC/USD spot price",
    description: "Paid per request in USDC on Base Sepolia (eip155:84532). First request returns HTTP 402. Retry the same URL and policy with PAYMENT-SIGNATURE. One routing decision binds the quote and response. Amounts below the USDC minimum unit are rounded up explicitly.",
    parameters: [
      { name: parameter, in: "query", schema: { type: "string", enum: [value], default: value } },
      ...policyParameters,
      { name: "PAYMENT-SIGNATURE", in: "header", description: "Base64 x402 v2 PaymentPayload", schema: string },
    ],
    responses: {
      "200": { description: "Normalized result with exact bid and settled amounts", content: content(schema), headers: { ...routeHeaders, "PAYMENT-RESPONSE": { description: "Base64 x402 settlement receipt", schema: string } } },
      "402": { description: "Payment required or payment rejected. Description and quote include exact price and settled amount.", headers: { ...routeHeaders, "PAYMENT-REQUIRED": { description: "Base64 x402 v2 PaymentRequired", schema: string } }, content: content("PaymentRequired") },
      ...errors,
    },
  };
}
const settlement = {
  price_usd: { ...number, description: "Exact winning bid / 1,000,000; per-request USD price" },
  settled_usd: { ...number, description: "USDC settlement, rounded up to a whole atomic unit" },
  settled_atomic: { type: "string", pattern: "^[0-9]+$", description: "USDC atomic units (6 decimals)" },
  settlement_note: { type: "string", description: "Present if rounding applies: Rounded up to the USDC minimum unit (0.000001)" },
};
const result = {
  provider: string, latency_ms: number, data_age_ms: number, request_id: string,
  policy_violation: { type: "boolean" }, policy_violations: { type: "array", items: string },
  reference_source: { type: "string", description: "Reference input provenance, not a Tender provider" },
  reference_timestamp: { ...timestamp, description: "Actual reference input timestamp; distinct from provider-model observation time" },
  ...settlement,
};
const requiredResult = ["provider", "latency_ms", "data_age_ms", "request_id", "price_usd", "settled_usd", "settled_atomic", "policy_violation", "reference_source", "reference_timestamp"];
export const openapiDocument = {
  openapi: "3.1.0",
  info: { title: "Tender API", version: "1.0.0", description: "Policy-based API routing. Prices are USD per 1M requests; settlement is per-request USDC on Base Sepolia. Console cooldowns and notifications do not apply to this stateless API." },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/markets": { get: { operationId: "listMarkets", summary: "List markets", responses: { "200": { description: "Available markets", content: content("MarketList") } } } },
    "/markets/{market}": { get: { operationId: "getMarket", summary: "Provider bids and routing decision", parameters: [{ name: "market", in: "path", required: true, schema: { type: "string", enum: ["sf-weather", "btc-usd"] } }, ...policyParameters], responses: { "200": { description: "Market detail and evaluation", content: content("MarketDetail") }, "400": errors["400"], "404": { description: "Unknown market", content: content("Error") } } } },
    "/weather/current": { get: paidOperation("weatherCurrent", "location", "san-francisco", "WeatherResult") },
    "/prices/spot": { get: paidOperation("pricesSpot", "pair", "BTC-USD", "PriceResult") },
    "/openapi.json": { get: { operationId: "getOpenAPI", summary: "OpenAPI document", responses: { "200": { description: "OpenAPI 3.1 document", content: { "application/json": { schema: { type: "object" } } } } } } },
  },
  components: { schemas: {
    Error: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: string, message: string } } } },
    Policy: { type: "object", required: ["maxPrice", "maxP95LatencyMs", "maxDataAgeMs", "minSuccessRate", "preference", "mode"], properties: {
      maxPrice: number, maxP95LatencyMs: number, maxDataAgeMs: number, minSuccessRate: { type: "number", minimum: 0, maximum: 1 }, preference: { type: "string", enum: PREFERENCES },
      mode: { oneOf: [{ type: "object", required: ["kind"], properties: { kind: { const: "auto" } } }, { type: "object", required: ["kind", "providerId"], properties: { kind: { const: "pinned" }, providerId: string } }] },
    } },
    Market: { type: "object", required: ["id", "name", "identifier", "contract", "description", "units", "policy_defaults", "provider_count"], properties: {
      id: string, name: string, identifier: string, contract: string, description: string, units: { type: "object", additionalProperties: string }, policy_defaults: ref("Policy"), provider_count: { type: "integer" },
    } },
    MarketList: { type: "object", required: ["markets"], properties: { markets: { type: "array", items: ref("Market") } } },
    Evaluation: { type: "object", properties: { qualifies: { type: "boolean" }, status: string, rank: { type: ["integer", "null"] }, reasons: { type: "array", items: { type: "object", properties: { check: string, status: string, message: string, value: number, limit: number } } } } },
    Provider: { type: "object", properties: { id: string, name: string, logo: string, bid_per_million: number, p95_latency_ms: number, data_age_ms: number, success_rate: number, available: { type: "boolean" }, evaluation: ref("Evaluation") } },
    RoutingDecision: { type: "object", properties: { active_provider: nullableString, recommended_provider: nullableString, ranking: { type: "array", items: string }, reason: string, policy_violation: { type: "boolean" }, policy_violations: { type: "array", items: string } } },
    MarketDetail: { allOf: [ref("Market"), { type: "object", required: ["policy", "providers", "routing"], properties: { policy: ref("Policy"), providers: { type: "array", items: ref("Provider") }, routing: ref("RoutingDecision") } }] },
    WeatherResult: { type: "object", required: [...requiredResult, "location", "observed_at", "temperature_f"], properties: { ...result,
      location: { type: "object", properties: { name: string, latitude: number, longitude: number } }, observed_at: timestamp,
      temperature_f: number, feels_like_f: number, condition: string, humidity_percent: number, wind_mph: number, wind_direction_degrees: number, wind_direction: string, pressure_hpa: number, visibility_mi: number, dew_point_f: number, cloud_cover_percent: number,
    } },
    PriceResult: { type: "object", required: [...requiredResult, "pair", "price", "source_timestamp"], properties: { ...result, pair: { const: "BTC-USD" }, price: { type: "number", description: "BTC spot price in USD, two decimals" }, currency: { const: "USD" }, change_usd: { type: ["number", "null"], description: "Null: stateless API has no previous-request history" }, source_timestamp: timestamp } },
    PaymentRequired: { type: "object", description: "x402 v2 requirements, with Tender quote metadata", properties: { x402Version: { const: 2 }, error: string, resource: { type: "object" }, accepts: { type: "array", items: { type: "object", properties: { scheme: { const: "exact" }, network: { const: "eip155:84532" }, amount: string, asset: string, payTo: string, maxTimeoutSeconds: { type: "integer" }, extra: { type: "object" } } } }, quote: { type: "object", properties: settlement } } },
  } },
};
