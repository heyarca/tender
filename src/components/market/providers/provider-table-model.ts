import {
  format,
  toDisplayValue,
  type CheckId,
  type MarketDefinition,
  type MarketView,
  type NumericInputSpec,
  type ProviderRow,
  type ProviderSample,
  type QualificationStatus,
  type RoutingPolicy,
} from "@/lib/tender";

/**
 * Pure view-model helpers for the Providers section: policy chips, table
 * grouping and sorting, failing-metric tints, trend selection, and route copy.
 * No React, so every rule here is unit tested.
 */

/** The four measured columns that a policy check can fail. */
export type MetricKey = "bid" | "latency" | "dataAge" | "success";

/** Column a failing check tints. Availability has no column of its own. */
export const CHECK_METRIC: Readonly<Record<CheckId, MetricKey | null>> = {
  availability: null,
  reliability: "success",
  price: "bid",
  latency: "latency",
  freshness: "dataAge",
};

export type SignalTone = "warning" | "negative";

/** Availability and reliability failures read red; budget, latency, and freshness read amber. */
export function checkTone(check: CheckId): SignalTone {
  return check === "availability" || check === "reliability" ? "negative" : "warning";
}

/** Badge tone of a qualification status. */
export function statusTone(status: QualificationStatus): "positive" | SignalTone {
  if (status === "eligible") return "positive";
  return status === "unavailable" || status === "unreliable" ? "negative" : "warning";
}

/** Metric cells that fail the policy, with the tone to tint them. */
export function failingMetrics(row: Pick<ProviderRow, "evaluation">): Partial<Record<MetricKey, SignalTone>> {
  const result: Partial<Record<MetricKey, SignalTone>> = {};
  for (const reason of row.evaluation.reasons) {
    const metric = CHECK_METRIC[reason.check];
    if (metric) result[metric] = checkTone(reason.check);
  }
  return result;
}

/** Failing check message for one metric cell ("P95 640 ms exceeds 400 ms"), or `null`. */
export function metricReason(row: Pick<ProviderRow, "evaluation">, metric: MetricKey): string | null {
  const reason = row.evaluation.reasons.find((r) => CHECK_METRIC[r.check] === metric);
  return reason ? reason.message : null;
}

// ---------------------------------------------------------------------------
// Policy chips
// ---------------------------------------------------------------------------

export type PolicyChipKey = "maxPrice" | "maxP95LatencyMs" | "maxDataAgeMs" | "minSuccessRate" | "mode";

export interface PolicyChip {
  key: PolicyChipKey;
  /** Visible chip text: "Max $40.00 /M". */
  label: string;
  /** Accessible description: "Max price $40.00 /M req". */
  description: string;
  /** Differs from the market default. */
  modified: boolean;
  /** Pinned to a provider that fails the policy. */
  failing: boolean;
}

/** Display value of a policy input in its form unit: 15 min, 1,000 ms, 99.50%. */
export function policyInputText(spec: NumericInputSpec, value: number): string {
  const display = toDisplayValue(spec, value);
  const number = format.number(display, spec.decimals);
  if (spec.unit === "%") return `${number}%`;
  return `${spec.prefix ?? ""}${number} ${spec.unit}`;
}

/** Dashed chips that summarize the active requirements (OpenRouter's filter chips). */
export function policyChips(
  view: Pick<MarketView, "policy" | "modifiedPolicyFields" | "providersById"> & {
    definition: Pick<MarketDefinition, "policyInputs">;
  },
): PolicyChip[] {
  const { policy, definition } = view;
  const inputs = definition.policyInputs;
  const modified = new Set(view.modifiedPolicyFields);
  const pinned = policy.mode.kind === "pinned" ? view.providersById[policy.mode.providerId] : undefined;
  const age = policyInputText(inputs.maxDataAgeMs, policy.maxDataAgeMs);
  const success = policyInputText(inputs.minSuccessRate, policy.minSuccessRate);
  return [
    {
      key: "maxPrice",
      label: `Max ${format.price(policy.maxPrice)} /M`,
      description: `Max price ${format.priceWithUnit(policy.maxPrice)}`,
      modified: modified.has("maxPrice"),
      failing: false,
    },
    {
      key: "maxP95LatencyMs",
      label: `P95 ≤ ${format.latency(policy.maxP95LatencyMs)}`,
      description: `Max P95 latency ${format.latency(policy.maxP95LatencyMs)}`,
      modified: modified.has("maxP95LatencyMs"),
      failing: false,
    },
    {
      key: "maxDataAgeMs",
      label: `Age ≤ ${age}`,
      description: `Max data age ${age}`,
      modified: modified.has("maxDataAgeMs"),
      failing: false,
    },
    {
      key: "minSuccessRate",
      label: `Success ≥ ${success}`,
      description: `Min success rate ${success}`,
      modified: modified.has("minSuccessRate"),
      failing: false,
    },
    pinned
      ? {
          key: "mode",
          label: `Pinned: ${pinned.name}`,
          description: `Pinned to ${pinned.name}`,
          modified: true,
          failing: !pinned.evaluation.qualifies,
        }
      : {
          key: "mode",
          label: "Auto",
          description: "Automatic switching",
          modified: false,
          failing: false,
        },
  ];
}

/** "4 of 8 qualify". */
export function qualifyCountText(qualified: number, total: number): string {
  return `${qualified} of ${total} qualif${qualified === 1 ? "ies" : "y"}`;
}

// ---------------------------------------------------------------------------
// Grouping and sorting
// ---------------------------------------------------------------------------

export type SortKey = "name" | "bid" | "latency" | "dataAge" | "success";
export type SortDirection = "asc" | "desc";
export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const SORT_VALUE: Record<Exclude<SortKey, "name">, (row: ProviderRow) => number> = {
  bid: (row) => row.conditions.bidPrice,
  latency: (row) => row.conditions.p95LatencyMs,
  dataAge: (row) => row.conditions.dataAgeMs,
  success: (row) => (row.conditions.available ? row.successRate : -1),
};

/** Natural first direction of a column: cheapest, fastest, freshest, most reliable, A–Z. */
export function defaultDirection(key: SortKey): SortDirection {
  return key === "success" ? "desc" : "asc";
}

/** Header click: natural direction → reversed → back to routing order (`null`). */
export function nextSort(current: SortState | null, key: SortKey): SortState | null {
  if (!current || current.key !== key) return { key, direction: defaultDirection(key) };
  if (current.direction === defaultDirection(key)) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return null;
}

/** Stable sort of rows by a column; ties keep routing order. */
export function sortProviders(rows: readonly ProviderRow[], sort: SortState | null): ProviderRow[] {
  if (!sort) return [...rows];
  const sign = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      let diff: number;
      if (sort.key === "name") {
        diff = a.row.name.localeCompare(b.row.name, "en", { sensitivity: "base" });
      } else {
        const getter = SORT_VALUE[sort.key];
        diff = getter(a.row) - getter(b.row);
      }
      return diff !== 0 ? diff * sign : a.index - b.index;
    })
    .map(({ row }) => row);
}

export interface ProviderGroups {
  /** Serving provider (even when a pinned one fails) and every qualified provider. */
  routed: ProviderRow[];
  /** Providers the policy excludes. */
  excluded: ProviderRow[];
}

/**
 * Split rows into the routed group and the "Excluded by your policy" group,
 * keeping `view.providers` order (active first, qualified by rank, then
 * excluded), and apply the local column sort inside each group.
 */
export function groupProviders(rows: readonly ProviderRow[], sort: SortState | null = null): ProviderGroups {
  const routed = rows.filter((row) => row.isActive || row.evaluation.qualifies);
  const excluded = rows.filter((row) => !row.isActive && !row.evaluation.qualifies);
  return { routed: sortProviders(routed, sort), excluded: sortProviders(excluded, sort) };
}

// ---------------------------------------------------------------------------
// Route column and tags
// ---------------------------------------------------------------------------

export type RouteTone = "active" | "negative" | "warning" | "neutral" | "faint";

export interface RouteLabel {
  text: string;
  tone: RouteTone;
}

/** Route column copy: Active, Pinned, Rank #2 standby, Excluded. */
export function routeLabel(row: Pick<ProviderRow, "role" | "evaluation" | "isPendingTarget">): RouteLabel {
  switch (row.role) {
    case "active":
      return { text: "Active", tone: "active" };
    case "pinned":
      return { text: "Pinned", tone: "active" };
    case "pinned-failing":
      return { text: "Pinned, failing", tone: "negative" };
    case "standby":
      if (row.isPendingTarget) return { text: "Next route", tone: "warning" };
      return { text: `Rank #${row.evaluation.rank ?? "–"} standby`, tone: "neutral" };
    case "excluded":
      return { text: "Excluded", tone: "faint" };
  }
}

export type ProviderTag = "active" | "pinned" | "best-price";

/** Inline tags after the provider name. */
export function providerTags(row: Pick<ProviderRow, "role" | "isBestPrice">): ProviderTag[] {
  const tags: ProviderTag[] = [];
  if (row.role === "active") tags.push("active");
  if (row.role === "pinned" || row.role === "pinned-failing") tags.push("pinned");
  if (row.isBestPrice) tags.push("best-price");
  return tags;
}

// ---------------------------------------------------------------------------
// Trend sparkline
// ---------------------------------------------------------------------------

export type TrendMetric = "latency" | "dataAge" | "bid" | "success";

export interface Trend {
  metric: TrendMetric;
  values: number[];
  limit: number;
  /** "P95 latency" */
  label: string;
  /** Accessible summary: "P95 latency, last 30 samples, now 210 ms, limit 400 ms". */
  description: string;
}

const TREND_LABELS: Record<TrendMetric, string> = {
  latency: "P95 latency",
  dataAge: "Data age",
  bid: "Bid",
  success: "Success rate",
};

const TREND_FROM_CHECK: Partial<Record<CheckId, TrendMetric>> = {
  latency: "latency",
  freshness: "dataAge",
  price: "bid",
  reliability: "success",
  availability: "success",
};

/**
 * The metric that matters for a row: the first failing check for an excluded
 * provider, otherwise the metric the preference ranks on (P95 latency for cost
 * and latency, data age for freshness, because bids are flat between edits).
 */
export function trendMetric(row: Pick<ProviderRow, "evaluation">, policy: Pick<RoutingPolicy, "preference">): TrendMetric {
  const first = row.evaluation.reasons[0];
  if (first) return TREND_FROM_CHECK[first.check] ?? "latency";
  return policy.preference === "freshest-data" ? "dataAge" : "latency";
}

function sampleValue(sample: ProviderSample, metric: TrendMetric): number {
  switch (metric) {
    case "latency":
      return sample.p95LatencyMs;
    case "dataAge":
      return sample.dataAgeMs;
    case "bid":
      return sample.bidPrice;
    case "success":
      return sample.successRate;
  }
}

function metricText(metric: TrendMetric, value: number): string {
  switch (metric) {
    case "latency":
      return format.latency(value);
    case "dataAge":
      return format.dataAge(value);
    case "bid":
      return `${format.price(value)} /M`;
    case "success":
      return format.percent(value);
  }
}

/** Sparkline series, policy limit, and copy for one row. */
export function providerTrend(row: Pick<ProviderRow, "evaluation" | "history">, policy: RoutingPolicy): Trend {
  const metric = trendMetric(row, policy);
  const values = row.history.map((sample) => sampleValue(sample, metric));
  const limit =
    metric === "latency"
      ? policy.maxP95LatencyMs
      : metric === "dataAge"
        ? policy.maxDataAgeMs
        : metric === "bid"
          ? policy.maxPrice
          : policy.minSuccessRate;
  const last = values.length ? values[values.length - 1] : null;
  const label = TREND_LABELS[metric];
  const bound = metric === "success" ? "minimum" : "limit";
  const description = [
    `${label}, last ${values.length} samples`,
    last === null ? null : `now ${metricText(metric, last)}`,
    `${bound} ${metricText(metric, limit)}`,
  ]
    .filter(Boolean)
    .join(", ");
  return { metric, values, limit, label, description };
}

/**
 * Vertical scale for a trend sparkline. Latency, age, and bid keep at least a
 * 100% span so monitor noise reads as calm texture and the dashed limit stays
 * in view. Success rate uses a fixed window from 1 down past the minimum
 * (twice the error budget), so 99.94% vs 99.50% is visible.
 */
export function trendScale(trend: Pick<Trend, "metric" | "values" | "limit">): {
  domain?: readonly [number, number];
  minSpanRatio?: number;
} {
  if (trend.metric !== "success") return { minSpanRatio: 1 };
  const finite = trend.values.filter((v) => Number.isFinite(v));
  const floor = trend.limit - 2 * (1 - trend.limit);
  const low = Math.min(floor, ...finite);
  const pad = (1 - low) * 0.1;
  return { domain: [Math.max(0, low - pad), 1 + pad] };
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

export interface ValuePart {
  text: string;
  unit: boolean;
}

/** Split "1 h 12 min" into number and unit parts so units can render muted. */
export function valueParts(text: string): ValuePart[] {
  const parts: ValuePart[] = [];
  for (const piece of text.split(/(\d[\d.,]*)/)) {
    if (!piece) continue;
    parts.push({ text: piece, unit: !/^\d/.test(piece) });
  }
  return parts;
}

/** Recent success samples for the three uptime bars (0 while unavailable). */
export function successSamples(row: Pick<ProviderRow, "history">, count = 3): number[] {
  return row.history.slice(-count).map((sample) => sample.successRate);
}
