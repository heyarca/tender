"use client";

import type * as React from "react";
import { RotateCcw } from "lucide-react";

import { NumberField } from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import { InfoTooltip } from "@/components/ui/tooltip";
import type { NumericInputSpec } from "@/lib/tender";
import { cn } from "@/lib/utils";

import { clampDisplay, numberFormatOf } from "./spec-values";

/** In-progress edit of a field: `value` is `null` while the input is empty. */
export interface FieldDraft {
  value: number | null;
}

export interface SpecFieldProps {
  /** Input id (the label points at it). */
  id: string;
  label: string;
  spec: NumericInputSpec;
  /** Committed value, in display units. */
  value: number;
  /** In-progress edit (typing, stepping, dragging), or `null` when idle. */
  draft: FieldDraft | null;
  onDraftChange: (draft: FieldDraft | null) => void;
  /**
   * Called with a clamped display value when the edit is committed: blur, Enter,
   * stepper release, arrow keys, or slider release. Omit to keep the draft until
   * the parent submits it (for example "Update bid").
   */
  onCommit?: (display: number) => void;
  /** Called on Enter when `onCommit` is omitted. */
  onSubmit?: () => void;
  /** Field differs from its default: shows a olive dot and a reset link. */
  modified: boolean;
  /** Default value with unit, e.g. "400 ms". */
  defaultLabel: string;
  onReset?: () => void;
  /** Show a slider under the input. */
  slider?: boolean;
  /** Right side of the label row (e.g. "6 of 8 pass"). */
  aside?: React.ReactNode;
  /** Element placed to the right of the input (e.g. an "Update bid" button). */
  action?: React.ReactNode;
  /** Replaces the default hint row (e.g. "Not submitted"). */
  hint?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  /** Class for the number field (e.g. a max width next to an action button). */
  fieldClassName?: string;
}

/**
 * Numeric policy/condition input bound to a market `NumericInputSpec`: label with
 * a help tooltip, `NumberField` with the spec's prefix, unit, range, and step,
 * an optional slider, and a "Default …" hint that resets the field when modified.
 */
export function SpecField({
  id,
  label,
  spec,
  value,
  draft,
  onDraftChange,
  onCommit,
  onSubmit,
  modified,
  defaultLabel,
  onReset,
  slider = false,
  aside,
  action,
  hint,
  disabled,
  className,
  fieldClassName,
}: SpecFieldProps) {
  const shown = draft ? draft.value : value;
  const hintId = `${id}-hint`;

  const commit = (next: number | null) => {
    if (!onCommit) return;
    onDraftChange(null);
    if (next === null || !Number.isFinite(next)) return;
    const clamped = clampDisplay(spec, next);
    if (clamped !== value) onCommit(clamped);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    if (onCommit) {
      if (draft) commit(draft.value);
    } else {
      onSubmit?.();
    }
  };

  return (
    <div data-slot="spec-field" className={cn("flex min-w-0 flex-col", className)}>
      <div className="mb-1.5 flex min-h-5 items-center gap-1">
        <label htmlFor={id} className="text-caption font-medium text-muted-foreground">
          {label}
        </label>
        <InfoTooltip content={spec.hint} label={`About ${label.toLowerCase()}`} iconSize={12} />
        {modified ? (
          <span
            aria-hidden="true"
            title="Changed from default"
            className="ml-0.5 size-1.5 shrink-0 rounded-full bg-primary"
          />
        ) : null}
        {aside ? <span className="ml-auto truncate pl-2 text-caption text-muted-foreground">{aside}</span> : null}
      </div>
      <div className="flex min-w-0 items-center gap-2" onKeyDown={onKeyDown}>
        <NumberField
          id={id}
          value={shown}
          onValueChange={(next) => onDraftChange({ value: next })}
          onValueCommitted={onCommit ? (next) => commit(next) : undefined}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          largeStep={spec.step * 10}
          format={numberFormatOf(spec)}
          prefix={spec.prefix}
          suffix={spec.unit}
          disabled={disabled}
          aria-describedby={hintId}
          className={cn("min-w-0 flex-1", fieldClassName)}
        />
        {action}
      </div>
      {slider ? (
        <div className="mt-1 px-2">
          <Slider
            value={shown ?? value}
            onValueChange={(next) => onDraftChange({ value: next })}
            onValueCommitted={onCommit ? (next) => commit(next) : undefined}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            largeStep={spec.step * 10}
            disabled={disabled}
            aria-label={label}
            getAriaValueText={(formatted) =>
              spec.unit === "%" ? `${formatted}%` : `${spec.prefix ?? ""}${formatted} ${spec.unit}`
            }
          />
        </div>
      ) : null}
      <div
        id={hintId}
        className={cn("flex min-h-4 items-center gap-1 text-caption text-faint", slider ? "mt-0" : "mt-1.5")}
      >
        {hint ??
          (modified && onReset ? (
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              aria-label={`Reset ${label.toLowerCase()} to the default, ${defaultLabel}`}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-sm text-muted-foreground transition-colors duration-quick",
                "hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <RotateCcw aria-hidden="true" className="size-3" strokeWidth={2} />
              Default {defaultLabel}
            </button>
          ) : (
            <span>Default {defaultLabel}</span>
          ))}
      </div>
    </div>
  );
}
