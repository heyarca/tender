"use client";

import { Slider as BaseSlider } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  /** Fires when the pointer is released or a key press ends. */
  onValueCommitted?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Step with Shift held, and for Page Up / Page Down. */
  largeStep?: number;
  disabled?: boolean;
  /** Formats `aria-valuetext`. */
  format?: Intl.NumberFormatOptions;
  locale?: string;
  /** Overrides the announced value, e.g. `(v) => \`${v} ms\``. */
  getAriaValueText?: (formattedValue: string, value: number) => string;
  name?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/** Thin 4px track, grape range, white bordered 16px thumb. */
export function Slider({
  value,
  onValueChange,
  onValueCommitted,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  disabled,
  format,
  locale = "en-US",
  getAriaValueText,
  name,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SliderProps) {
  return (
    <BaseSlider.Root
      id={id}
      name={name}
      value={value}
      onValueChange={(next) => onValueChange(Array.isArray(next) ? next[0] : next)}
      onValueCommitted={
        onValueCommitted ? (next) => onValueCommitted(Array.isArray(next) ? next[0] : next) : undefined
      }
      min={min}
      max={max}
      step={step}
      largeStep={largeStep}
      disabled={disabled}
      format={format}
      locale={locale}
      data-slot="slider"
      className={cn("w-full data-disabled:opacity-50", className)}
    >
      <BaseSlider.Control className="flex w-full touch-none items-center py-2 select-none data-disabled:cursor-not-allowed">
        <BaseSlider.Track className="relative h-1 w-full rounded-full bg-border select-none">
          <BaseSlider.Indicator className="rounded-full bg-primary select-none" />
          <BaseSlider.Thumb
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            getAriaValueText={
              getAriaValueText ? (formatted, v) => getAriaValueText(formatted, v) : undefined
            }
            className={cn(
              "size-4 cursor-grab rounded-full border border-input bg-background shadow-sm select-none",
              "transition-[box-shadow,border-color] duration-quick data-dragging:cursor-grabbing",
              "has-[:focus-visible]:border-primary has-[:focus-visible]:shadow-[0_0_0_3px_var(--color-accent)]",
              "data-dragging:border-primary",
            )}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
