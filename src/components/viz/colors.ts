/**
 * Color helpers. Colors are CSS variable references from globals.css, never hex values,
 * so SVG `stroke`/`fill` and inline styles follow the design tokens.
 */

/** The eight categorical chart colors, in order. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

export type ChartColor = (typeof CHART_COLORS)[number];

function hashString(value: string): number {
  // FNV-1a, 32-bit. Deterministic across server and client.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Stable color for a provider. Pass the market's provider ids in fixture order so each provider
 * keeps its color everywhere (tables, legends, charts). Unknown ids fall back to a hash.
 */
export function providerColor(id: string, ids: readonly string[] = []): ChartColor {
  const index = ids.indexOf(id);
  if (index >= 0) return CHART_COLORS[index % CHART_COLORS.length];
  return CHART_COLORS[hashString(id) % CHART_COLORS.length];
}

/** `providerColor` for every id at once. */
export function providerColorMap(ids: readonly string[]): Record<string, ChartColor> {
  return Object.fromEntries(ids.map((id) => [id, providerColor(id, ids)]));
}

/** Semantic tones for lines, dots, and bars. */
export type VizTone = "active" | "neutral" | "muted" | "positive" | "warning" | "negative";

export const TONE_COLORS: Record<VizTone, string> = {
  active: "var(--primary-strong)",
  neutral: "var(--muted-foreground)",
  muted: "var(--text-faint)",
  positive: "var(--positive)",
  warning: "var(--warning)",
  negative: "var(--negative)",
};

export type SuccessTone = "positive" | "warning" | "negative" | "empty";

/**
 * Tone of a success rate against a minimum. At or above the minimum is positive; below it but
 * within the critical bound is a warning; anything lower is negative. By default the critical bound
 * allows twice the error budget (min 99.50% → warning down to 99.00%).
 */
export function successTone(value: number | null | undefined, min: number, critical?: number): SuccessTone {
  if (value === null || value === undefined || !Number.isFinite(value)) return "empty";
  const floor = critical ?? 1 - 2 * (1 - min);
  if (value >= min) return "positive";
  if (value >= floor) return "warning";
  return "negative";
}
