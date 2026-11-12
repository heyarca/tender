import { randomUUID } from "node:crypto";
import {
  getContract,
  getMarketSpec,
  inputParams,
  listMarkets as listRegistryMarkets,
  marketParams,
  readField,
  type ContractSpec,
  type MarketSpec,
} from "@/lib/registry";
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
import { weatherLocationFor } from "@/lib/tender/signals";
import { chargeForRequest, accountFromRequest, getAccount, hasApiKey, wantsCredits, type Actor } from "@/lib/ledger";
import { bidToAtomic } from "@/lib/payments/quote";
import { quoteFromBid, withX402Payment, type SettlementAmounts } from "@/lib/payments/server";
import { ApiError, errorResponse, json } from "./http";
import { requestPolicy } from "./markets";
import { liveResult, LiveError } from "./live";
import { loadPrice, loadWeather } from "./reference";

/** Trusted in-process inputs only. Public contract routes never parse these from HTTP. */
export interface ContractOptions {
  conditions?: Partial<Record<ProviderId, ConditionsPatch>>;
  /** Pay with this account's credits (for example an agent acting within its mandate) instead of reading credentials. */
  payer?: CreditsPayer;
}

export interface CreditsPayer {
  accountId: string;
  actor: Actor;
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

/** Market a contract serves when the request names no params: the one bound to the contract's example values, else the first. */
function defaultMarket(contract: ContractSpec): MarketSpec | undefined {
  const markets = contractMarkets(contract.id);
  const params = marketParams(contract);
  return markets.find((market) => params.every((param) => sameValue(market.params[param.key] ?? "", param.example))) ?? markets[0];
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
 * no contract param is given. Inputs never select a market. Throws a 400 that lists the supported
 * values when nothing matches.
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
  for (const param of marketParams(contract)) {
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
  const market = given.length === 0 ? defaultMarket(contract) : markets.find(matches);
  if (!market) throw unsupported(`Unsupported ${given.map(([key, value]) => `${key}=${value}`).join("&")}`);
  return market.id;
}

/** 400 `unsupported_input` that also lists the supported markets and their params. */
export class ContractInputError extends ApiError {
  constructor(message: string, public readonly supported: { market: string; params: Readonly<Record<string, string>> }[]) {
    super(400, "unsupported_input", message);
  }
}

/**
 * Every contract param in the query must match the market (case-insensitive); a market selector, if given,
 * must name it. Returns the request's inputs: each one trimmed, or the market's default when omitted.
 */
function validateContract(request: Request, marketId: MarketId): Record<string, string> {
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
  const inputs: Record<string, string> = {};
  for (const param of contract ? inputParams(contract) : []) {
    const values = query.getAll(param.key);
    if (values.length > 1) throw new ApiError(400, "unsupported_input", `Send one ${param.key} value`);
    const value = values[0]?.trim() || spec?.inputs?.[param.key] || param.example;
    if (param.maxLength && [...value].length > param.maxLength) {
      throw new ApiError(400, "unsupported_input", `${param.key} is longer than ${param.maxLength} characters`);
    }
    inputs[param.key] = value;
  }
  return inputs;
}

function routingHeaders(selection: RouteSelection) {
  return {
    "Tender-Provider": selection.providerId ?? "",
    "Tender-Route-Reason": selection.policy.mode.kind === "pinned" ? "pinned" : selection.policy.preference,
    "Tender-Policy-Violation": String(selection.policyViolation),
  };
}

/**
 * Live reference input of a weather or spot market, which the engine's provider payloads are anchored to.
 * Other markets, and a failed source, use the engine's deterministic signal.
 */
async function referenceFor(marketId: MarketId): Promise<{ reference: MarketReference | undefined; source: string; timestamp: string }> {
  const signal = { source: "signal", timestamp: new Date().toISOString(), reference: undefined };
  const spec = getMarketSpec(marketId);
  if (spec?.source !== "upstream") return signal;
  if (spec.contractId === "prices.spot") {
    const input = await loadPrice(spec.params.pair, spec.categoryId === "currencies" ? "currency" : "crypto");
    if (!input) return signal;
    // The reference is the current price (a daily ECB rate stays current until the next one), so anchor it
    // at the request: the engine then moves it only by the provider's own data age.
    return { source: input.source, timestamp: input.timestamp, reference: { kind: "btc", at: Date.now(), priceUsd: input.value } };
  }
  if (spec.contractId === "weather.current") {
    const input = await loadWeather(weatherLocationFor(marketId));
    if (!input) return signal;
    const w = input.value;
    return { source: input.source, timestamp: input.timestamp, reference: {
      kind: "weather", at: Date.parse(input.timestamp), temperatureF: w.temperature_f, feelsLikeF: w.feels_like_f,
      condition: w.condition, humidityPct: w.humidity_percent, windMph: w.wind_mph,
      windDirectionDeg: w.wind_direction_degrees, pressureHpa: w.pressure_hpa,
      visibilityMi: w.visibility_mi, dewPointF: w.dew_point_f, cloudCoverPct: w.cloud_cover_percent,
    } };
  }
  return signal;
}

/** Required contract fields missing from a result (empty when the result matches the schema). */
export function missingFields(contractId: string, data: Readonly<Record<string, unknown>>): string[] {
  const contract = getContract(contractId);
  return (contract?.output ?? []).filter((field) => !field.optional && readField(data, field.key) === undefined).map((field) => field.key);
}

/** A served request before payment fields are added, or the failure response to return as is. */
type Served =
  | { ok: false; response: Response }
  | { ok: true; requestId: string; providerId: string; head: Record<string, unknown>; tail: Record<string, unknown> };

async function executeContract(selection: RouteSelection, inputs: Readonly<Record<string, string>>): Promise<Served> {
  const marketId = selection.marketId;
  const contractId = getMarketDefinition(marketId).contractId;
  const input = await referenceFor(marketId);
  const requestId = `req_${randomUUID()}`;
  const { result } = executeSelection(selection, { now: Date.now(), seed: seedFromString(requestId), requestId, reference: input.reference });
  const violations = { policy_violation: selection.policyViolation, policy_violations: selection.violations.map((r) => r.message) };
  if (result.status === "rejected") return { ok: false, response: json({ error: { code: "no_eligible_provider", message: result.reason }, request_id: requestId }, 409) };
  if (result.status === "failed") {
    console.error("Tender provider request failed", { provider: result.providerId, market: marketId, upstream_status: result.error.code, request_id: requestId, latency_ms: result.latencyMs });
    // The provider's 500 is reported as Tender's 502 (a bad upstream answer), not as a Tender server error.
    return { ok: false, response: json({ error: { code: "provider_error", message: result.error.message }, provider: result.providerId, request_id: requestId,
      latency_ms: result.latencyMs, retryable: true, ...violations }, result.error.code === 500 ? 502 : result.error.code, { "Retry-After": "1" }) };
  }
  let data = resultData(result);
  let source = input.source;
  let timestamp = input.timestamp;
  try {
    const live = await liveResult(getMarketSpec(marketId)!, inputs, data);
    if (live) ({ data, source, timestamp } = live);
  } catch (error) {
    if (!(error instanceof LiveError)) throw error;
    // The upstream failed: the request fails like a provider error, so it is neither charged nor settled.
    return { ok: false, response: json({ error: { code: error.code, message: error.message }, provider: result.providerId, request_id: requestId,
      latency_ms: result.latencyMs, retryable: error.status === 502, ...violations }, error.status) };
  }
  // A result that misses required contract fields counts as a failed request (no settlement).
  if (missingFields(contractId, data).length > 0) {
    return { ok: false, response: json({ error: { code: "provider_error", message: "Provider returned an incomplete result" }, provider: result.providerId,
      request_id: requestId, latency_ms: result.latencyMs, ...violations }, 502) };
  }
  return {
    ok: true,
    requestId: result.requestId,
    providerId: result.providerId,
    head: { request_id: result.requestId, market: marketId, contract: contractId, provider: result.providerId, params: inputs,
      latency_ms: result.latencyMs, data_age_ms: result.dataAgeMs },
    tail: { ...violations, reference_source: source, reference_timestamp: timestamp, data },
  };
}

async function serveSelection(selection: RouteSelection, inputs: Readonly<Record<string, string>>, settlement: SettlementAmounts): Promise<Response> {
  const served = await executeContract(selection, inputs);
  if (!served.ok) return served.response;
  return json({
    ...served.head,
    price_usd: settlement.price_usd, settled_usd: settlement.settled_usd, settled_atomic: settlement.settled_atomic,
    ...(settlement.settlement_note ? { settlement_note: settlement.settlement_note } : {}),
    ...served.tail,
  });
}

/**
 * Credits payer of a request: the in-process payer, an API key, or the cookie account with
 * `Tender-Payment: credits`. `null` means x402. An unknown key answers 401; asking for
 * credits without an account answers 402.
 */
async function creditsPayer(request: Request, options: ContractOptions): Promise<CreditsPayer | null | Response> {
  if (options.payer) return options.payer;
  if (!hasApiKey(request) && !wantsCredits(request)) return null;
  const account = await accountFromRequest(request);
  if (account) return account;
  if (hasApiKey(request)) return json({ error: { code: "invalid_api_key", message: "The API key is unknown or revoked" } }, 401);
  return insufficientCredits(0);
}

function insufficientCredits(balanceMicros: number): Response {
  return json({ error: { code: "insufficient_credits", message: "Add funds to pay with credits" }, balance_micros: balanceMicros, top_up_url: "/account" }, 402);
}

/**
 * Serves the request, then charges the winning bid ($X per million requests = X micro-USD,
 * rounded up). Failed requests are not charged. A short balance or mandate answers 402 with no data.
 * The balance is checked first, so an account that cannot pay never spends a model or upstream call.
 */
async function chargeAndServe(selection: RouteSelection, inputs: Readonly<Record<string, string>>, payer: CreditsPayer): Promise<Response> {
  const bid = selection.bidPrice!;
  const amountMicros = Number(bidToAtomic(bid));
  const balanceMicros = (await getAccount(payer.accountId))?.balanceMicros ?? 0;
  if (balanceMicros < amountMicros) return insufficientCredits(balanceMicros);
  const served = await executeContract(selection, inputs);
  if (!served.ok) return served.response;
  const charge = await chargeForRequest({
    accountId: payer.accountId, requestId: served.requestId, marketId: selection.marketId,
    providerId: served.providerId, amountMicros, actor: payer.actor,
  });
  if (!charge.ok) {
    if (charge.reason === "insufficient_credits") return insufficientCredits(charge.balanceMicros);
    return json({ error: { code: "mandate_exceeded", message: "This charge is over the weekly agent spending limit" }, balance_micros: charge.balanceMicros, top_up_url: "/account" }, 402);
  }
  return json({
    ...served.head,
    price_usd: bid / 1_000_000, settled_usd: amountMicros / 1_000_000, settled_atomic: String(amountMicros),
    ...served.tail,
    payment: { method: "credits", charged_micros: amountMicros, balance_micros: charge.balanceMicros },
  });
}

/** Routing, caching, and CORS headers every contract response carries. */
function contractHeaders(response: Response, selection: RouteSelection): Response {
  for (const [name, value] of Object.entries(routingHeaders(selection))) response.headers.set(name, value);
  response.headers.set("Cache-Control", "private, no-store");
  // Cross-origin browser clients (x402 wallets, dashboards) read these paid responses.
  response.headers.set("Access-Control-Allow-Origin", "*");
  const expose = response.headers.get("Access-Control-Expose-Headers");
  response.headers.set("Access-Control-Expose-Headers", [expose, "Tender-Route-Reason", "Tender-Policy-Violation"].filter(Boolean).join(", "));
  return response;
}

/**
 * One frozen selection binds the payment and the response: credits when the request names an account,
 * else the x402 quote and recipient. Safe for direct buyer dispatch.
 */
export async function handleContract(request: Request, marketId: MarketId, options: ContractOptions = {}): Promise<Response> {
  let selection: RouteSelection;
  let inputs: Record<string, string>;
  try {
    inputs = validateContract(request, marketId);
    const market = getMarketDefinition(marketId);
    selection = selectRoute(marketId, { policy: requestPolicy(request, market), conditions: conditionOverrides(marketId, options.conditions) });
    if (!selection.providerId || selection.bidPrice === null) throw new ApiError(409, "no_eligible_provider", "No eligible provider");
    if (selection.bidPrice <= 0) throw new ApiError(400, "unsupported_bid", "Paid requests require a provider bid greater than zero");
  } catch (error) { return errorResponse(error); }
  const selected = selection;
  let payer: CreditsPayer | null | Response;
  try {
    payer = await creditsPayer(request, options);
    if (payer && !(payer instanceof Response)) return contractHeaders(await chargeAndServe(selected, inputs, payer), selected);
  } catch (error) {
    console.error("Tender credits error", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    return contractHeaders(json({ error: { code: "payment_unavailable", message: "Payment service unavailable" } }, 503), selected);
  }
  if (payer instanceof Response) return contractHeaders(payer, selected);
  const quote = quoteFromBid(selected.providerId!, selected.bidPrice!, getMarketDefinition(marketId).contract);
  let response: Response;
  let providerResponse: Response | undefined;
  try {
    response = await withX402Payment(
      async (_request, paidQuote) => {
        providerResponse = await serveSelection(selected, inputs, paidQuote);
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
  return contractHeaders(response, selected);
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
