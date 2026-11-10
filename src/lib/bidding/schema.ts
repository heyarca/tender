/**
 * Zod schemas: the round request body and the model's structured output.
 */
import { z } from "zod";
import { PREFERENCES, type RoutingPreference } from "@/lib/tender";

const finite = z.number().finite();
const id = z.string().min(1).max(64);

export const biddingProviderSchema = z.object({
  providerId: id,
  bid: finite.min(0).max(100_000),
  p95LatencyMs: finite.min(0).max(600_000),
  dataAgeMs: finite.min(0).max(31 * 24 * 3_600_000),
  errorRate: finite.min(0).max(1),
  available: z.boolean(),
  wins: z.number().int().min(0).max(10_000),
});

export const biddingPolicySchema = z.object({
  maxPrice: finite.min(0),
  maxP95LatencyMs: finite.min(0),
  maxDataAgeMs: finite.min(0),
  minSuccessRate: finite.min(0).max(1),
  preference: z.enum(PREFERENCES as readonly [RoutingPreference, ...RoutingPreference[]]),
  mode: z
    .union([z.object({ kind: z.literal("auto") }), z.object({ kind: z.literal("pinned"), providerId: id })])
    .optional(),
});

export const biddingRoundInputSchema = z.object({
  marketId: id,
  policy: biddingPolicySchema.optional(),
  providers: z.array(biddingProviderSchema).max(32).optional(),
  activeProviderId: id.nullable().optional(),
  recentRequests: z.number().int().min(0).max(10_000).optional(),
  recentWinners: z.array(id).max(50).optional(),
});

/** Structured output of one round. Provider ids are limited to the market's providers. */
export function modelOutputSchema(providerIds: readonly [string, ...string[]]) {
  return z.object({
    bids: z.array(
      z.object({
        providerId: z.enum(providerIds).describe("Provider id from the input."),
        bid: z.number().describe("New bid in USD per 1M requests, between the provider's floor and ceiling."),
        reason: z
          .string()
          .describe("One short plain-English sentence (max 20 words) that starts with 'It' and says why the bid moved or stayed."),
      }),
    ),
  });
}
