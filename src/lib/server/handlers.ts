import { randomUUID } from "node:crypto";
import { executeSelection, getMarketDefinition, MARKET_IDS, signalReference, seedFromString, selectRoute, sanitizeConditionsPatch, type ConditionsPatch, type ProviderId, type ProviderConditions, type MarketId, type MarketReference, type RouteSelection } from "@/lib/tender";
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

/** Query argument of a market's contract: weather markets take `location`, price markets take `pair`. */
export function contractInput(marketId: MarketId): { key: "location" | "pair"; value: string } {
  const definition = getMarketDefinition(marketId);
  const slug = definition.identifier.split("/")[1] ?? "";
  return definition.units.dataAge === "min" ? { key: "location", value: slug } : { key: "pair", value: slug.toUpperCase() };
}

/** Market served by `/weather/current` or `/prices/spot` for the given argument; `null` when unsupported. */
export function marketForContract(kind: "weather" | "price", value: string | null): MarketId | null {
  const fallback: MarketId = kind === "weather" ? "sf-weather" : "btc-usd";
  if (value === null) return fallback;
  const wanted = value.toLowerCase();
  for (const id of MARKET_IDS) {
    const def = getMarketDefinition(id);
    if ((def.units.dataAge === "min") !== (kind === "weather")) continue;
    if (contractInput(id).value.toLowerCase() === wanted) return id;
  }
  return null;
}

function validateContract(request: Request, marketId: MarketId) {
  if (request.method !== "GET") throw new ApiError(405, "method_not_allowed", "Use GET for this contract");
  const query = new URL(request.url).searchParams;
  const { key, value } = contractInput(marketId);
  if (query.getAll(key).length > 1 || (query.has(key) && query.get(key)?.toLowerCase() !== value.toLowerCase())) {
    throw new ApiError(400, "unsupported_input", `Supported ${key}: ${value}`);
  }
}
function routingHeaders(selection: RouteSelection) {
  return {
    "Tender-Provider": selection.providerId ?? "",
    "Tender-Route-Reason": selection.policy.mode.kind === "pinned" ? "pinned" : selection.policy.preference,
    "Tender-Policy-Violation": String(selection.policyViolation),
  };
}
async function referenceFor(marketId: MarketId): Promise<{ reference: MarketReference | undefined; source: string; timestamp: string }> {
  // Live upstream reference data only exists for San Francisco and BTC/USD; every other market serves the deterministic signal.
  if (marketId !== "sf-weather" && marketId !== "btc-usd") {
    return { source: "signal", timestamp: new Date().toISOString(), reference: undefined };
  }
  if (marketId === "btc-usd") {
    const input = await getPriceReference();
    return { source: input.source, timestamp: input.timestamp, reference: { kind: "btc", at: Date.parse(input.timestamp), priceUsd: input.value } };
  }
  const input = await getWeatherReference();
  const w = input.value;
  return { source: input.source, timestamp: input.timestamp, reference: {
    kind: "weather", at: Date.parse(input.timestamp), temperatureF: w.temperature_f, feelsLikeF: w.feels_like_f,
    condition: w.condition, humidityPct: w.humidity_percent, windMph: w.wind_mph,
    windDirectionDeg: w.wind_direction_degrees, pressureHpa: w.pressure_hpa,
    visibilityMi: w.visibility_mi, dewPointF: w.dew_point_f, cloudCoverPct: w.cloud_cover_percent,
  } };
}
async function serveSelection(selection: RouteSelection, settlement: SettlementAmounts): Promise<Response> {
  const input = await referenceFor(selection.marketId);
  const requestId = `req_${randomUUID()}`;
  const { result } = executeSelection(selection, { now: Date.now(), seed: seedFromString(requestId), requestId, reference: input.reference });
  if (result.status === "rejected") return json({ error: { code: "no_eligible_provider", message: result.reason }, request_id: requestId }, 409);
  if (result.status === "failed") return json({ error: { code: "provider_error", message: result.error.message },
    provider: result.providerId, request_id: requestId, latency_ms: result.latencyMs,
    policy_violation: selection.policyViolation, policy_violations: selection.violations.map((r) => r.message),
  }, result.error.code);
  const common = {
    provider: result.providerId, latency_ms: result.latencyMs, data_age_ms: result.dataAgeMs, request_id: result.requestId,
    price_usd: settlement.price_usd, settled_usd: settlement.settled_usd, settled_atomic: settlement.settled_atomic,
    ...(settlement.settlement_note ? { settlement_note: settlement.settlement_note } : {}),
    policy_violation: selection.policyViolation, policy_violations: selection.violations.map((r) => r.message),
    reference_source: input.source, reference_timestamp: input.timestamp,
  };
  if (result.payload.kind === "btc") {
    const unit = getMarketDefinition(result.marketId).units.value;
    // Real-world goods come from a sample index; say so in the payload.
    const indicative = unit !== "USD" ? { unit, indicative: true } : {};
    return json({ ...common, pair: result.payload.pair, price: result.payload.priceUsd, currency: "USD", ...indicative,
      source_timestamp: new Date(result.payload.sourceTimestamp).toISOString() });
  }
  const w = result.payload;
  return json({ ...common, location: w.location, observed_at: new Date(w.observedAt).toISOString(),
    temperature_f: w.temperatureF, feels_like_f: w.feelsLikeF, condition: w.condition, humidity_percent: w.humidityPct,
    wind_mph: w.windMph, wind_direction_degrees: w.windDirectionDeg, wind_direction: w.windDirection,
    pressure_hpa: w.pressureHpa, visibility_mi: w.visibilityMi, dew_point_f: w.dewPointF, cloud_cover_percent: w.cloudCoverPct });
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
