import { contractUrl, getMarketSpec } from "@/lib/registry";
import { isMarketId, type RoutingPolicy } from "@/lib/tender";
import { parseRequestInputs } from "@/lib/tender/request-inputs";
import { handleContract } from "./handlers";
import { POLICY_PARAMETERS } from "./policy";

/** Engine policy fields, sent as the contract's policy query parameters. */
export type RoutingPolicyInput = RoutingPolicy;

/** Base of in-process contract URLs. Never derived from an incoming Host header. */
const INTERNAL_ORIGIN = "https://tender.internal";

/**
 * Runs one contract request paid with an account's credits, through the same handler as
 * `GET /api/v1/{namespace}/{action}`: 200 with `payment: { method: "credits", ... }`, 402
 * `insufficient_credits` or `mandate_exceeded` (agents), 409 when no provider is eligible.
 */
export async function serveWithCredits(input: {
  accountId: string;
  actor: "user" | "agent" | "api_key";
  marketId: string;
  params?: Record<string, string>;
  policy?: Partial<RoutingPolicyInput>;
}): Promise<{ status: number; body: unknown }> {
  const spec = getMarketSpec(input.marketId);
  if (!spec || !isMarketId(spec.id)) return { status: 404, body: { error: { code: "market_not_found", message: "Unknown market" } } };
  // Only contract inputs pass through, so params can never override the routing policy below.
  let params: Record<string, string>;
  try {
    params = parseRequestInputs(spec.id, input.params);
  } catch (error) {
    return { status: 400, body: { error: { code: "invalid_request", message: error instanceof Error ? error.message : "Invalid request inputs" } } };
  }
  const url = new URL(contractUrl(spec), INTERNAL_ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const policy = input.policy ?? {};
  for (const parameter of POLICY_PARAMETERS) {
    const value = policy[parameter.field];
    if (value !== undefined) url.searchParams.set(parameter.query, String(value));
  }
  if (policy.preference) url.searchParams.set("preference", policy.preference);
  if (policy.mode?.kind === "pinned") url.searchParams.set("pin", policy.mode.providerId);
  const response = await handleContract(new Request(url), spec.id, { payer: { accountId: input.accountId, actor: input.actor } });
  return { status: response.status, body: await response.json() };
}
