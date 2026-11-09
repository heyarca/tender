"use client";

import type * as React from "react";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

import { InputAffix, inputControlClassName, inputShellVariants, type InputSize } from "./input";

export interface NumberFieldProps {
  value: number | null;
  /** Fires on every change (typing, steppers, arrow keys). */
  onValueChange: (value: number | null) => void;
  /** Fires when the value is committed (blur, Enter, stepper release). */
  onValueCommitted?: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Step for arrow keys and steppers. Defaults to 1. */
  step?: number;
  /** Step with Alt held. */
  smallStep?: number;
  /** Step with Shift held, and for Page Up / Page Down. */
  largeStep?: number;
  /** `Intl.NumberFormat` options, for example `{ minimumFractionDigits: 2, maximumFractionDigits: 2 }`. */
  format?: Intl.NumberFormatOptions;
  /** Formatting locale. Fixed to `en-US` by default so server and client output match. */
  locale?: string;
  /** Text inside the field before the value, for example "$". */
  prefix?: React.ReactNode;
  /** Unit inside the field after the value, for example "ms" or "/M". */
  suffix?: React.ReactNode;
  /** Show the up/down stepper buttons. Defaults to true. */
  steppers?: boolean;
  size?: InputSize;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Class for the root (set the width here). */
  className?: string;
  /** Class for the `<input>`. */
  inputClassName?: string;
}

const stepperClassName = cn(
  "flex w-5 flex-1 cursor-pointer items-center justify-center text-muted-foreground transition-colors duration-micro",
  "hover:bg-muted hover:text-foreground active:bg-muted/80 data-disabled:pointer-events-none data-disabled:opacity-40",
  "[&_svg]:size-3",
);

/**
 * Numeric input on Base UI NumberField: 32px field with optional "$" prefix and
 * unit suffix inside, compact steppers, min/max clamping, and arrow-key stepping.
 */
export function NumberField({
  value,
  onValueChange,
  onValueCommitted,
  min,
  max,
  step = 1,
  smallStep,
  largeStep,
  format,
  locale = "en-US",
  prefix,
  suffix,
  steppers = true,
  size,
  invalid,
  disabled,
  readOnly,
  required,
  id,
  name,
  placeholder,
  className,
  inputClassName,
  ...aria
}: NumberFieldProps) {
  return (
    <BaseNumberField.Root
      id={id}
      name={name}
      value={value}
      onValueChange={(next) => onValueChange(next)}
      onValueCommitted={onValueCommitted ? (next) => onValueCommitted(next) : undefined}
      min={min}
      max={max}
      step={step}
      smallStep={smallStep}
      largeStep={largeStep}
      format={format}
      locale={locale}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      data-slot="number-field"
      className={cn("min-w-0", className)}
    >
      <BaseNumberField.Group className={cn(inputShellVariants({ size }), "w-full")}>
        {prefix ? <InputAffix side="start">{prefix}</InputAffix> : null}
        <BaseNumberField.Input
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          className={cn(
            inputControlClassName,
            prefix ? "pl-1" : undefined,
            suffix || steppers ? "pr-1" : undefined,
            inputClassName,
          )}
          {...aria}
        />
        {suffix ? <InputAffix side="end" className={steppers ? "pr-2" : undefined}>{suffix}</InputAffix> : null}
        {steppers ? (
          <span className="flex h-full shrink-0 flex-col border-l border-input">
            <BaseNumberField.Increment aria-label="Increase" className={cn(stepperClassName, "border-b border-input")}>
              <ChevronUp aria-hidden="true" strokeWidth={2.25} />
            </BaseNumberField.Increment>
            <BaseNumberField.Decrement aria-label="Decrease" className={stepperClassName}>
              <ChevronDown aria-hidden="true" strokeWidth={2.25} />
            </BaseNumberField.Decrement>
          </span>
        ) : null}
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  );
}
