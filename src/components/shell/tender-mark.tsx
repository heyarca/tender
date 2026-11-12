import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Geometry of the Tender mark (Figma file "Tender", Frame 10): an asterisk beside a square on a
 * 318 × 159 grid. Shared with `src/app/icon.svg` and `public/brand/tender-mark*.svg`.
 */
export const TENDER_MARK_VIEWBOX = "0 0 318 159";
export const TENDER_MARK_ASTERISK =
  "M94.8165 159H64.1835V105.88L14.5872 134.427L0 108.048L49.5963 79.1386L0 50.9523L14.5872 24.5727L64.1835 53.1205V0H94.8165V53.1205L144.778 24.5727L159 50.9523L109.768 79.1386L159 107.686L144.413 134.066L94.8165 105.518V159Z";
export const TENDER_MARK_SQUARE = { x: 159, y: 0, width: 159, height: 159 } as const;

export interface TenderMarkProps extends Omit<React.SVGProps<SVGSVGElement>, "children" | "title"> {
  /** Accessible name. Pass `null` when the mark sits next to visible "tender" text. Default "Tender". */
  title?: string | null;
}

/** The Tender mark in `currentColor`, twice as wide as it is tall (`h-2.5 w-5` by default). */
export function TenderMark({ title = "Tender", className, ...props }: TenderMarkProps) {
  const labelled = title !== null;
  return (
    <svg
      viewBox={TENDER_MARK_VIEWBOX}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      className={cn("h-2.5 w-5 shrink-0", className)}
      {...props}
    >
      <path d={TENDER_MARK_ASTERISK} />
      <rect {...TENDER_MARK_SQUARE} />
    </svg>
  );
}
