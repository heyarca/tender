"use client";

import * as React from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

export interface SegmentedControlItem<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Leading icon (rendered at 14px for `sm`, 16px for `md`). */
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Accessible name when `label` is visual only (for example an icon). */
  "aria-label"?: string;
  title?: string;
}

export type SegmentedControlSize = "sm" | "md";

export interface SegmentedControlProps<T extends string = string> {
  items: readonly SegmentedControlItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** `sm`: 24px items, 12px labels (OpenRouter's P50 / P75 switch). `md`: 32px items, 14px labels. */
  size?: SegmentedControlSize;
  /** Stretch to the container width with equal-width items. */
  fullWidth?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  itemClassName?: string;
}

const itemSize: Record<SegmentedControlSize, string> = {
  sm: "h-6 gap-1.5 px-2 text-overline [&_svg]:size-3.5",
  md: "h-8 gap-2 px-3 text-body [&_svg]:size-4",
};

/**
 * Radio group rendered as a segmented control, with a sliding indicator
 * (250 ms, ease-in-out-strong). Arrow keys move and select, like native radios.
 *
 * Server render and first paint style the checked item directly; after mount the
 * indicator is measured and takes over, so there is no layout jump or hydration mismatch.
 */
export function SegmentedControl<T extends string = string>({
  items,
  value,
  onValueChange,
  size = "sm",
  fullWidth = false,
  disabled = false,
  name,
  id,
  className,
  itemClassName,
  ...aria
}: SegmentedControlProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const indicatorRef = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    const indicator = indicatorRef.current;
    if (!root || !indicator) return;

    const measure = () => {
      const active = root.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
      if (!active) {
        delete indicator.dataset.ready;
        return;
      }
      // Fractional geometry (offset* rounds to whole pixels), relative to the padding box.
      const rootRect = root.getBoundingClientRect();
      const rect = active.getBoundingClientRect();
      root.style.setProperty("--seg-left", `${rect.left - rootRect.left - root.clientLeft}px`);
      root.style.setProperty("--seg-top", `${rect.top - rootRect.top - root.clientTop}px`);
      root.style.setProperty("--seg-width", `${rect.width}px`);
      root.style.setProperty("--seg-height", `${rect.height}px`);
      indicator.dataset.ready = "";
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    for (const radio of root.querySelectorAll('[role="radio"]')) observer.observe(radio);
    return () => observer.disconnect();
  }, [value, items, size]);

  return (
    <RadioGroup
      ref={rootRef}
      id={id}
      name={name}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as T)}
      data-slot="segmented-control"
      data-size={size}
      className={cn(
        "relative items-center gap-0.5 rounded-md border border-border bg-muted p-0.5",
        fullWidth ? "flex w-full" : "inline-flex",
        disabled && "opacity-50",
        className,
      )}
      {...aria}
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        data-segmented-indicator=""
        className={cn(
          "pointer-events-none absolute top-(--seg-top) left-0 h-(--seg-height) w-(--seg-width) translate-x-(--seg-left)",
          "rounded-sm bg-background shadow-sm",
          "transition-[translate,width] duration-fast ease-in-out-strong motion-reduce:transition-none",
          "[&:not([data-ready])]:hidden",
        )}
      />
      {items.map((item) => (
        <Radio.Root
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          nativeButton
          render={<button type="button" />}
          aria-label={item["aria-label"]}
          title={item.title}
          className={cn(
            "relative flex flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-sm font-medium",
            "text-muted-foreground transition-colors duration-quick hover:text-accent-foreground",
            "data-checked:bg-background data-checked:text-accent-foreground data-checked:shadow-sm",
            // Once the sliding indicator is measured, it paints the checked state instead.
            "[[data-segmented-indicator][data-ready]~&]:bg-transparent [[data-segmented-indicator][data-ready]~&]:shadow-none",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "data-disabled:pointer-events-none data-disabled:opacity-50",
            "[&_svg]:pointer-events-none [&_svg]:shrink-0",
            itemSize[size],
            itemClassName,
          )}
        >
          {item.icon}
          {item.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
