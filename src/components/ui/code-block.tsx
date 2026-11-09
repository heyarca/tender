import type * as React from "react";

import { cn } from "@/lib/utils";

import { CopyButton } from "./copy-button";

export interface CodeBlockProps extends Omit<React.ComponentProps<"div">, "children" | "title"> {
  /** Source text. Also what the copy button writes. */
  code: string;
  /** Small label in the header, e.g. "TypeScript" or "cURL". */
  language?: React.ReactNode;
  /** Header title on the left (takes precedence over `language` placement). */
  title?: React.ReactNode;
  /** Show the copy button. Defaults to true. */
  copyable?: boolean;
  /** Soft-wrap long lines instead of scrolling horizontally. */
  wrap?: boolean;
  /** Custom rendering of the code (for example highlighted spans). Defaults to `code`. */
  children?: React.ReactNode;
  /** Class for the `<pre>`. */
  preClassName?: string;
}

/** Geist Mono on a muted surface, with a language label and a copy button. */
export function CodeBlock({
  code,
  language,
  title,
  copyable = true,
  wrap = false,
  children,
  className,
  preClassName,
  ...props
}: CodeBlockProps) {
  const hasHeader = Boolean(title || language || copyable);
  return (
    <div
      data-slot="code-block"
      className={cn("group/code relative min-w-0 rounded-md border border-border bg-muted", className)}
      {...props}
    >
      {hasHeader ? (
        <div className="flex h-10 items-center justify-between gap-2 pr-1.5 pl-4">
          <div className="flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
            {title ? <span className="truncate font-medium text-foreground">{title}</span> : null}
            {language ? <span className="truncate font-medium">{language}</span> : null}
          </div>
          {copyable ? (
            <CopyButton value={code} label="Copy code" variant="ghost" className="hover:bg-background" />
          ) : null}
        </div>
      ) : null}
      <pre
        className={cn(
          "overflow-x-auto px-4 pb-3.5 font-mono text-[13px] leading-relaxed text-foreground [scrollbar-width:thin]",
          hasHeader ? "pt-0" : "pt-3.5",
          wrap ? "break-words whitespace-pre-wrap" : "whitespace-pre",
          preClassName,
        )}
      >
        <code className="font-mono">{children ?? code}</code>
      </pre>
    </div>
  );
}
