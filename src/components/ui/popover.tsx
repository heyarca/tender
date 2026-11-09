"use client";

import type * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/** Root. Controlled with `open` / `onOpenChange`, or uncontrolled. */
export const Popover = BasePopover.Root;

export type PopoverTriggerProps = React.ComponentProps<typeof BasePopover.Trigger>;

/**
 * Renders a `<button>` by default. Pass `render={<Button variant="outline" />}`
 * (or any element) to reuse an existing button style.
 */
export function PopoverTrigger({ className, ...props }: PopoverTriggerProps) {
  return <BasePopover.Trigger data-slot="popover-trigger" className={className} {...props} />;
}

export const PopoverClose = BasePopover.Close;

export interface PopoverContentProps
  extends Omit<React.ComponentProps<typeof BasePopover.Popup>, "title" | "className"> {
  side?: Side;
  align?: Align;
  sideOffset?: number;
  alignOffset?: number;
  /** Heading slot (`Popover.Title`, 14px medium). */
  title?: React.ReactNode;
  /** Supporting text slot (`Popover.Description`, 12px muted). */
  description?: React.ReactNode;
  className?: string;
  /** Class for the positioner (z-index, width constraints). */
  positionerClassName?: string;
}

/** White popover surface, 12px padding. `shadow-popover` paints the hairline edge and the drop shadow. */
export function PopoverContent({
  side = "bottom",
  align = "start",
  sideOffset = 6,
  alignOffset = 0,
  title,
  description,
  className,
  positionerClassName,
  children,
  ...props
}: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className={cn("z-50", positionerClassName)}
      >
        <BasePopover.Popup
          data-slot="popover"
          className={cn(
            "w-72 max-w-(--available-width) rounded-lg bg-popover p-3 text-body text-popover-foreground shadow-popover outline-none",
            "origin-(--transform-origin) transition-[opacity,scale] duration-quick ease-smooth-out",
            "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:opacity-0",
            "motion-reduce:transition-none",
            className,
          )}
          {...props}
        >
          {title || description ? (
            <div className={cn("flex flex-col gap-0.5", children ? "mb-3" : undefined)}>
              {title ? <PopoverTitle>{title}</PopoverTitle> : null}
              {description ? <PopoverDescription>{description}</PopoverDescription> : null}
            </div>
          ) : null}
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type PopoverTitleProps = WithClassName<React.ComponentProps<typeof BasePopover.Title>>;

export function PopoverTitle({ className, ...props }: PopoverTitleProps) {
  return (
    <BasePopover.Title
      data-slot="popover-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

export type PopoverDescriptionProps = WithClassName<
  React.ComponentProps<typeof BasePopover.Description>
>;

export function PopoverDescription({ className, ...props }: PopoverDescriptionProps) {
  return (
    <BasePopover.Description
      data-slot="popover-description"
      className={cn("text-caption leading-snug text-muted-foreground", className)}
      {...props}
    />
  );
}
