import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const cardVariants = cva("min-w-0 rounded-lg border border-border bg-card text-card-foreground", {
  variants: {
    padding: {
      none: "",
      sm: "px-3 py-2.5",
      md: "p-4",
      lg: "p-5",
    },
  },
  defaultVariants: { padding: "md" },
});

export interface CardProps extends React.ComponentProps<"div">, VariantProps<typeof cardVariants> {}

/** White card with a hairline border and 8px radius. Default padding 16px (`padding="md"`). */
export function Card({ className, padding, ...props }: CardProps) {
  return <div data-slot="card" className={cn(cardVariants({ padding }), className)} {...props} />;
}

/** Title row: title on the left, optional actions on the right. */
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("mb-3 flex min-w-0 items-start justify-between gap-3", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("mt-0.5 text-caption leading-snug text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("mt-4 flex items-center gap-2 border-t border-border pt-3", className)}
      {...props}
    />
  );
}
