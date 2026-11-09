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
    /** Every market: id, name, contract, units, default policy, provider count. */
    async markets() {
      return (await json(await doFetch(`${baseUrl}/api/v1/markets`))).markets;
    },
    /** One market's provider bids, performance, and routing decision for a policy. */
    async market(id, policy) {
      const query = policyParams(policy).toString();
      return json(await doFetch(`${baseUrl}/api/v1/markets/${encodeURIComponent(id)}${query ? `?${query}` : ""}`));
    },
    /**
     * Call a market's contract endpoint. Without an x402-aware fetch this returns the 402 payment
     * requirements (price, provider, payee) instead of the result.
     */
    async request(id, policy) {
      const detail = await this.market(id);
      const path = contractPathFor(detail);
      const params = policyParams(policy);
      const url = `${baseUrl}${path}${path.includes("?") ? "&" : "?"}${params.toString()}`;
      const response = await doFetch(url);
      if (response.status === 402) {
        return { status: 402, paymentRequired: await response.json().catch(() => null), provider: response.headers.get("Tender-Provider") };
      }
      return { status: response.status, provider: response.headers.get("Tender-Provider"), data: await json(response) };
    },
  };
}

/** Contract endpoint of a market from its identifier ("weather/seoul", "prices/eth-usd"). */
export function contractPathFor(market) {
  const identifier = market?.identifier ?? "";
  const [kind, slug = ""] = identifier.split("/");
  return kind === "weather" ? `/api/v1/weather/current?location=${slug}` : `/api/v1/prices/spot?pair=${slug.toUpperCase()}`;
}
