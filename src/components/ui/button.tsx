import Link from "next/link";
import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button recipe copied from OpenRouter's design system: 14px/500 label, 6px radius,
 * 16px icons, subtle focus ring, and an enlarged hit area on coarse pointers.
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-md",
    "text-button font-medium no-underline select-none transition-colors duration-quick",
    "focus-visible:outline-none focus-visible:border-focus-border focus-visible:shadow-focus",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:-z-10",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-accent-hover hover:text-primary-foreground active:bg-primary/80",
        outline:
          "border border-input bg-background text-foreground hover:bg-muted hover:text-accent-foreground active:bg-muted/80",
        secondary:
          "bg-muted text-foreground hover:bg-accent-subtle hover:text-accent-foreground active:bg-accent-subtle/80",
        ghost:
          "text-muted-foreground hover:bg-accent-subtle hover:text-accent-foreground active:bg-accent-subtle/80",
        dashed:
          "border border-dashed border-border bg-transparent text-body font-normal text-muted-foreground hover:border-solid hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
        "destructive-outline":
          "border border-input bg-background text-negative-text hover:border-negative/30 hover:bg-negative-bg active:bg-negative-bg/80",
        link: "rounded-sm text-accent-foreground underline-offset-2 hover:underline",
      },
      size: {
        sm: "h-7 gap-1.5 px-2.5",
        md: "h-8 gap-1.5 px-3",
        lg: "h-9 gap-2 px-4",
        "icon-sm": "size-7 min-w-7 [&_svg]:size-3.5",
        icon: "size-8 min-w-8",
        "icon-lg": "size-9 min-w-9",
      },
    },
    compoundVariants: [
      { variant: "dashed", size: "md", className: "px-2.5" },
      { variant: "link", className: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {}

/** Native `<button>` styled with {@link buttonVariants}. Defaults to `type="button"`. */
export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export type ButtonLinkProps = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

/** `next/link` styled as a button. Same variants and sizes as {@link Button}. */
export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return (
    <Link
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
