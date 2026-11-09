import { MARKETS, type MarketId, type RoutingPolicy } from "@/lib/tender";

/** Contract endpoint of a market (path + its one supported argument). */
export function contractPath(marketId: MarketId): string {
  const definition = MARKETS[marketId];
  const slug = definition.identifier.split("/")[1] ?? "";
  return definition.units.dataAge === "min"
    ? `/api/v1/weather/current?location=${slug}`
    : `/api/v1/prices/spot?pair=${slug.toUpperCase()}`;
}

/** Discovery endpoint of a market (bids, performance, qualification, route). */
export function marketPath(marketId: MarketId): string {
  return `/api/v1/markets/${marketId}`;
}

function wireNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

/**
 * Policy as API query parameters (docs/API.md "Routing policy"): prices in USD per 1M requests,
 * durations in milliseconds, success rate as a fraction. A pinned provider adds `pin`.
 */
export function policyQuery(policy: RoutingPolicy): string {
  const params = new URLSearchParams();
  params.set("max_price", wireNumber(policy.maxPrice));
  params.set("max_p95_ms", wireNumber(policy.maxP95LatencyMs));
  params.set("max_data_age_ms", wireNumber(policy.maxDataAgeMs));
  params.set("min_success_rate", wireNumber(policy.minSuccessRate));
  params.set("preference", policy.preference);
  if (policy.mode.kind === "pinned") params.set("pin", policy.mode.providerId);
  return params.toString();
}

/** Full contract URL for the current policy. */
export function contractUrl(origin: string, marketId: MarketId, policy: RoutingPolicy): string {
  return `${origin.replace(/\/$/, "")}${contractPath(marketId)}&${policyQuery(policy)}`;
}

/** cURL walkthrough of a paid request: discovery, the 402 challenge, and the signed retry. */
export function buildCurlSnippet(origin: string, marketId: MarketId, policy: RoutingPolicy): string {
  const base = origin.replace(/\/$/, "");
  const contract = `"$BASE${contractPath(marketId)}&$POLICY"`;
  return [
    `BASE=${base}`,
    `POLICY="${policyQuery(policy)}"`,
    "",
    "# Bids, performance, and the route for this policy",
    `curl -sS "$BASE${marketPath(marketId)}?$POLICY"`,
    "",
    "# 402 Payment Required: PAYMENT-REQUIRED holds the USDC quote (Base Sepolia)",
    `curl -i ${contract}`,
    "",
    "# Retry with an x402 signature; PAYMENT-RESPONSE holds the settlement",
    `curl -i ${contract} \\`,
    `  -H "PAYMENT-SIGNATURE: $PAYMENT_SIGNATURE"`,
    "",
  ].join("\n");
}

/** What one request costs and what it settles in USDC (6 decimals, rounded up to 1 atomic unit). */
export interface SettlementQuote {
  /** Exact bid per request (USD). */
  priceUsd: number;
  /** USDC atomic units transferred per request. */
  settledAtomic: number;
  /** Settled USDC per request. */
  settledUsd: number;
  /** The settled amount was rounded up to a whole atomic unit. */
  rounded: boolean;
}

/**
 * A bid of X USD per 1M requests is X USDC atomic units per request. Fractions round up, never
 * down to zero (docs/PAYMENTS.md "Exact bids and USDC rounding").
 */
export function settlementQuote(bidPerMillion: number): SettlementQuote {
  const micro = Math.max(0, Math.round(bidPerMillion * 1_000_000));
  const settledAtomic = Math.max(1, Math.ceil(micro / 1_000_000));
  return {
    priceUsd: bidPerMillion / 1_000_000,
    settledAtomic,
    settledUsd: settledAtomic / 1_000_000,
    rounded: micro % 1_000_000 !== 0 || micro === 0,
  };
}
