import { CONTRACTS, MARKET_SPECS, contractPath, type ContractSpec } from "@/lib/registry";
import { MARKET_IDS } from "@/lib/tender";
import { outputSchema } from "./openapi-schema";
import { POLICY_PARAMETERS, PREFERENCES } from "./policy";

const string = { type: "string" };
const number = { type: "number" };
const timestamp = { type: "string", format: "date-time" };
const nullableString = { type: ["string", "null"] };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const content = (name: string) => ({ "application/json": { schema: ref(name) } });
const policyParameterList = [
  ...POLICY_PARAMETERS.flatMap((p) => [
    { name: p.query, in: "query", description: `${p.description}. Takes precedence over ${p.header}.`, schema: { type: "number", minimum: 0, maximum: p.max } },
    { name: p.header, in: "header", description: p.description, schema: { type: "number", minimum: 0, maximum: p.max } },
  ]),
  ...["query", "header"].flatMap((where) => [
    { name: where === "query" ? "preference" : "Tender-Preference", in: where, schema: { type: "string", enum: PREFERENCES } },
    { name: where === "query" ? "pin" : "Tender-Pin", in: where, description: "Provider id in this market. A pin never silently reroutes; policy violations are reported.", schema: string },
  ]),
];
/** Shared parameter definitions, referenced by every operation that accepts a policy. */
const parameterComponents = Object.fromEntries(policyParameterList.map((parameter) => [`${parameter.in}-${parameter.name}`, parameter]));
const policyParameters = Object.keys(parameterComponents).map((name) => ({ $ref: `#/components/parameters/${name}` }));
const preflightOperation = {
  summary: "CORS preflight",
  description: "Cross-origin browser clients may call the v1 API without credentials. Answers OPTIONS with 204, Access-Control-Allow-Origin: *, Access-Control-Allow-Methods: GET, OPTIONS, Access-Control-Allow-Headers covering payment, policy, and Content-Type headers, and Access-Control-Max-Age: 600. Not available on the console payment endpoints.",
  responses: { "204": { description: "Preflight accepted; no payload", headers: {
    "Access-Control-Allow-Origin": { description: "Always * for the public v1 API", schema: string },
    "Access-Control-Allow-Methods": { description: "GET, OPTIONS", schema: string },
    "Access-Control-Allow-Headers": { description: "PAYMENT-SIGNATURE, X-PAYMENT, Content-Type, Tender-Max-Price, Tender-Max-P95-Ms, Tender-Max-Data-Age-Ms, Tender-Min-Success-Rate, Tender-Preference, Tender-Pin", schema: string },
    "Access-Control-Max-Age": { description: "Preflight cache lifetime in seconds: 600", schema: string },
  } } },
};
const routeHeaderList = {
  "Tender-Provider": { description: "Selected provider id, identical to the quoted payee's provider", schema: string },
  "Tender-Route-Reason": { description: "Automatic ranking preference or explicit pin", schema: string },
  "Tender-Policy-Violation": { description: "true when a pinned provider fails the policy", schema: { type: "string", enum: ["true", "false"] } },
  "Tender-Price-USD": { description: "Exact winning bid divided by 1,000,000 requests, as a decimal string; matches the JSON price_usd", schema: string },
  "Tender-Settled-Atomic": { description: "USDC atomic units (6 decimals) actually settled, encoded as an integer string; matches the JSON settled_atomic", schema: string },
};
const headerComponents = routeHeaderList;
const routeHeaders = Object.fromEntries(Object.keys(routeHeaderList).map((name) => [name, { $ref: `#/components/headers/${name}` }]));
const allowHeader = { description: "Methods the target resource accepts; GET only across the v1 API", schema: string };
const errors = {
  "400": { description: "Invalid contract input or policy", content: content("Error") },
  "405": { description: "Method not allowed; the operation accepts GET only", headers: { Allow: allowHeader }, content: content("Error") },
  "409": { description: "No eligible provider; no payment requested", content: content("Error") },
  "500": { description: "Selected provider failed; no settlement", content: content("ProviderError") },
  "502": { description: "Selected provider failed; no settlement", content: content("ProviderError") },
  "503": { description: "provider_error (selected provider unavailable, no settlement) or payment_unavailable (payment service unavailable, no payload)", content: { "application/json": { schema: { oneOf: [ref("ProviderError"), ref("PaymentUnavailable")] } } } },
  "504": { description: "Selected provider timed out; no settlement", content: content("ProviderError") },
};
/** `weather.current` → "WeatherCurrent". */
const pascal = (contractId: string) =>
  contractId.split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
const camel = (contractId: string) => pascal(contractId).charAt(0).toLowerCase() + pascal(contractId).slice(1);

/** Paid operation of one contract: params bound by markets, policy inputs, payment flow, result schema. */
function paidOperation(contract: ContractSpec) {
  const markets = MARKET_SPECS.filter((market) => market.contractId === contract.id);
  const params = contract.params.map((param) => {
    const values = [...new Set(markets.map((market) => market.params[param.key]).filter((value): value is string => typeof value === "string"))];
    return {
      name: param.key,
      in: "query",
      description: `${param.label}${param.description ? `. ${param.description}` : ""}. Omit every contract parameter to use the default market.`,
      schema: { type: "string", enum: values, example: param.example },
    };
  });
  return {
    operationId: camel(contract.id),
    summary: contract.label,
    description: `${contract.description} Paid per request in USDC on Base Sepolia (eip155:84532). First request returns HTTP 402. Retry the same URL and policy with PAYMENT-SIGNATURE. One routing decision binds the quote and response. Amounts below the USDC minimum unit are rounded up explicitly.`,
    parameters: [
      ...params,
      { name: contract.params.some((param) => param.key === "market") ? "tender_market" : "market", in: "query", description: "Market id implementing this contract. Selects the market explicitly; contract parameters, if given, must match it.", schema: { type: "string", enum: markets.map((market) => market.id) } },
      ...policyParameters,
      { name: "PAYMENT-SIGNATURE", in: "header", description: "Base64 x402 v2 PaymentPayload", schema: string },
    ],
    responses: {
      "200": { description: "Result with exact bid and settled amounts", content: content(`${pascal(contract.id)}Result`), headers: { ...routeHeaders, "PAYMENT-RESPONSE": { description: "Base64 x402 settlement receipt", schema: string } } },
      "402": { $ref: "#/components/responses/PaymentRequired" },
      "400": { $ref: "#/components/responses/UnsupportedInput" },
      ...Object.fromEntries(Object.keys(errors).filter((status) => status !== "400").map((status) => [status, { $ref: `#/components/responses/Error${status}` }])),
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
const requiredResult = ["request_id", "market", "contract", "provider", "latency_ms", "data_age_ms", "price_usd", "settled_usd", "settled_atomic", "policy_violation", "reference_source", "reference_timestamp", "data"];

/** Result envelope of a contract: routing, settlement, and the contract-shaped `data`. */
function resultSchema(contract: ContractSpec) {
  return {
    type: "object",
    required: requiredResult,
    properties: { ...result, market: string, contract: { const: contract.id }, data: outputSchema(contract) },
  };
}

const contractPaths = Object.fromEntries(
  CONTRACTS.map((contract) => [contractPath(contract.id).replace(/^\/api\/v1/, ""), { get: paidOperation(contract), options: preflightOperation }]),
);
const responseComponents = {
  PaymentRequired: { description: "Payment required or payment rejected. Description and quote include exact price and settled amount.", headers: { ...routeHeaders, "PAYMENT-REQUIRED": { description: "Base64 x402 v2 PaymentRequired", schema: string } }, content: content("PaymentRequired") },
  UnsupportedInput: { description: "Invalid contract input or policy. Unsupported inputs list the supported markets and params.", content: content("UnsupportedInput") },
  ...Object.fromEntries(Object.entries(errors).filter(([status]) => status !== "400").map(([status, response]) => [`Error${status}`, response])),
};
const contractSchemas = Object.fromEntries(CONTRACTS.map((contract) => [`${pascal(contract.id)}Result`, resultSchema(contract)]));

export const openapiDocument = {
  openapi: "3.1.0",
  info: { title: "Tender API", version: "2.0.0", description: "Policy-based API routing. Every market implements a contract (typed params in, typed fields out) served at /{namespace}/{action}; results wrap the contract-shaped fields in `data`. Prices are USD per 1M requests; settlement is per-request USDC on Base Sepolia. Console cooldowns and notifications do not apply to this stateless API. Every v1 response is callable from any browser origin: Access-Control-Allow-Origin is always *, with no credentials; OPTIONS preflight answers 204 with Access-Control-Max-Age: 600." },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/markets": { get: { operationId: "listMarkets", summary: "List markets", responses: { "200": { description: "Available markets", content: content("MarketList") }, "405": errors["405"] } }, options: preflightOperation },
    "/markets/{market}": { get: { operationId: "getMarket", summary: "Provider bids and routing decision", parameters: [{ name: "market", in: "path", required: true, schema: { type: "string", enum: [...MARKET_IDS] } }, ...policyParameters], responses: { "200": { description: "Market detail and evaluation", content: content("MarketDetail") }, "400": errors["400"], "404": { description: "Unknown market", content: content("Error") }, "405": errors["405"] } }, options: preflightOperation },
    "/categories": { get: { operationId: "listCategories", summary: "Groups and categories with market counts", responses: { "200": { description: "Market hierarchy", content: content("CategoryList") }, "405": errors["405"] } }, options: preflightOperation },
    "/contracts": { get: { operationId: "listContracts", summary: "Contracts with their params and result schemas", responses: { "200": { description: "Every contract", content: content("ContractList") }, "405": errors["405"] } }, options: preflightOperation },
    ...contractPaths,
    "/openapi.json": { get: { operationId: "getOpenAPI", summary: "OpenAPI document", responses: { "200": { description: "OpenAPI 3.1 document", content: { "application/json": { schema: { type: "object" } } } }, "405": errors["405"] } }, options: preflightOperation },
  },
  components: {
  parameters: parameterComponents,
  headers: headerComponents,
  responses: responseComponents,
  schemas: {
    Error: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: string, message: string } } } },
    ProviderError: { type: "object", required: ["error", "provider", "request_id", "latency_ms", "policy_violation", "policy_violations"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: { const: "provider_error" }, message: string } }, provider: string, request_id: string, latency_ms: number, policy_violation: { type: "boolean" }, policy_violations: { type: "array", items: string } } },
    PaymentUnavailable: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: { const: "payment_unavailable" }, message: { const: "Payment service unavailable" } } } } },
    Policy: { type: "object", required: ["maxPrice", "maxP95LatencyMs", "maxDataAgeMs", "minSuccessRate", "preference", "mode"], properties: {
      maxPrice: number, maxP95LatencyMs: number, maxDataAgeMs: number, minSuccessRate: { type: "number", minimum: 0, maximum: 1 }, preference: { type: "string", enum: PREFERENCES },
      mode: { oneOf: [{ type: "object", required: ["kind"], properties: { kind: { const: "auto" } } }, { type: "object", required: ["kind", "providerId"], properties: { kind: { const: "pinned" }, providerId: string } }] },
    } },
    Market: { type: "object", required: ["id", "name", "identifier", "description", "group", "category", "contract", "contract_id", "contract_path", "contract_url", "params", "units", "policy_defaults", "provider_count"], properties: {
      id: string, name: string, short_name: string, identifier: string, description: string,
      group: { type: "object", properties: { id: string, label: string } }, category: { type: "object", properties: { id: string, label: string } },
      contract: { ...string, description: "Contract call with the market's params bound, e.g. weather.current({ location: \"san-francisco\" })" },
      contract_id: string, contract_path: { ...string, description: "/api/v1/{namespace}/{action}" }, contract_url: { ...string, description: "Contract path with the market's params as query parameters" },
      params: { type: "object", additionalProperties: string },
      image: { type: ["object", "null"], properties: { src: string, avif: string, alt: string } }, icon: string, time_zone: string, featured: { type: "boolean" },
      units: { type: "object", additionalProperties: string }, policy_defaults: ref("Policy"), provider_count: { type: "integer" },
    } },
    MarketList: { type: "object", required: ["markets"], properties: { markets: { type: "array", items: ref("Market") } } },
    Evaluation: { type: "object", properties: { qualifies: { type: "boolean" }, status: string, rank: { type: ["integer", "null"] }, reasons: { type: "array", items: { type: "object", properties: { check: string, status: string, message: string, value: number, limit: number } } } } },
    Provider: { type: "object", properties: { id: string, name: string, logo: string, bid_per_million: number, p95_latency_ms: number, data_age_ms: number, success_rate: number, available: { type: "boolean" }, evaluation: ref("Evaluation") } },
    RoutingDecision: { type: "object", properties: { active_provider: nullableString, recommended_provider: nullableString, ranking: { type: "array", items: string }, reason: string, policy_violation: { type: "boolean" }, policy_violations: { type: "array", items: string } } },
    MarketDetail: { allOf: [ref("Market"), { type: "object", required: ["policy", "providers", "routing"], properties: { policy: ref("Policy"), providers: { type: "array", items: ref("Provider") }, routing: ref("RoutingDecision") } }] },
    ...contractSchemas,
    UnsupportedInput: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: { const: "unsupported_input" }, message: string } }, contract: string, supported: { type: "array", items: { type: "object", properties: { market: string, params: { type: "object", additionalProperties: string } } } } } },
    CategoryList: { type: "object", required: ["groups"], properties: { groups: { type: "array", items: { type: "object", properties: { id: string, label: string, description: string, market_count: { type: "integer" }, categories: { type: "array", items: { type: "object", properties: { id: string, label: string, description: string, icon: string, focus: { type: "array", items: string }, market_count: { type: "integer" } } } } } } } } },
    ContractList: { type: "object", required: ["contracts"], properties: { contracts: { type: "array", items: { type: "object", properties: { id: string, version: { type: "integer" }, label: string, description: string, path: string, params: { type: "array", items: { type: "object" } }, output: { type: "array", items: { type: "object" } }, output_schema: { type: "object" }, freshness: { type: "object" }, result_view: string, pricing_unit: string, markets: { type: "array", items: { type: "object", properties: { id: string, params: { type: "object", additionalProperties: string } } } } } } } } },
    PaymentRequired: { type: "object", description: "Tender payment challenge body. Standard x402 v2 requirements are encoded in PAYMENT-REQUIRED, including accepts[].extra settlement metadata.", required: ["error", "providerId", "payTo", "price_usd", "settled_usd", "settled_atomic"], properties: { error: { type: "string" }, providerId: string, payTo: string, ...settlement } },
  } },
};
