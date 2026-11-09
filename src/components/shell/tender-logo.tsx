import type * as React from "react";
import { cn } from "@/lib/utils";
import { TenderMark } from "./tender-mark";

export interface TenderLogoProps extends React.ComponentProps<"span"> {
  /** Extra classes for the mark (for example a different size). */
  markClassName?: string;
  /** Hides the wordmark and keeps the mark only. */
  markOnly?: boolean;
}

/**
 * Tender lockup: lime mark + lowercase "tender" wordmark (PP Mori Semibold,
 * tight tracking), 24px tall like OpenRouter's nav lockup.
 */
export function TenderLogo({ className, markClassName, markOnly = false, ...props }: TenderLogoProps) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-2 text-foreground", className)} {...props}>
      <TenderMark title={markOnly ? "Tender" : null} className={cn("size-6", markClassName)} />
      {markOnly ? null : (
        <span className="-translate-y-px font-sans text-[20px] leading-none font-semibold tracking-[-0.04em]">
          tender
        </span>
      )}
    </span>
  );
}
