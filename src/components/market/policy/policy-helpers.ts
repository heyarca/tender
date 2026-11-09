import { evaluateMarket, runChecks, type CheckId, type MarketView, type ProviderId, type RoutingPolicy } from "@/lib/tender";

import { engineOf } from "./spec-values";

export type PolicyField = "maxPrice" | "maxP95LatencyMs" | "maxDataAgeMs" | "minSuccessRate";

/** Policy limits in form order, with the check each one drives. */
export const POLICY_FIELDS: readonly { key: PolicyField; label: string; check: CheckId }[] = [
  { key: "maxPrice", label: "Max request price", check: "price" },
  { key: "maxP95LatencyMs", label: "Max P95 latency", check: "latency" },
  { key: "maxDataAgeMs", label: "Max data age", check: "freshness" },
  { key: "minSuccessRate", label: "Min success rate", check: "reliability" },
];

export interface EligibilityPreview {
  /** Policy with in-progress edits applied (equals the committed policy when idle). */
  policy: RoutingPolicy;
  qualifiedIds: Set<ProviderId>;
  /** Qualified provider ids, best first for the policy's preference. */
  ranking: ProviderId[];
  /** Failing-check copy per excluded provider ("P95 640 ms exceeds 400 ms"). */
  reasons: Record<ProviderId, string>;
  /** Providers passing each check under `policy`. */
  passCounts: Record<CheckId, number>;
}

/** Committed policy with draft values (display units) applied. Empty drafts are ignored. */
export function draftPolicy(
  view: Pick<MarketView, "policy" | "definition">,
  drafts: Partial<Record<PolicyField, { value: number | null }>>,
): RoutingPolicy {
  const policy: RoutingPolicy = { ...view.policy };
  for (const { key } of POLICY_FIELDS) {
    const draft = drafts[key];
    if (draft && draft.value !== null && Number.isFinite(draft.value)) {
      policy[key] = engineOf(view.definition.policyInputs[key], draft.value);
    }
  }
  return policy;
}

/**
 * Evaluate the market's current provider conditions against the policy with
 * draft edits applied, so the form can preview eligibility while a value is
 * typed or dragged (the store only changes on commit).
 */
export function previewEligibility(
  view: Pick<MarketView, "policy" | "definition" | "providers">,
  drafts: Partial<Record<PolicyField, { value: number | null }>> = {},
): EligibilityPreview {
  const policy = draftPolicy(view, drafts);
  const evaluation = evaluateMarket(
    view.providers.map((row) => ({ id: row.id, name: row.name, conditions: row.conditions })),
    policy,
  );
  const passCounts: Record<CheckId, number> = { availability: 0, reliability: 0, price: 0, latency: 0, freshness: 0 };
  const reasons: Record<ProviderId, string> = {};
  for (const row of view.providers) {
    for (const check of runChecks(row.conditions, policy)) if (check.passed) passCounts[check.check] += 1;
    const providerEvaluation = evaluation.byId[row.id];
    if (!providerEvaluation.qualifies) reasons[row.id] = providerEvaluation.reasons.map((reason) => reason.message).join("; ");
  }
  return { policy, qualifiedIds: new Set(evaluation.ranking), ranking: evaluation.ranking, reasons, passCounts };
}
