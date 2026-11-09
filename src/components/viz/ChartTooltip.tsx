import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartTooltipProps {
  /** Position inside the chart container, in px. */
  left: number;
  top: number;
  children: ReactNode;
  className?: string;
}

/** Floating tooltip box for charts: white, bordered, popover shadow, caption text. */
export function ChartTooltip({ left, top, children, className }: ChartTooltipProps) {
  return (
    <div
      role="presentation"
      className={cn(
        "pointer-events-none absolute z-10 min-w-36 rounded-md border border-border bg-popover px-2.5 py-2 text-caption text-popover-foreground shadow-popover",
        className,
      )}
      style={{ left, top }}
    >
      {children}
    </div>
  );
}

/** One label/value row inside a chart tooltip. */
export function ChartTooltipRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 leading-5">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 tabular-nums text-foreground">{children}</span>
    </div>
  );
}
