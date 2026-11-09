import { cn } from "@/lib/utils";

export interface DeltaProps {
  /** Signed change. Positive renders ▲ in green, negative ▼ in red, zero a muted dash. */
  value: number;
  /** Formats the absolute change, e.g. `(v) => formatUsd(v)`. Default: two decimals. */
  format?: (absolute: number) => string;
  /** Signed relative change as a fraction (0.0012 = 0.12%), shown in parentheses. */
  percent?: number | null;
  /** Fraction digits for `percent`. Default 2. */
  percentDecimals?: number;
  /** Treat a decrease as good (latency, price paid): flips the colors, not the arrows. */
  invert?: boolean;
  className?: string;
}

const defaultFormat = (v: number) => v.toFixed(2);

/** Inline change indicator: `▲ $3.25 (0.00%)`. */
export function Delta({ value, format = defaultFormat, percent, percentDecimals = 2, invert = false, className }: DeltaProps) {
  const direction = !Number.isFinite(value) || value === 0 ? 0 : value > 0 ? 1 : -1;
  const good = invert ? direction < 0 : direction > 0;
  const tone = direction === 0 ? "text-muted-foreground" : good ? "text-positive-text" : "text-negative-text";
  const pct =
    percent === null || percent === undefined || !Number.isFinite(percent)
      ? null
      : `${(Math.abs(percent) * 100).toFixed(percentDecimals)}%`;

  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap tabular-nums", tone, className)}>
      {direction === 0 ? (
        <span aria-hidden="true" className="inline-block h-px w-2 bg-current" />
      ) : (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" className="shrink-0 fill-current">
          <path d={direction > 0 ? "M4 1 L7.5 7 L0.5 7 Z" : "M4 7 L7.5 1 L0.5 1 Z"} />
        </svg>
      )}
      <span className="sr-only">{direction > 0 ? "Up" : direction < 0 ? "Down" : "No change"}</span>
      <span>{format(Math.abs(Number.isFinite(value) ? value : 0))}</span>
      {pct !== null && <span className="opacity-80">({pct})</span>}
    </span>
  );
}
