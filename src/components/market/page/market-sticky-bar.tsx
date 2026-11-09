"use client";

import { Play, SquareTerminal } from "lucide-react";
import { StickyBar, StickyBarActions, StickyBarTitle } from "@/components/shell/sticky-bar";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { focusSection } from "@/components/market/market-ui";
import type { MarketView } from "@/lib/tender";
import { cn } from "@/lib/utils";
import { MARKET_TITLE_ID } from "./market-header";
import { MarketGlyph } from "./market-icon";

/** Active provider chip: logo, name, and a status dot. Opens the providers table. */
export function ActiveProviderChip({ view, className }: { view: MarketView; className?: string }) {
  const active = view.route.activeProvider;
  const failing = active?.role === "pinned-failing";
  return (
    <button
      type="button"
      onClick={() => focusSection("providers")}
      aria-label={active ? `Active provider: ${active.name}${failing ? ", fails your policy" : ""}` : "No eligible provider"}
      className={cn(
        "inline-flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2 text-caption font-medium transition-colors duration-quick hover:bg-muted focus-visible:border-focus-border focus-visible:shadow-focus focus-visible:outline-none",
        className,
      )}
    >
      {active ? (
        <>
          <StatusDot tone={failing ? "negative" : "positive"} size="sm" />
          <ProviderLogo src={active.logo} name={active.name} size={16} />
          <span className="truncate text-foreground">{active.name}</span>
        </>
      ) : (
        <>
          <StatusDot tone="negative" size="sm" />
          <span className="truncate text-negative-text">No eligible provider</span>
        </>
      )}
    </button>
  );
}

/** Compact bar under the TopNav once the title scrolls away: market, active provider, Run request. */
export function MarketStickyBar({ view, onRun, onOpenApi }: { view: MarketView; onRun: () => void; onOpenApi: () => void }) {
  const { definition } = view;
  return (
    <StickyBar sentinelId={MARKET_TITLE_ID} aria-label={`${definition.name} summary`}>
      <div className="flex min-w-0 items-center gap-3">
        <StickyBarTitle icon={<MarketGlyph icon={definition.icon} />}>{definition.name}</StickyBarTitle>
        <ActiveProviderChip view={view} className="max-w-40 sm:max-w-none" />
      </div>
      <StickyBarActions>
        <Button variant="outline" className="gap-2 px-4 max-sm:hidden" onClick={onOpenApi}>
          <SquareTerminal aria-hidden />
          API
        </Button>
        <Button variant="primary" className="gap-2 px-4 max-sm:px-2.5" onClick={onRun}>
          <Play aria-hidden />
          <span className="max-sm:sr-only">Run request</span>
        </Button>
      </StickyBarActions>
    </StickyBar>
  );
}
