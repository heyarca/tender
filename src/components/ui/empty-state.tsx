import type * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** 16px icon in a small bordered tile. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** One muted line. */
  description?: React.ReactNode;
  /** Optional button below the text. */
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}
      {...props}
    >
      {icon ? (
        <div className="mb-3 flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground [&_svg]:size-4">
          {icon}
        </div>
      ) : null}
      <p className="text-body font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-0.5 max-w-sm text-caption leading-snug text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
