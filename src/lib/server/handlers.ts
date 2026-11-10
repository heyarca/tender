import { randomUUID } from "node:crypto";
import { getContract, getMarketSpec, listMarkets as listRegistryMarkets, readField, type ContractSpec, type MarketSpec } from "@/lib/registry";
import {
  executeSelection,
  getMarketDefinition,
  resultData,
  sanitizeConditionsPatch,
  seedFromString,
  selectRoute,
  type ConditionsPatch,
  type MarketId,
  type MarketReference,
  type ProviderConditions,
  type ProviderId,
  type RouteSelection,
} from "@/lib/tender";
import { quoteFromBid, withX402Payment, type SettlementAmounts } from "@/lib/payments/server";
import { ApiError, errorResponse, json } from "./http";
import { requestPolicy } from "./markets";
import { getPriceReference, getWeatherReference } from "./reference";

/** Trusted in-process inputs only. Public contract routes never parse these from HTTP. */
export interface ContractOptions {
  conditions?: Partial<Record<ProviderId, ConditionsPatch>>;
}
function conditionOverrides(marketId: MarketId, patches: ContractOptions["conditions"]): Partial<Record<ProviderId, ProviderConditions>> | undefined {
  if (!patches || typeof patches !== "object" || Array.isArray(patches)) return undefined;
  const conditions: Partial<Record<ProviderId, ProviderConditions>> = {};
  // Iterate the bounded market roster, not caller keys. Unknown providers are ignored.
  for (const provider of getMarketDefinition(marketId).providers) {
    if (!Object.hasOwn(patches, provider.id)) continue;
    const patch = patches[provider.id];
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
    conditions[provider.id] = { ...provider.defaults, ...sanitizeConditionsPatch(marketId, patch) };
  }
  return conditions;
}

/** Older contract paths that now serve a registry contract. */
const CONTRACT_ALIASES: Readonly<Record<string, string>> = {
  "components.spot": "components.price",
};

/** Registry contract for a `{namespace}.{action}` path, following aliases. */
export function contractForPath(namespace: string, action: string): ContractSpec | undefined {
  const id = `${namespace}.${action}`;
  return getContract(CONTRACT_ALIASES[id] ?? id);
}

const sameValue = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Markets that implement a contract, in registry order. */
export function contractMarkets(contractId: string): MarketSpec[] {
  return listRegistryMarkets().filter((market) => market.contractId === contractId);
}

/** Market a contract serves when the request names no params: its live-anchored market, else the first one. */
function defaultMarket(contractId: string): MarketSpec | undefined {
  const markets = contractMarkets(contractId);
  return markets.find((market) => market.source === "upstream") ?? markets[0];
}

const paramText = (market: MarketSpec) =>
  Object.entries(market.params).map(([key, value]) => `${key}=${value}`).join("&") || market.id;

/**
 * Query keys that select a market explicitly. `tender_market` always works; `market` also works unless the
 * contract has its own `market` parameter (components.price), where `market` stays a contract parameter.
 */
export function marketSelectorKeys(contract: ContractSpec): readonly string[] {
  return contract.params.some((param) => param.key === "market") ? ["tender_market"] : ["market", "tender_market"];
}

/**
 * Resolve the market of a contract request from its query: an explicit market id, the market whose
 * params match every given contract param (case-insensitive), or the contract's default market when
 * no contract param is given. Throws a 400 that lists the supported values when nothing matches.
 */
export function resolveContractMarket(contract: ContractSpec, query: URLSearchParams): MarketId {
  const markets = contractMarkets(contract.id);
  const unsupported = (message: string) => {
    const supported = markets.map((market) => ({ market: market.id, params: market.params }));
    return new ContractInputError(`${message}. Supported: ${markets.map(paramText).join(", ")}.`, supported);
  };
  const explicit = marketSelectorKeys(contract).flatMap((key) => query.getAll(key));
  if (explicit.length > 1) throw unsupported("Send one market value");
  const given: [string, string][] = [];
  for (const param of contract.params) {
    const values = query.getAll(param.key);
    if (values.length > 1) throw unsupported(`Send one ${param.key} value`);
    if (values.length === 1) given.push([param.key, values[0]]);
  }
  const matches = (market: MarketSpec) => given.every(([key, value]) => sameValue(market.params[key] ?? "", value));
  if (explicit.length === 1) {
    const market = markets.find((candidate) => candidate.id === explicit[0]);
    if (!market || !matches(market)) throw unsupported(`Unsupported market: ${explicit[0]}`);
    return market.id;
  }
  const market = given.length === 0 ? defaultMarket(contract.id) : markets.find(matches);
  if (!market) throw unsupported(`Unsupported ${given.map(([key, value]) => `${key}=${value}`).join("&")}`);
  return market.id;
}

/** 400 `unsupported_input` that also lists the supported markets and their params. */
export class ContractInputError extends ApiError {
  constructor(message: string, public readonly supported: { market: string; params: Readonly<Record<string, string>> }[]) {
    super(400, "unsupported_input", message);
  }
}

/** Every contract param in the query must match the market (case-insensitive); a market selector, if given, must name it. */
function validateContract(request: Request, marketId: MarketId) {
  if (request.method !== "GET") throw new ApiError(405, "method_not_allowed", "Use GET for this contract");
  const spec = getMarketSpec(marketId);
  const query = new URL(request.url).searchParams;
  const contract = spec ? getContract(spec.contractId) : undefined;
  const explicit = (contract ? marketSelectorKeys(contract) : ["market", "tender_market"]).flatMap((key) => query.getAll(key));
  if (explicit.length > 1 || (explicit.length === 1 && explicit[0] !== marketId)) {
    throw new ApiError(400, "unsupported_input", `Supported market: ${marketId}`);
  }
  for (const [key, value] of Object.entries(spec?.params ?? {})) {
    const values = query.getAll(key);
    if (values.length > 1 || (values.length === 1 && !sameValue(values[0], value))) {
      throw new ApiError(400, "unsupported_input", `Supported ${key}: ${value}`);
    }
  }
}

function routingHeaders(selection: RouteSelection) {
  return {
    "Tender-Provider": selection.providerId ?? "",
    "Tender-Route-Reason": selection.policy.mode.kind === "pinned" ? "pinned" : selection.policy.preference,
    "Tender-Policy-Violation": String(selection.policyViolation),
  };
}

/** Live reference inputs: San Francisco weather (Open-Meteo) and BTC/USD (Coinbase, Kraken). */
async function referenceFor(marketId: MarketId): Promise<{ reference: MarketReference | undefined; source: string; timestamp: string }> {
  if (marketId === "btc-usd") {
    const input = await getPriceReference();
    return { source: input.source, timestamp: input.timestamp, reference: { kind: "btc", at: Date.parse(input.timestamp), priceUsd: input.value } };
  }
  if (marketId === "sf-weather") {
    const input = await getWeatherReference();
    const w = input.value;
    return { source: input.source, timestamp: input.timestamp, reference: {
      kind: "weather", at: Date.parse(input.timestamp), temperatureF: w.temperature_f, feelsLikeF: w.feels_like_f,
      condition: w.condition, humidityPct: w.humidity_percent, windMph: w.wind_mph,
      windDirectionDeg: w.wind_direction_degrees, pressureHpa: w.pressure_hpa,
      visibilityMi: w.visibility_mi, dewPointF: w.dew_point_f, cloudCoverPct: w.cloud_cover_percent,
    } };
  }
  return { source: "signal", timestamp: new Date().toISOString(), reference: undefined };
}

/** Required contract fields missing from a result (empty when the result matches the schema). */
export function missingFields(contractId: string, data: Readonly<Record<string, unknown>>): string[] {
  const contract = getContract(contractId);
  return (contract?.output ?? []).filter((field) => !field.optional && readField(data, field.key) === undefined).map((field) => field.key);
}

async function serveSelection(selection: RouteSelection, settlement: SettlementAmounts): Promise<Response> {
  const marketId = selection.marketId;
  const contractId = getMarketDefinition(marketId).contractId;
  const input = await referenceFor(marketId);
  const requestId = `req_${randomUUID()}`;
  const { result } = executeSelection(selection, { now: Date.now(), seed: seedFromString(requestId), requestId, reference: input.reference });
  const violations = { policy_violation: selection.policyViolation, policy_violations: selection.violations.map((r) => r.message) };
  if (result.status === "rejected") return json({ error: { code: "no_eligible_provider", message: result.reason }, request_id: requestId }, 409);
  if (result.status === "failed") {
    return json({ error: { code: "provider_error", message: result.error.message }, provider: result.providerId, request_id: requestId,
      latency_ms: result.latencyMs, ...violations }, result.error.code);
  }
  const data = resultData(result);
  // A result that misses required contract fields counts as a failed request (no settlement).
  if (missingFields(contractId, data).length > 0) {
    return json({ error: { code: "provider_error", message: "Provider returned an incomplete result" }, provider: result.providerId,
      request_id: requestId, latency_ms: result.latencyMs, ...violations }, 502);
  }
  return json({
    request_id: result.requestId, market: marketId, contract: contractId, provider: result.providerId,
    latency_ms: result.latencyMs, data_age_ms: result.dataAgeMs,
    price_usd: settlement.price_usd, settled_usd: settlement.settled_usd, settled_atomic: settlement.settled_atomic,
    ...(settlement.settlement_note ? { settlement_note: settlement.settlement_note } : {}),
    ...violations,
    reference_source: input.source, reference_timestamp: input.timestamp,
    data,
  });
}

/** One frozen selection binds x402 quote, recipient, and response; safe for direct buyer dispatch. */
export async function handleContract(request: Request, marketId: MarketId, options: ContractOptions = {}): Promise<Response> {
  let selection: RouteSelection;
  try {
    validateContract(request, marketId);
    const market = getMarketDefinition(marketId);
    selection = selectRoute(marketId, { policy: requestPolicy(request, market), conditions: conditionOverrides(marketId, options.conditions) });
    if (!selection.providerId || selection.bidPrice === null) throw new ApiError(409, "no_eligible_provider", "No eligible provider");
    if (selection.bidPrice <= 0) throw new ApiError(400, "unsupported_bid", "Paid requests require a provider bid greater than zero");
  } catch (error) { return errorResponse(error); }
  const selected = selection;
  const quote = quoteFromBid(selected.providerId!, selected.bidPrice!, getMarketDefinition(marketId).contract);
  let response: Response;
  let providerResponse: Response | undefined;
  try {
    response = await withX402Payment(
      async (_request, paidQuote) => {
        providerResponse = await serveSelection(selected, paidQuote);
        return providerResponse;
      },
      () => quote,
    )(request);
    // The SDK returns some facilitator failures as responses rather than throwing.
    // Keep provider failures intact, but normalize payment infrastructure failures.
    if (response.status >= 500 && (!providerResponse || providerResponse.status < 400)) {
      response = json({ error: { code: "payment_unavailable", message: "Payment service unavailable" } }, 503);
    }
    // The SDK's settlement catch also returns a bare 402 with no PAYMENT-REQUIRED header
    // when settlement throws after the handler already produced a payload. Serving it
    // would break the documented PaymentRequired shape, hide whether money moved, and
    // invite a blind PAYMENT-SIGNATURE retry that could pay twice. Normalize it.
    if (response.status === 402 && providerResponse && providerResponse.status < 400 && !response.headers.has("PAYMENT-REQUIRED")) {
      response = json({ error: { code: "payment_unavailable", message: "Payment service unavailable" } }, 503);
    }
  } catch (error) {
    // Log only the error identity, never the request, payment headers, or payload.
    console.error("Tender payment service error", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    // Fail closed: a facilitator/settlement outage must never produce an unpaid payload.
    response = json({ error: { code: "payment_unavailable", message: "Payment service unavailable" } }, 503);
  }
  for (const [name, value] of Object.entries(routingHeaders(selected))) response.headers.set(name, value);
  response.headers.set("Cache-Control", "private, no-store");
  // Cross-origin browser clients (x402 wallets, dashboards) read these paid responses.
  response.headers.set("Access-Control-Allow-Origin", "*");
  const expose = response.headers.get("Access-Control-Expose-Headers");
  response.headers.set("Access-Control-Expose-Headers", [expose, "Tender-Route-Reason", "Tender-Policy-Violation"].filter(Boolean).join(", "));
  return response;
}

/** `GET /api/v1/{namespace}/{action}`: resolve the market from the contract and query, then serve it. */
export async function handleContractPath(request: Request, namespace: string, action: string): Promise<Response> {
  const contract = contractForPath(namespace, action);
  if (!contract) {
    return json({ error: { code: "contract_not_found", message: "Unknown contract. See /api/v1/contracts for every contract." } }, 404);
  }
  let marketId: MarketId;
  try {
    marketId = resolveContractMarket(contract, new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof ContractInputError) {
      return json({ error: { code: error.code, message: error.message }, contract: contract.id, supported: error.supported }, 400);
    }
    return errorResponse(error);
  }
  return handleContract(request, marketId);
}
