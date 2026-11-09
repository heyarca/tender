/**
 * Policy persistence (SPEC §4.6). Only policies (including mode) are stored;
 * provider conditions, requests, and activity are not.
 */
import { MARKET_IDS } from "./fixtures";
import { sanitizePolicy } from "./sanitize";
import type { MarketId, RoutingPolicy, TenderState } from "./types";

export { POLICIES_STORAGE_KEY } from "./constants";

/** Shape stored under `POLICIES_STORAGE_KEY`. */
export interface PersistedPolicies {
  version: 1;
  policies: Record<MarketId, RoutingPolicy>;
}

/** Serialize the policies of every market (nothing else). */
export function serializePolicies(state: TenderState): string {
  const policies = {} as Record<MarketId, RoutingPolicy>;
  for (const id of MARKET_IDS) policies[id] = state.markets[id].policy;
  const payload: PersistedPolicies = { version: 1, policies };
  return JSON.stringify(payload);
}

/**
 * Parse a stored value. Returns validated policies by market; unknown markets,
 * invalid JSON, and other versions yield an empty object.
 */
export function parsePersistedPolicies(raw: string | null | undefined): Partial<Record<MarketId, RoutingPolicy>> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const { version, policies } = parsed as { version?: unknown; policies?: unknown };
  if (version !== 1 || !policies || typeof policies !== "object") return {};
  const out: Partial<Record<MarketId, RoutingPolicy>> = {};
  for (const id of MARKET_IDS) {
    const policy = sanitizePolicy(id, (policies as Record<string, unknown>)[id]);
    if (policy) out[id] = policy;
  }
  return out;
}

/** Whether any market's policy object changed between two states. */
export function policiesChanged(a: TenderState, b: TenderState): boolean {
  return MARKET_IDS.some((id) => a.markets[id].policy !== b.markets[id].policy);
}
