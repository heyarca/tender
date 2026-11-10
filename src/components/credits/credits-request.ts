import { contractUrl, getMarketSpec } from "@/lib/registry";
import { POLICY_PARAMETERS } from "@/lib/server/policy";
import type { MarketId, RoutingPolicy } from "@/lib/tender";

/** Same-origin contract URL of a market with the console policy as query parameters. */
export function creditsRequestUrl(marketId: MarketId, policy: RoutingPolicy): string {
  const spec = getMarketSpec(marketId);
  if (!spec) throw new Error("Unknown market");
  const [path, query = ""] = contractUrl(spec).split("?");
  const params = new URLSearchParams(query);
  for (const parameter of POLICY_PARAMETERS) params.set(parameter.query, String(policy[parameter.field]));
  params.set("preference", policy.preference);
  if (policy.mode.kind === "pinned") params.set("pin", policy.mode.providerId);
  return `${path}?${params.toString()}`;
}

/** 200 body of a contract request paid with credits. */
export interface CreditsResponse {
  request_id: string;
  provider: string;
  latency_ms: number;
  data_age_ms: number;
  price_usd: number;
  data: Record<string, unknown>;
  payment: { method: "credits"; charged_micros: number; balance_micros: number };
}

export interface CreditsErrorResponse {
  error?: { code?: string; message?: string };
  balance_micros?: number;
}
