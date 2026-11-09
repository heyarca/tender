"use client";

import type * as React from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The bordered shell shared by text and number inputs: white field, hairline border,
 * focus border + soft focus ring, red border when the control is `aria-invalid`.
 */
export const inputShellVariants = cva(
  [
    "flex min-w-0 items-center overflow-hidden rounded-md border border-input bg-input-bg text-body text-foreground",
    "transition-[border-color,box-shadow] duration-quick",
    "focus-within:border-focus-border focus-within:shadow-focus",
    "has-[[aria-invalid=true]]:border-negative has-[[aria-invalid=true]]:focus-within:shadow-[0_0_0_3px_var(--color-negative-bg)]",
    "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
  ],
  {
    variants: {
      size: {
        sm: "h-7",
        md: "h-8",
        lg: "h-9",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type InputSize = NonNullable<VariantProps<typeof inputShellVariants>["size"]>;

/** Class for the bare `<input>` inside a shell. */
export const inputControlClassName =
  "h-full w-full min-w-0 flex-1 bg-transparent px-2.5 tabular-nums outline-none placeholder:text-faint disabled:cursor-not-allowed";

export function InputAffix({
  side,
  className,
  ...props
}: React.ComponentProps<"span"> & { side: "start" | "end" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center whitespace-nowrap text-muted-foreground select-none",
        side === "start" ? "pl-2.5" : "pr-2.5",
        className,
      )}
      {...props}
    />
  );
}

export interface InputProps
  extends Omit<React.ComponentProps<typeof BaseInput>, "prefix" | "size" | "className"> {
  /** Text or icon inside the field, before the value (for example "$"). */
  prefix?: React.ReactNode;
  /** Unit inside the field, after the value (for example "ms"). */
  suffix?: React.ReactNode;
  size?: InputSize;
  /** Marks the control invalid (`aria-invalid`) and paints the error border. */
  invalid?: boolean;
  /** Class for the shell. */
  className?: string;
  /** Class for the `<input>`. */
  inputClassName?: string;
}

/** Text input on Base UI Input (labels itself inside a `Field`). */
export function Input({
  prefix,
  suffix,
  size,
  invalid,
  className,
  inputClassName,
  ...props
}: InputProps) {
  return (
    <div data-slot="input" className={cn(inputShellVariants({ size }), className)}>
      {prefix ? <InputAffix side="start">{prefix}</InputAffix> : null}
      <BaseInput
        aria-invalid={invalid || undefined}
        className={cn(
          inputControlClassName,
          prefix ? "pl-1" : undefined,
          suffix ? "pr-1" : undefined,
          inputClassName,
        )}
        {...props}
      />
      {suffix ? <InputAffix side="end">{suffix}</InputAffix> : null}
    </div>
  );
}
