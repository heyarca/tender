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

/**
 * Create a Tender client.
 * @param {{ baseUrl?: string, fetch?: typeof fetch }} [options]
 *   Pass an x402-aware `fetch` (for example from `@x402/fetch`) to pay for contract requests in USDC.
 */
export function createTender(options = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") throw new Error("No fetch available. Use Node 18+ or pass options.fetch.");

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
        return { status: 402, paymentRequired: await response.json().catch(() => null), provider: response.headers.get("Tender-Provider") };
      }
      const body = await json(response);
      return { status: response.status, provider: response.headers.get("Tender-Provider"), data: body?.data ?? body, response: body };
    },
  };
}

/** Contract URL of a market from the API (`contract_url`, e.g. "/api/v1/translation/text?source=en&target=ko"). */
export function contractPathFor(market) {
  const url = market?.contract_url ?? market?.contract_path;
  if (typeof url !== "string" || !url.startsWith("/")) throw new Error(`Market ${market?.id ?? ""} has no contract URL`);
  return url;
}
