"use client";

import type * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { ProviderLogo } from "./provider-logo";

export interface SelectOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Plain-text label for typeahead and screen readers when `label` is not a string. */
  textValue?: string;
  /** Leading image URL, rendered in a 16px logo box (for example a provider logo). */
  image?: string;
  /** Leading icon, used when there is no `image`. */
  icon?: React.ReactNode;
  /** Muted secondary text shown in the list only. */
  description?: React.ReactNode;
  disabled?: boolean;
}

export type SelectSize = "sm" | "md";

export interface SelectProps<T extends string = string> {
  items: readonly SelectOption<T>[];
  value: T | null;
  onValueChange: (value: T) => void;
  placeholder?: string;
  /** `sm`: 28px trigger. `md` (default): 32px trigger, like OpenRouter's "Standard" select. */
  size?: SelectSize;
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Popup alignment relative to the trigger. */
  align?: "start" | "center" | "end";
  /** Class for the trigger. */
  className?: string;
  /** Class for the popup. */
  popupClassName?: string;
}

const triggerSize: Record<SelectSize, string> = {
  sm: "h-7 gap-1.5 px-2.5",
  md: "h-8 gap-2 px-3",
};

function textOf<T extends string>(item: SelectOption<T>): string {
  if (item.textValue) return item.textValue;
  return typeof item.label === "string" ? item.label : String(item.value);
}

function OptionLeading<T extends string>({ item }: { item: SelectOption<T> }) {
  if (item.image) return <ProviderLogo src={item.image} name={textOf(item)} size={16} />;
  if (item.icon) return <span className="flex shrink-0 text-muted-foreground [&_svg]:size-4">{item.icon}</span>;
  return null;
}

/**
 * Single-value select built on Base UI Select. The popup opens below the trigger
 * and lists options with an optional leading logo or icon.
 */
export function Select<T extends string = string>({
  items,
  value,
  onValueChange,
  placeholder = "Select",
  size = "md",
  disabled,
  id,
  name,
  align = "start",
  className,
  popupClassName,
  ...aria
}: SelectProps<T>) {
  const byValue = new Map(items.map((item) => [item.value, item] as const));

  return (
    <BaseSelect.Root<T>
      id={id}
      name={name}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      itemToStringLabel={(v) => {
        const item = byValue.get(v);
        return item ? textOf(item) : String(v);
      }}
    >
      <BaseSelect.Trigger
        data-slot="select-trigger"
        className={cn(
          "flex min-w-0 cursor-pointer items-center justify-between rounded-md border border-input bg-input-bg text-body text-foreground",
          "transition-colors duration-quick hover:bg-muted/30 data-popup-open:bg-muted/30",
          "focus-visible:outline-none focus-visible:border-focus-border focus-visible:shadow-focus",
          "data-placeholder:text-muted-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50",
          triggerSize[size],
          className,
        )}
        {...aria}
      >
        <BaseSelect.Value className="flex min-w-0 items-center gap-2 truncate text-left">
          {(current: T | null) => {
            const item = current === null ? undefined : byValue.get(current);
            if (!item) return placeholder;
            return (
              <>
                <OptionLeading item={item} />
                <span className="truncate">{item.label}</span>
              </>
            );
          }}
        </BaseSelect.Value>
        <BaseSelect.Icon className="ml-1 flex shrink-0 opacity-50 transition-transform duration-quick data-popup-open:rotate-180">
          <ChevronDown aria-hidden="true" className="size-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          alignItemWithTrigger={false}
          side="bottom"
          align={align}
          sideOffset={4}
          className="z-50 outline-none select-none"
        >
          <BaseSelect.Popup
            data-slot="select-popup"
            className={cn(
              "min-w-(--anchor-width) rounded-md bg-popover text-popover-foreground shadow-popover outline-none",
              "origin-(--transform-origin) transition-[opacity,scale] duration-quick ease-smooth-out",
              "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:opacity-0",
              "motion-reduce:transition-none",
              popupClassName,
            )}
          >
            <BaseSelect.List className="max-h-[min(var(--available-height),20rem)] scroll-py-1 overflow-y-auto p-1">
              {items.map((item) => (
                <BaseSelect.Item
                  key={item.value}
                  value={item.value}
                  label={textOf(item)}
                  disabled={item.disabled}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-body text-foreground outline-none select-none",
                    "data-highlighted:bg-muted data-selected:font-medium",
                    "data-disabled:pointer-events-none data-disabled:opacity-50",
                  )}
                >
                  <OptionLeading item={item} />
                  <span className="flex min-w-0 flex-col">
                    <BaseSelect.ItemText className="truncate">{item.label}</BaseSelect.ItemText>
                    {item.description ? (
                      <span className="truncate text-caption font-normal text-muted-foreground">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                  <BaseSelect.ItemIndicator className="absolute right-2 flex text-accent-foreground">
                    <Check aria-hidden="true" className="size-4" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
