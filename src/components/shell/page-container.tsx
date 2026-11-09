import type * as React from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Default `main`. */
  as?: "main" | "div" | "section";
}

/** Centered page column: 1280px max, OpenRouter's page padding. */
export function PageContainer({ as: Component = "main", className, ...props }: PageContainerProps) {
  return (
    <Component
      className={cn("mx-auto w-full px-4 pt-6 pb-8 md:max-w-7xl lg:px-6", className)}
      {...props}
    />
  );
}
