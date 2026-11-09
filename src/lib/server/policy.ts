import { PREFERENCES } from "@/lib/tender";
import { ApiError } from "./http";

/** Wire inputs remain separate from the engine's policy units and field names. */
export const POLICY_PARAMETERS = [
  { query: "max_price", header: "Tender-Max-Price", field: "maxPrice", max: Number.MAX_SAFE_INTEGER, description: "Maximum bid in USD per 1M requests" },
  { query: "max_p95_ms", header: "Tender-Max-P95-Ms", field: "maxP95LatencyMs", max: Number.MAX_SAFE_INTEGER, description: "Maximum provider P95 latency in milliseconds" },
  { query: "max_data_age_ms", header: "Tender-Max-Data-Age-Ms", field: "maxDataAgeMs", max: Number.MAX_SAFE_INTEGER, description: "Maximum provider data age in milliseconds" },
  { query: "min_success_rate", header: "Tender-Min-Success-Rate", field: "minSuccessRate", max: 1, description: "Minimum success rate as a fraction from 0 to 1, not a percentage" },
] as const;
export { PREFERENCES };
export interface PolicyOverrides {
  maxPrice?: number; maxP95LatencyMs?: number; maxDataAgeMs?: number; minSuccessRate?: number;
  preference?: typeof PREFERENCES[number];
  mode?: { kind: "pinned"; providerId: string };
}
function invalid(name: string): never { throw new ApiError(400, "invalid_policy", `Invalid ${name}`); }
export function readPolicyOverrides(request: Request): PolicyOverrides {
  const query = new URL(request.url).searchParams;
  function value(name: string, header: string): string | null {
    if (query.getAll(name).length > 1) invalid(name);
    return query.has(name) ? query.get(name) : request.headers.get(header);
  }
  const patch: PolicyOverrides = {};
  for (const parameter of POLICY_PARAMETERS) {
    const raw = value(parameter.query, parameter.header);
    if (raw === null) continue;
    // No blanks, hexadecimal, Infinity, or negative values. Zero is a meaningful limit.
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) invalid(parameter.query);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > parameter.max) invalid(parameter.query);
    patch[parameter.field] = parsed;
  }
  const preference = value("preference", "Tender-Preference");
  if (preference !== null) {
    if (!PREFERENCES.includes(preference as typeof PREFERENCES[number])) invalid("preference");
    patch.preference = preference as typeof PREFERENCES[number];
  }
  const pin = value("pin", "Tender-Pin");
  if (pin !== null) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pin)) invalid("pin");
    patch.mode = { kind: "pinned", providerId: pin };
  }
  return patch;
}
