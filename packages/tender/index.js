/**
 * Minimal Tender client. Zero dependencies; uses the global `fetch` (Node 18+, browsers, Bun, Deno).
 */
export const DEFAULT_BASE_URL = "https://tender.heyarca.app";

function policyParams(policy = {}) {
  const params = new URLSearchParams();
  if (policy.maxPrice != null) params.set("max_price", String(policy.maxPrice));
  if (policy.maxP95LatencyMs != null) params.set("max_p95_ms", String(policy.maxP95LatencyMs));
  if (policy.maxDataAgeMs != null) params.set("max_data_age_ms", String(policy.maxDataAgeMs));
  if (policy.minSuccessRate != null) params.set("min_success_rate", String(policy.minSuccessRate));
  if (policy.preference) params.set("preference", policy.preference);
  if (policy.pin) params.set("pin", policy.pin);
  return params;
}

async function json(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? body?.error ?? response.statusText;
    const error = new Error(`Tender ${response.status}: ${typeof message === "string" ? message : JSON.stringify(message)}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

/** Format micro-USD as dollars: 18 -> "$0.000018", 5000000 -> "$5.00". */
export function formatMicros(micros) {
  const sign = micros < 0 ? "-" : "";
  const abs = Math.abs(micros);
  const fraction = String(abs % 1_000_000).padStart(6, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${sign}$${Math.floor(abs / 1_000_000)}.${fraction}`;
}

/**
 * Create a Tender client.
 * @param {{ baseUrl?: string, fetch?: typeof fetch, apiKey?: string }} [options]
 *   Pass an x402-aware `fetch` (for example from `@x402/fetch`) to pay for contract requests in USDC.
 *   Pass `apiKey` (or set `TENDER_API_KEY`) to pay with Tender credits through `callMarket`.
 */
export function createTender(options = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") throw new Error("No fetch available. Use Node 18+ or pass options.fetch.");
  const configuredKey = options.apiKey ?? globalThis.process?.env?.TENDER_API_KEY;
  // Tender keys start with `tk_`. Anything else (empty, or an editor's unexpanded "${TENDER_API_KEY}") is no key.
  const apiKey = typeof configuredKey === "string" && configuredKey.trim().startsWith("tk_") ? configuredKey.trim() : null;
  const authorized = () => {
    if (!apiKey) {
      const error = new Error(`Set TENDER_API_KEY: create a key at ${baseUrl}/account`);
      error.code = "missing_api_key";
      throw error;
    }
    return { authorization: `Bearer ${apiKey}` };
  };

  return {
    baseUrl,
    /** Every market: id, name, group, category, contract and its URL, units, default policy, provider count. */
    async markets() {
      return (await json(await doFetch(`${baseUrl}/api/v1/markets`))).markets;
    },
    /** Groups and categories with market counts. */
    async categories() {
      return (await json(await doFetch(`${baseUrl}/api/v1/categories`))).groups;
    },
    /** Contracts: params, output fields, result schema, and the markets that implement each one. */
    async contracts() {
      return (await json(await doFetch(`${baseUrl}/api/v1/contracts`))).contracts;
    },
    /** One market's provider bids, performance, and routing decision for a policy. */
    async market(id, policy) {
      const query = policyParams(policy).toString();
      return json(await doFetch(`${baseUrl}/api/v1/markets/${encodeURIComponent(id)}${query ? `?${query}` : ""}`));
    },
    /**
     * Call a market's contract at the `contract_url` from `/api/v1/markets/{id}`. Without an x402-aware
     * fetch this returns the 402 payment requirements (price, provider, payee) instead of the result.
     * `data` is the contract-shaped result; `response` is the full JSON body (routing and settlement).
     */
    async request(id, policy) {
      const detail = await this.market(id);
      const path = contractPathFor(detail);
      const params = policyParams(policy);
      const query = params.toString();
      const url = `${baseUrl}${path}${query ? `${path.includes("?") ? "&" : "?"}${query}` : ""}`;
      const response = await doFetch(url);
      if (response.status === 402) {
        return {
          status: 402,
          paymentRequired: await response.json().catch(() => null),
          paymentRequirements: decodePaymentHeader(response.headers.get("PAYMENT-REQUIRED")),
          provider: response.headers.get("Tender-Provider"),
        };
      }
      const body = await json(response);
      return { status: response.status, provider: response.headers.get("Tender-Provider"), data: body?.data ?? body, response: body };
    },
    /** True when an API key is set (`apiKey` option or `TENDER_API_KEY`). */
    hasApiKey: apiKey !== null,
    /**
     * Call a market's contract and pay the winning bid with Tender credits (API key).
     * `params` are extra query parameters for the contract URL. Throws on errors: `error.status` is
     * 402 when the balance is too low and 409 when no provider meets the policy.
     */
    async callMarket(id, { params, policy } = {}) {
      const headers = authorized();
      const detail = await this.market(id);
      const url = new URL(contractPathFor(detail), baseUrl);
      for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, String(value));
      for (const [key, value] of policyParams(policy)) url.searchParams.set(key, value);
      const response = await doFetch(url.toString(), { headers });
      const body = await json(response);
      const provider = body?.provider ?? response.headers.get("Tender-Provider");
      return {
        status: response.status,
        provider,
        providerName: detail.providers?.find((entry) => entry.id === provider)?.name ?? null,
        data: body?.data,
        payment: { charged_micros: body?.payment?.charged_micros ?? null, balance_micros: body?.payment?.balance_micros ?? null },
        response: body,
      };
    },
    /** Credits balance, spending limit, and the last 20 ledger entries of the API key's account. */
    async balance() {
      return json(await doFetch(`${baseUrl}/api/account`, { headers: authorized() }));
    },
  };
}

/** Decode the base64 JSON `PAYMENT-REQUIRED` header (x402 v2). Returns null when missing or malformed. */
function decodePaymentHeader(value) {
  if (!value) return null;
  try {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Contract URL of a market from the API (`contract_url`, e.g. "/api/v1/translation/text?source=en&target=ko"). */
export function contractPathFor(market) {
  const url = market?.contract_url ?? market?.contract_path;
  if (typeof url !== "string" || !url.startsWith("/")) throw new Error(`Market ${market?.id ?? ""} has no contract URL`);
  return url;
}
