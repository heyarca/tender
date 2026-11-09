import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Loading placeholder, OpenRouter's `animate-pulse rounded-md bg-muted` block.
 * Size it with `className` (for example `h-8 w-24`). Decorative: hidden from assistive tech.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
