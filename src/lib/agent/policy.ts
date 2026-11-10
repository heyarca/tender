import { z } from "zod";
import {
  format,
  getMarketDefinition,
  PREFERENCE_LABELS,
  providerName,
  sanitizeMode,
  sanitizePolicyPatch,
  type MarketId,
  type RoutingPolicy,
} from "@/lib/tender";

/** Routing policy as the agent writes it. Unset fields keep the market's current value. */
export const askPolicySchema = z.object({
  maxPrice: z.number().min(0).optional().describe("Highest bid to accept, in USD per 1M requests"),
  maxP95LatencyMs: z.number().min(0).optional().describe("Highest provider P95 latency, in ms"),
  maxDataAgeMs: z.number().min(0).optional().describe("Oldest data to accept, in ms"),
  minSuccessRate: z.number().min(0).max(1).optional().describe("Lowest success rate from 0 to 1 (0.995 is 99.5%)"),
  preference: z.enum(["lowest-cost", "lowest-latency", "freshest-data"]).optional(),
  pinnedProvider: z.string().nullable().optional().describe("Provider id to pin. null turns automatic switching back on."),
});
export type AskPolicy = z.infer<typeof askPolicySchema>;

/** Engine fields of an agent policy, clamped to the market's inputs like the policy editor does. */
export function toRoutingPolicy(marketId: MarketId, policy: AskPolicy): Partial<RoutingPolicy> {
  const patch: Partial<RoutingPolicy> = sanitizePolicyPatch(marketId, policy);
  if (policy.pinnedProvider === null) patch.mode = { kind: "auto" };
  else if (policy.pinnedProvider) {
    const mode = sanitizeMode(marketId, { kind: "pinned", providerId: policy.pinnedProvider });
    if (mode) patch.mode = mode;
  }
  return patch;
}

/** Plain-English policy: "max $30.00 /M, P95 ≤ 300 ms". */
export function describePolicy(marketId: MarketId, policy: Partial<RoutingPolicy>): string {
  const ageUnit = getMarketDefinition(marketId).units.dataAge;
  const parts: string[] = [];
  if (policy.maxPrice !== undefined) parts.push(`max ${format.price(policy.maxPrice)} /M`);
  if (policy.maxP95LatencyMs !== undefined) parts.push(`P95 ≤ ${format.latency(policy.maxP95LatencyMs)}`);
  if (policy.maxDataAgeMs !== undefined) {
    parts.push(`data age ≤ ${ageUnit === "ms" && policy.maxDataAgeMs < 10_000 ? `${policy.maxDataAgeMs} ms` : format.dataAge(policy.maxDataAgeMs)}`);
  }
  if (policy.minSuccessRate !== undefined) parts.push(`success ≥ ${format.percent(policy.minSuccessRate, 1)}`);
  if (policy.preference) parts.push(PREFERENCE_LABELS[policy.preference].toLowerCase());
  if (policy.mode?.kind === "pinned") parts.push(`pinned to ${providerName(marketId, policy.mode.providerId)}`);
  if (policy.mode?.kind === "auto") parts.push("automatic switching");
  return parts.join(", ") || "market defaults";
}

/** What a spending limit stores as its policy: the market and the routing policy the agent must use. */
export interface MandatePolicy {
  marketId: MarketId;
  policy: Partial<RoutingPolicy>;
}

export function readMandatePolicy(value: unknown): MandatePolicy | null {
  if (!value || typeof value !== "object") return null;
  const { marketId, policy } = value as Partial<MandatePolicy>;
  return typeof marketId === "string" && policy && typeof policy === "object" ? { marketId, policy } : null;
}
