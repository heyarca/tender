"use client";

import { Bot, Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const COMMAND = "npx @heyarca/tender@latest";

/** Banner above the market directory: let an agent move API integrations to Tender. */
export function AgentInstallBanner() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      aria-labelledby="agent-install-title"
      className="mb-6 grid grid-cols-1 items-center gap-4 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-8 lg:p-5"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary-border bg-primary text-primary-foreground"
        >
          <Bot className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 id="agent-install-title" className="text-base font-medium text-foreground">
            Let your agent buy and sell API access.
          </h2>
          <p className="mt-0.5 text-body text-muted-foreground">Let your agent move your API integrations to Tender.</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex h-11 items-center justify-between gap-3 rounded-lg bg-foreground pr-1.5 pl-4 text-background">
          <code className="truncate font-mono text-[14px]">
            <span aria-hidden="true" className="mr-2.5 text-background/50">
              $
            </span>
            {COMMAND}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Command copied" : "Copy command"}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition-[background-color,transform] duration-quick hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground focus-visible:outline-none active:scale-95"
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          </button>
          <span className="sr-only" aria-live="polite">
            {copied ? "Copied" : ""}
          </span>
        </div>
        <p className="pl-1 text-caption text-muted-foreground">Run in your project directory.</p>
      </div>
    </section>
  );
}
