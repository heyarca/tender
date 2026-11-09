import type * as React from "react";

import { cn } from "@/lib/utils";

export type StatCardTone = "default" | "active" | "positive" | "warning" | "negative" | "muted";

const valueTone: Record<StatCardTone, string> = {
  default: "text-foreground",
  active: "text-accent-foreground",
  positive: "text-positive-text",
  warning: "text-warning-text",
  negative: "text-negative-text",
  muted: "text-muted-foreground",
};

export interface StatCardProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** 12px muted label. */
  label: React.ReactNode;
  /** 16px medium value. */
  value: React.ReactNode;
  /** Muted unit after the value, e.g. "ms" or "/M req". */
  unit?: React.ReactNode;
  /** One muted line under the value. */
  sub?: React.ReactNode;
  /** Leading icon or image before the value (e.g. a `ProviderLogo` at 16px). */
  leading?: React.ReactNode;
  /** Small icon before the label. */
  icon?: React.ReactNode;
  /** Top-right slot in the label row (e.g. an `InfoTooltip` or `Badge`). */
  action?: React.ReactNode;
  /** Color of the value. */
  tone?: StatCardTone;
}

/**
 * OpenRouter's compact stat card: `rounded-lg border bg-card px-3 py-2.5`,
 * 12px label row, 16px tabular value with a muted unit.
 */
export function StatCard({
  label,
  value,
  unit,
  sub,
  leading,
  icon,
  action,
  tone = "default",
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn("w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2.5", className)}
      {...props}
    >
      <div className="flex min-h-5 items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1 text-caption text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      <div
        className={cn(
          "mt-1 flex min-w-0 items-center gap-1.5 text-base leading-tight font-medium tabular-nums",
          valueTone[tone],
        )}
      >
        {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
        <span className="min-w-0 truncate">
          {value}
          {unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
        </span>
      </div>
      {sub ? <div className="mt-1 truncate text-caption text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
