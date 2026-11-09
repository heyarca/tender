import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Small status tags, matching OpenRouter's tier tags ("Fast", "Flex") and discount text ("51% off").
 *
 * - `variant="soft"` (default): tinted background, 12px label.
 * - `variant="text"`: no background, 14px medium text in the tone color.
 */
export const badgeVariants = cva(
  "inline-flex shrink-0 items-center whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        soft: "gap-1 rounded-sm px-1.5 py-0.5 text-overline font-medium leading-none [&_svg]:size-3",
        outline:
          "gap-1 rounded-sm border px-1.5 py-px text-overline font-medium leading-none [&_svg]:size-3",
        text: "gap-1 text-xs font-medium [&_svg]:size-3.5",
      },
      tone: {
        neutral: "",
        active: "",
        positive: "",
        warning: "",
        negative: "",
        info: "",
        priority: "",
        flex: "",
        ultrafast: "",
      },
    },
    compoundVariants: [
      { variant: "soft", tone: "neutral", className: "bg-muted text-muted-foreground" },
      { variant: "soft", tone: "active", className: "bg-accent text-accent-foreground" },
      { variant: "soft", tone: "positive", className: "bg-positive-bg text-positive-text" },
      { variant: "soft", tone: "warning", className: "bg-warning-bg text-warning-text" },
      { variant: "soft", tone: "negative", className: "bg-negative-bg text-negative-text" },
      { variant: "soft", tone: "info", className: "bg-info-bg text-info-text" },
      { variant: "soft", tone: "priority", className: "bg-tier-priority-bg text-tier-priority" },
      { variant: "soft", tone: "flex", className: "bg-tier-flex-bg text-tier-flex" },
      { variant: "soft", tone: "ultrafast", className: "bg-tier-ultrafast-bg text-tier-ultrafast" },

      { variant: "outline", tone: "neutral", className: "border-border text-muted-foreground" },
      { variant: "outline", tone: "active", className: "border-primary-strong/40 text-accent-foreground" },
      { variant: "outline", tone: "positive", className: "border-positive/30 text-positive-text" },
      { variant: "outline", tone: "warning", className: "border-warning/30 text-warning-text" },
      { variant: "outline", tone: "negative", className: "border-negative/30 text-negative-text" },
      { variant: "outline", tone: "info", className: "border-info/30 text-info-text" },
      { variant: "outline", tone: "priority", className: "border-tier-priority/30 text-tier-priority" },
      { variant: "outline", tone: "flex", className: "border-tier-flex/30 text-tier-flex" },
      { variant: "outline", tone: "ultrafast", className: "border-tier-ultrafast/30 text-tier-ultrafast" },

      { variant: "text", tone: "neutral", className: "text-muted-foreground" },
      { variant: "text", tone: "active", className: "text-accent-foreground" },
      { variant: "text", tone: "positive", className: "text-positive-text" },
      { variant: "text", tone: "warning", className: "text-warning-text" },
      { variant: "text", tone: "negative", className: "text-negative-text" },
      { variant: "text", tone: "info", className: "text-info-text" },
      { variant: "text", tone: "priority", className: "text-tier-priority" },
      { variant: "text", tone: "flex", className: "text-tier-flex" },
      { variant: "text", tone: "ultrafast", className: "text-tier-ultrafast" },
    ],
    defaultVariants: {
      variant: "soft",
      tone: "neutral",
    },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends Omit<React.ComponentProps<"span">, "color">,
    VariantProps<typeof badgeVariants> {
  /** Leading 6px dot in the current text color. */
  dot?: boolean;
  /** Leading icon (rendered at 12px for soft/outline, 14px for text). */
  icon?: React.ReactNode;
}

export function Badge({
  className,
  variant,
  tone,
  dot = false,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, tone }), className)} {...props}>
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {icon}
      {children}
    </span>
  );
}

/** Alias kept for call sites that read better as a tag ("Fast", "Flex"). */
export const Tag = Badge;
export type TagProps = BadgeProps;

const statusDotVariants = cva("relative inline-flex shrink-0 rounded-full", {
  variants: {
    tone: {
      neutral: "bg-faint",
      active: "bg-primary-strong",
      positive: "bg-positive",
      warning: "bg-warning",
      negative: "bg-negative",
      info: "bg-info",
    },
    size: {
      sm: "size-1.5",
      md: "size-2",
    },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

export type StatusDotTone = NonNullable<VariantProps<typeof statusDotVariants>["tone"]>;

export interface StatusDotProps
  extends Omit<React.ComponentProps<"span">, "color">,
    VariantProps<typeof statusDotVariants> {
  /** Soft expanding ring, e.g. for the provider currently serving traffic. */
  pulse?: boolean;
  /** Accessible text. Without it the dot is decorative (`aria-hidden`). */
  label?: string;
}

export function StatusDot({ className, tone, size, pulse = false, label, ...props }: StatusDotProps) {
  return (
    <span
      data-slot="status-dot"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(statusDotVariants({ tone, size }), className)}
      {...props}
    >
      {pulse ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-inherit opacity-60 motion-safe:animate-ping motion-reduce:hidden"
        />
      ) : null}
    </span>
  );
}
