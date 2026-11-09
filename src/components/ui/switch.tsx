"use client";

import type * as React from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

export type SwitchSize = "sm" | "md";

export interface SwitchProps
  extends Omit<React.ComponentProps<typeof BaseSwitch.Root>, "className" | "onCheckedChange"> {
  onCheckedChange?: (checked: boolean) => void;
  /** `sm` (default): 16×28. `md`: 20×36. */
  size?: SwitchSize;
  className?: string;
}

const rootSize: Record<SwitchSize, string> = {
  sm: "h-4 w-7",
  md: "h-5 w-9",
};

const thumbSize: Record<SwitchSize, string> = {
  sm: "size-3 data-checked:translate-x-3",
  md: "size-4 data-checked:translate-x-4",
};

/** Small toggle. Lime track with an ink thumb when on. */
export function Switch({ size = "sm", className, onCheckedChange, ...props }: SwitchProps) {
  return (
    <BaseSwitch.Root
      data-slot="switch"
      onCheckedChange={onCheckedChange ? (checked) => onCheckedChange(checked) : undefined}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center rounded-full bg-foreground/15 p-0.5 transition-colors duration-quick",
        "hover:bg-foreground/20 data-checked:bg-primary data-checked:hover:bg-primary-hover data-checked:shadow-[inset_0_0_0_1px_var(--primary-border)]",
        "focus-visible:outline-none focus-visible:shadow-focus",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        rootSize[size],
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          "block rounded-full bg-background shadow-sm transition-[transform,background-color] duration-quick ease-smooth-out motion-reduce:transition-none in-data-checked:bg-primary-foreground",
          thumbSize[size],
        )}
      />
    </BaseSwitch.Root>
  );
}
