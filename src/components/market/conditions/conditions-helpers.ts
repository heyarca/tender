import {
  format,
  type ConditionsPatch,
  type MarketDefinition,
  type ProviderRow,
  type QualificationStatus,
  type RoutingPreference,
} from "@/lib/tender";
import type { BadgeTone } from "@/components/ui/badge";

import { clampDisplay, displayOf, engineOf } from "../policy/spec-values";

/** Badge tone for a qualification status (amber for limit misses, red for availability/reliability). */
export function statusTone(status: QualificationStatus): BadgeTone {
  switch (status) {
    case "eligible":
      return "positive";
    case "too-slow":
    case "stale-data":
    case "over-budget":
      return "warning";
    case "unavailable":
    case "unreliable":
      return "negative";
  }
}

export interface RoleBadge {
  label: string;
  tone: BadgeTone;
}

/** Route role of a provider as a badge: Active, Pinned, Standby, Excluded. */
export function roleBadge(row: Pick<ProviderRow, "role">): RoleBadge {
  switch (row.role) {
    case "active":
      return { label: "Active", tone: "active" };
    case "pinned":
      return { label: "Pinned", tone: "active" };
    case "pinned-failing":
      return { label: "Pinned, failing", tone: "negative" };
    case "standby":
      return { label: "Standby", tone: "neutral" };
    case "excluded":
      return { label: "Excluded", tone: "neutral" };
  }
}

const ordinal = (rank: number) => {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  return `${rank}${["th", "st", "nd", "rd"][rank % 10] ?? "th"}`;
};

const PREFERENCE_PHRASE: Record<RoutingPreference, string> = {
  "lowest-cost": "lowest cost",
  "lowest-latency": "lowest latency",
  "freshest-data": "freshest data",
};

/** One line under the provider picker: what the route does with this provider and why. */
export function roleSummary(row: ProviderRow, preference: RoutingPreference): string {
  const rank = row.evaluation.rank;
  const reasons = row.evaluation.reasons.map((reason) => reason.message).join("; ");
  switch (row.role) {
    case "active":
      return rank === 1
        ? `Serving requests. Ranked 1st for ${PREFERENCE_PHRASE[preference]}.`
        : `Serving requests. Ranked ${ordinal(rank ?? 1)} for ${PREFERENCE_PHRASE[preference]}.`;
    case "pinned":
      return "Pinned: serves every request and meets your policy.";
    case "pinned-failing":
      return `Pinned but fails your policy: ${reasons}. Requests still go here.`;
    case "standby":
      return row.isPendingTarget
        ? `Takes over when the switch cooldown ends. Ranked ${ordinal(rank ?? 1)} for ${PREFERENCE_PHRASE[preference]}.`
        : `Standby. Qualifies and ranks ${ordinal(rank ?? 1)} for ${PREFERENCE_PHRASE[preference]}.`;
    case "excluded":
      return `Excluded: ${reasons}.`;
  }
}

export type ScenarioId = "raise-bid" | "cut-bid" | "add-latency" | "delay-data" | "availability";

export interface Scenario {
  id: ScenarioId;
  label: string;
  /** Patch for `updateProvider`; `null` when the action would change nothing (at a range limit). */
  patch: ConditionsPatch | null;
}

/** Latency added by "Add … latency" (ms), per market. */
export const LATENCY_STEP_MS: Record<MarketDefinition["id"], number> = {
  "sf-weather": 300,
  "ny-weather": 300,
  "london-weather": 300,
  "seoul-weather": 300,
  "tokyo-weather": 300,
  "singapore-weather": 300,
  "btc-usd": 100,
  "eth-usd": 100,
  "sol-usd": 100,
  "xrp-usd": 100,
  "eur-usd": 100,
  "gbp-usd": 100,
};
/** Data delay added by "Delay data" (ms), per market. */
export const DATA_DELAY_MS: Record<MarketDefinition["id"], number> = {
  "sf-weather": 15 * 60_000,
  "ny-weather": 15 * 60_000,
  "london-weather": 15 * 60_000,
  "seoul-weather": 15 * 60_000,
  "tokyo-weather": 15 * 60_000,
  "singapore-weather": 15 * 60_000,
  "btc-usd": 1_000,
  "eth-usd": 1_000,
  "sol-usd": 1_000,
  "xrp-usd": 1_000,
  "eur-usd": 1_000,
  "gbp-usd": 1_000,
};

function scaledBid(definition: MarketDefinition, bid: number, factor: number): number {
  const spec = definition.conditionInputs.bidPrice;
  const display = displayOf(spec, bid) * factor;
  const snapped = Math.round(display / spec.step) * spec.step;
  return engineOf(spec, clampDisplay(spec, snapped));
}

function addedValue(
  definition: MarketDefinition,
  key: "p95LatencyMs" | "dataAgeMs",
  value: number,
  delta: number,
): number {
  const spec = definition.conditionInputs[key];
  return engineOf(spec, displayOf(spec, value) + delta / spec.factor);
}

const patchIfChanged = <K extends keyof ConditionsPatch>(
  key: K,
  next: NonNullable<ConditionsPatch[K]>,
  current: ConditionsPatch[K],
) => (next === current ? null : ({ [key]: next } as ConditionsPatch));

/**
 * One-click scenarios for the selected provider, labeled as product actions.
 * Values respect the market's condition input ranges and steps.
 */
export function scenarioActions(definition: MarketDefinition, row: Pick<ProviderRow, "conditions">): Scenario[] {
  const { conditions } = row;
  const latency = LATENCY_STEP_MS[definition.id];
  const delay = DATA_DELAY_MS[definition.id];
  return [
    {
      id: "raise-bid",
      label: "Raise bid 50%",
      patch: patchIfChanged("bidPrice", scaledBid(definition, conditions.bidPrice, 1.5), conditions.bidPrice),
    },
    {
      id: "cut-bid",
      label: "Cut bid 50%",
      patch: patchIfChanged("bidPrice", scaledBid(definition, conditions.bidPrice, 0.5), conditions.bidPrice),
    },
    {
      id: "add-latency",
      label: `Add ${format.latency(latency)} latency`,
      patch: patchIfChanged(
        "p95LatencyMs",
        addedValue(definition, "p95LatencyMs", conditions.p95LatencyMs, latency),
        conditions.p95LatencyMs,
      ),
    },
    {
      id: "delay-data",
      label: `Delay data ${format.dataAge(delay)}`,
      patch: patchIfChanged(
        "dataAgeMs",
        addedValue(definition, "dataAgeMs", conditions.dataAgeMs, delay),
        conditions.dataAgeMs,
      ),
    },
    {
      id: "availability",
      label: conditions.available ? "Take offline" : "Bring online",
      patch: { available: !conditions.available },
    },
  ];
}
