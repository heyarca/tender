import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Keyboard key chip, matching OpenRouter's search shortcut hint.
 *
 * @example <Kbd>⌘</Kbd><Kbd>K</Kbd>
 */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm bg-muted px-1.5 py-0.5 font-mono text-overline leading-none font-normal text-muted-foreground select-none",
        className,
      )}
      {...props}
    />
  );
}

export interface KbdGroupProps extends React.ComponentProps<"span"> {
  /** Keys to render as separate chips, e.g. `["⌘", "K"]`. Ignored when `children` is set. */
  keys?: readonly string[];
}

/** A row of `Kbd` chips for a key combination. */
export function KbdGroup({ keys, className, children, ...props }: KbdGroupProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5", className)} {...props}>
      {children ?? keys?.map((key) => <Kbd key={key}>{key}</Kbd>)}
    </span>
  );
}
