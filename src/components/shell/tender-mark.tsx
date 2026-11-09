import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Geometry of the Tender mark on a 20 × 20 grid: three offers stepping down
 * in price, and a solid dot for the winning bid. Shared with `src/app/icon.svg`
 * and `public/brand/tender-mark.svg`.
 */
export const TENDER_MARK_BARS = "M3.8 3.8h12.4M3.8 10h7.6M3.8 16.2h1.6";
export const TENDER_MARK_DOT = { cx: 12.6, cy: 16.2, r: 3.1 } as const;

export interface TenderMarkProps extends Omit<React.SVGProps<SVGSVGElement>, "children" | "title"> {
  /** Accessible name. Pass `null` when the mark sits next to visible "tender" text. Default "Tender". */
  title?: string | null;
}

/**
 * The Tender mark: an ink glyph on a lime tile, readable on light and dark
 * surfaces. Size it with `size-*` classes; `size-5` by default.
 */
export function TenderMark({ title = "Tender", className, ...props }: TenderMarkProps) {
  const labelled = title !== null;
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      className={cn("size-5 shrink-0", className)}
      {...props}
    >
      <rect width="20" height="20" rx="5" fill="var(--primary)" />
      <g transform="translate(3.2 3.2) scale(0.68)">
        <path d={TENDER_MARK_BARS} stroke="var(--primary-foreground)" strokeWidth={4} strokeLinecap="round" />
        <circle {...TENDER_MARK_DOT} fill="var(--primary-foreground)" />
      </g>
    </svg>
  );
}
