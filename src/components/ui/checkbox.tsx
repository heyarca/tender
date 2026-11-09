"use client";

import type * as React from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.ComponentProps<typeof BaseCheckbox.Root>, "className" | "onCheckedChange"> {
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

/** 16px checkbox; lime fill when checked or indeterminate. */
export function Checkbox({ className, onCheckedChange, indeterminate, ...props }: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      data-slot="checkbox"
      indeterminate={indeterminate}
      onCheckedChange={onCheckedChange ? (checked) => onCheckedChange(checked) : undefined}
      className={cn(
        "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-foreground/25 bg-input-bg text-primary-foreground transition-colors duration-quick",
        "hover:border-foreground/40 data-checked:border-primary-border data-checked:bg-primary data-indeterminate:border-primary-border data-indeterminate:bg-primary",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--color-accent)]",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator className="flex data-unchecked:hidden">
        {indeterminate ? (
          <Minus aria-hidden="true" className="size-3" strokeWidth={3} />
        ) : (
          <Check aria-hidden="true" className="size-3" strokeWidth={3} />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
