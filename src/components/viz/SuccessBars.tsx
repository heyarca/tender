import { cn } from "@/lib/utils";
import { successTone, type SuccessTone } from "./colors";
import { formatPercent } from "./format";

export interface SuccessBarsProps {
  /** Success rates (0..1), oldest first. The last `count` values are shown. */
  values: readonly (number | null)[];
  /** Minimum success rate (0..1). At or above it a bar is green. */
  threshold: number;
  /** Below this a bar is red; between it and `threshold` it is amber. Default allows 2× the error budget. */
  criticalThreshold?: number;
  /** Number of bars. Default 3. Missing samples render as empty bars. */
  count?: number;
  /** Label after the bars. Default: the newest value as `99.94%`. Pass `false` to hide it. */
  label?: string | false;
  /** Accessible summary. Default: "Success rate 99.94%". */
  ariaLabel?: string;
  className?: string;
}

const BAR_CLASS: Record<SuccessTone, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
  empty: "bg-muted",
};

const LABEL_CLASS: Record<SuccessTone, string> = {
  positive: "text-foreground",
  warning: "text-warning-text",
  negative: "text-negative-text",
  empty: "text-muted-foreground",
};

/** OpenRouter's uptime bars: three tiny bars colored against a threshold plus a percentage. */
export function SuccessBars({
  values,
  threshold,
  criticalThreshold,
  count = 3,
  label,
  ariaLabel,
  className,
}: SuccessBarsProps) {
  const recent = values.slice(-count);
  const padded: (number | null)[] = [...Array<null>(Math.max(0, count - recent.length)).fill(null), ...recent];
  const latest = recent.length ? recent[recent.length - 1] : null;
  const latestTone = successTone(latest, threshold, criticalThreshold);
  const text = label === false ? null : (label ?? (latest === null ? "–" : formatPercent(latest)));

  return (
    <div
      className={cn("flex items-center justify-end gap-1", className)}
      role="img"
      aria-label={ariaLabel ?? (latest === null ? "No success rate data" : `Success rate ${formatPercent(latest)}`)}
    >
      <div className="flex h-3.5 shrink-0 items-end gap-px" aria-hidden="true">
        {padded.map((value, i) => (
          <div
            key={i}
            className={cn(
              "h-full w-1.5 transition-colors duration-quick",
              BAR_CLASS[successTone(value, threshold, criticalThreshold)],
            )}
            data-tone={successTone(value, threshold, criticalThreshold)}
          />
        ))}
      </div>
      {text !== null && (
        <span
          className={cn(
            "inline-flex w-16 shrink-0 justify-end whitespace-nowrap tabular-nums",
            LABEL_CLASS[latestTone],
          )}
          aria-hidden="true"
        >
          {text}
        </span>
      )}
    </div>
  );
}
