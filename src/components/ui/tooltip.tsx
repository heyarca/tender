"use client";

import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export const TOOLTIP_DELAY_MS = 200;

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/** White popup, 12px text. `shadow-popover` paints both the hairline edge and the drop shadow. */
export const tooltipPopupClassName = cn(
  "max-w-72 rounded-md bg-popover px-2 py-1.5 text-caption text-popover-foreground shadow-popover",
  "origin-(--transform-origin) transition-[opacity,scale] duration-quick ease-smooth-out",
  "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:opacity-0 data-instant:transition-none",
  "motion-reduce:transition-none",
);

export interface TooltipProviderProps {
  /** Open delay in ms. Defaults to 200. */
  delay?: number;
  closeDelay?: number;
  children: React.ReactNode;
}

/** Optional. Groups tooltips so that adjacent ones open instantly once one is visible. */
export function TooltipProvider({ delay = TOOLTIP_DELAY_MS, closeDelay = 0, children }: TooltipProviderProps) {
  return (
    <BaseTooltip.Provider delay={delay} closeDelay={closeDelay}>
      {children}
    </BaseTooltip.Provider>
  );
}

export interface TooltipProps {
  /** Tooltip body. `null`/`undefined` renders the trigger without a tooltip. */
  content: React.ReactNode;
  /**
   * The trigger. Must be a single element that accepts a ref and DOM props
   * (a native element or a component that spreads props). It gets hover and focus handlers.
   */
  children: React.ReactElement;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  /** Open delay in ms. Defaults to 200. */
  delay?: number;
  closeDelay?: number;
  disabled?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Class for the popup. */
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 6,
  delay = TOOLTIP_DELAY_MS,
  closeDelay = 0,
  disabled,
  open,
  defaultOpen,
  onOpenChange,
  className,
}: TooltipProps) {
  if (content === null || content === undefined || content === false) return children;
  return (
    <BaseTooltip.Root
      disabled={disabled}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}
    >
      <BaseTooltip.Trigger delay={delay} closeDelay={closeDelay} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50">
          <BaseTooltip.Popup data-slot="tooltip" className={cn(tooltipPopupClassName, className)}>
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

export interface InfoTooltipProps extends Omit<TooltipProps, "children"> {
  /** Accessible name for the trigger. Defaults to "More information". */
  label?: string;
  /** Class for the trigger. */
  triggerClassName?: string;
  /** Icon size in px. Defaults to 14. */
  iconSize?: 12 | 14 | 16;
}

const infoIconSize = { 12: "size-3", 14: "size-3.5", 16: "size-4" } as const;

/** Lucide `Info` icon that reveals a tooltip on hover or focus (OpenRouter's "(i)" affordance). */
export function InfoTooltip({ label = "More information", triggerClassName, iconSize = 14, ...props }: InfoTooltipProps) {
  return (
    <Tooltip {...props}>
      <button
        type="button"
        aria-label={label}
        data-slot="info-tooltip"
        className={cn(
          "inline-flex shrink-0 cursor-help items-center justify-center rounded-sm border-0 bg-transparent p-0 align-middle text-muted-foreground transition-colors duration-quick",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          triggerClassName,
        )}
      >
        <Info aria-hidden="true" className={infoIconSize[iconSize]} strokeWidth={2} />
      </button>
    </Tooltip>
  );
}
