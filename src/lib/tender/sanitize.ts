/**
 * Input sanitizing for patches and persisted policies. Values are clamped to
 * the market's input ranges (in engine units); invalid fields are dropped.
 */
import { PREFERENCES } from "./evaluate";
import { getDefaultPolicy, MARKETS } from "./markets";
import type {
  ConditionsPatch,
  MarketId,
  NumericInputSpec,
  PolicyPatch,
  RoutingMode,
  RoutingPolicy,
  RoutingPreference,
} from "./types";

function clampTo(spec: NumericInputSpec, value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const min = spec.min * spec.factor;
  const max = spec.max * spec.factor;
  return Number(Math.min(max, Math.max(min, value)).toFixed(10));
}

const isPreference = (value: unknown): value is RoutingPreference =>
  typeof value === "string" && (PREFERENCES as readonly string[]).includes(value);

/** Keep valid, clamped policy fields only. */
export function sanitizePolicyPatch(marketId: MarketId, patch: PolicyPatch): PolicyPatch {
  const inputs = MARKETS[marketId].policyInputs;
  const out: PolicyPatch = {};
  const maxPrice = clampTo(inputs.maxPrice, patch.maxPrice);
  if (maxPrice !== undefined) out.maxPrice = maxPrice;
  const maxP95LatencyMs = clampTo(inputs.maxP95LatencyMs, patch.maxP95LatencyMs);
  if (maxP95LatencyMs !== undefined) out.maxP95LatencyMs = maxP95LatencyMs;
  const maxDataAgeMs = clampTo(inputs.maxDataAgeMs, patch.maxDataAgeMs);
  if (maxDataAgeMs !== undefined) out.maxDataAgeMs = maxDataAgeMs;
  const minSuccessRate = clampTo(inputs.minSuccessRate, patch.minSuccessRate);
  if (minSuccessRate !== undefined) out.minSuccessRate = minSuccessRate;
  if (isPreference(patch.preference)) out.preference = patch.preference;
  return out;
}

/** Keep valid, clamped condition fields only. */
export function sanitizeConditionsPatch(marketId: MarketId, patch: ConditionsPatch): ConditionsPatch {
  const inputs = MARKETS[marketId].conditionInputs;
  const out: ConditionsPatch = {};
  const bidPrice = clampTo(inputs.bidPrice, patch.bidPrice);
  if (bidPrice !== undefined) out.bidPrice = bidPrice;
  const p95LatencyMs = clampTo(inputs.p95LatencyMs, patch.p95LatencyMs);
  if (p95LatencyMs !== undefined) out.p95LatencyMs = p95LatencyMs;
  const dataAgeMs = clampTo(inputs.dataAgeMs, patch.dataAgeMs);
  if (dataAgeMs !== undefined) out.dataAgeMs = dataAgeMs;
  const errorRate = clampTo(inputs.errorRate, patch.errorRate);
  if (errorRate !== undefined) out.errorRate = errorRate;
  if (typeof patch.available === "boolean") out.available = patch.available;
  return out;
}

/** Validate a routing mode against the market's providers. */
export function sanitizeMode(marketId: MarketId, value: unknown): RoutingMode | null {
  if (!value || typeof value !== "object") return null;
  const mode = value as { kind?: unknown; providerId?: unknown };
  if (mode.kind === "auto") return { kind: "auto" };
  if (
    mode.kind === "pinned" &&
    typeof mode.providerId === "string" &&
    MARKETS[marketId].providers.some((p) => p.id === mode.providerId)
  ) {
    return { kind: "pinned", providerId: mode.providerId };
  }
  return null;
}

/**
 * Validate a full policy (e.g. from localStorage). Missing or invalid fields
 * fall back to the market default; returns `null` for non-objects.
 */
export function sanitizePolicy(marketId: MarketId, value: unknown): RoutingPolicy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const defaults = getDefaultPolicy(marketId);
  return {
    ...defaults,
    ...sanitizePolicyPatch(marketId, raw as PolicyPatch),
    mode: sanitizeMode(marketId, raw.mode) ?? defaults.mode,
  };
}
