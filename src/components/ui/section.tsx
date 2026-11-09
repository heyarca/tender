import type * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** Anchor id, also used by the sidebar scroll-spy. */
  id: string;
  /** 16px icon before the title (e.g. a lucide icon). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** One or two muted sentences under the title. */
  description?: React.ReactNode;
  /** Right side of the title row (buttons, segmented controls). */
  actions?: React.ReactNode;
  /** Wrap children in the bordered `rounded-lg border p-5` body. Defaults to true. */
  framed?: boolean;
  /** Class for the framed body. */
  bodyClassName?: string;
  /** Heading level. Defaults to `h2`. */
  as?: "h2" | "h3";
}

/**
 * Page section in OpenRouter's model-page style: icon + 16px medium title,
 * muted description, then a framed body (borderless on small screens).
 */
export function Section({
  id,
  icon,
  title,
  description,
  actions,
  framed = true,
  bodyClassName,
  as: Heading = "h2",
  className,
  children,
  ...props
}: SectionProps) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-slot="section"
      className={cn("mb-10 scroll-mt-28 last:mb-0", className)}
      {...props}
    >
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", description ? "mb-1.5" : "mb-4")}>
        <div className="flex min-w-0 items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
          {icon}
          <Heading id={headingId} className="text-base font-medium text-foreground">
            {title}
          </Heading>
        </div>
        {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? (
        <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {framed ? (
        <div
          data-slot="section-body"
          className={cn("rounded-lg border border-border p-0 max-md:border-0 md:p-5", bodyClassName)}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
