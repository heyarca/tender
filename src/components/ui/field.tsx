"use client";

import type * as React from "react";
import { Field as BaseField } from "@base-ui/react/field";

import { cn } from "@/lib/utils";

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type FieldProps = WithClassName<React.ComponentProps<typeof BaseField.Root>>;

/**
 * Groups a label, a control (`Input`, `NumberField`, `Select`, `Switch`, …), a description,
 * and an error. Base UI wires `id` / `aria-labelledby` / `aria-describedby` automatically.
 * Pass `invalid` to mark the control invalid.
 */
export function Field({ className, ...props }: FieldProps) {
  return <BaseField.Root data-slot="field" className={cn("flex min-w-0 flex-col gap-1.5", className)} {...props} />;
}

export type FieldLabelProps = WithClassName<React.ComponentProps<typeof BaseField.Label>>;

export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <BaseField.Label
      data-slot="field-label"
      className={cn(
        "flex items-center gap-1 text-caption font-medium text-muted-foreground data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export type FieldDescriptionProps = WithClassName<React.ComponentProps<typeof BaseField.Description>>;

export function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  return (
    <BaseField.Description
      data-slot="field-description"
      className={cn("text-caption leading-snug text-muted-foreground", className)}
      {...props}
    />
  );
}

export type FieldErrorProps = WithClassName<React.ComponentProps<typeof BaseField.Error>>;

/** Error text. Shown whenever it is rendered (`match` defaults to `true`). */
export function FieldError({ className, match = true, ...props }: FieldErrorProps) {
  return (
    <BaseField.Error
      data-slot="field-error"
      match={match}
      className={cn("text-caption leading-snug text-negative-text", className)}
      {...props}
    />
  );
}
