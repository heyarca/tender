"use client";

import { Play, SquareTerminal } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { MARKET_IDS, MARKETS, type MarketDefinition, type MarketId } from "@/lib/tender";
import { cn } from "@/lib/utils";
import { MarketGlyph, MarketIconCircle } from "./market-icon";

/** Id of the title block. The sticky bar appears once it scrolls under the TopNav. */
export const MARKET_TITLE_ID = "market-title";

const SWITCHER_ITEMS = MARKET_IDS.map((id) => ({
  value: id,
  label: MARKETS[id].name,
  icon: <MarketGlyph icon={MARKETS[id].icon} />,
}));

export interface MarketSwitcherProps {
  marketId: MarketId;
  onSwitchMarket: (marketId: MarketId) => void;
  className?: string;
}

/** Segmented market switcher above the title. Each market keeps its own state. */
export function MarketSwitcher({ marketId, onSwitchMarket, className }: MarketSwitcherProps) {
  return (
    <SegmentedControl
      aria-label="Market"
      size="md"
      items={SWITCHER_ITEMS}
      value={marketId}
      onValueChange={onSwitchMarket}
      className={cn("max-sm:w-full", className)}
      itemClassName="max-sm:px-2"
    />
  );
}

/** `weather/san-francisco` with the first segment underlined, like OpenRouter's model slug. */
export function MarketIdentifier({ identifier }: { identifier: string }) {
  const slash = identifier.indexOf("/");
  const head = slash === -1 ? identifier : identifier.slice(0, slash);
  const tail = slash === -1 ? "" : identifier.slice(slash);
  return (
    <span className="truncate">
      <span className="text-foreground underline decoration-current/40 underline-offset-2">{head}</span>
      {tail}
    </span>
  );
}

export interface AutoRunSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/** Bordered "Auto-run" toggle that sits with the title actions. */
export function AutoRunSwitch({ checked, onCheckedChange, className }: AutoRunSwitchProps) {
  const id = useId();
  return (
    <Tooltip content="Runs one request every 2 s while on">
      <label
        htmlFor={id}
        className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-button font-medium text-foreground transition-colors duration-quick select-none hover:bg-muted",
          className,
        )}
      >
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
        Auto-run
      </label>
    </Tooltip>
  );
}

export interface MarketHeaderProps {
  definition: MarketDefinition;
  autoRun: boolean;
  onSwitchMarket: (marketId: MarketId) => void;
  onOpenApi: () => void;
  onAutoRunChange: (enabled: boolean) => void;
  onRun: () => void;
}

/**
 * Market switcher, then the OpenRouter model-page title row: icon, name, identifier with a copy
 * button, the contract, and the API / Auto-run / Run request actions, then the description.
 */
export function MarketHeader({ definition, autoRun, onSwitchMarket, onOpenApi, onAutoRunChange, onRun }: MarketHeaderProps) {
  return (
    <header>
      <MarketSwitcher marketId={definition.id} onSwitchMarket={onSwitchMarket} className="mb-4" />
      <div id={MARKET_TITLE_ID} className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <MarketIconCircle icon={definition.icon} />
            <h1 className="min-w-0 truncate">{definition.name}</h1>
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
            <MarketIdentifier identifier={definition.identifier} />
            <CopyButton value={definition.identifier} label="Copy market identifier" />
            <span aria-hidden className="text-faint max-sm:hidden">
              ·
            </span>
            <code className="truncate font-mono text-[12px] font-normal text-muted-foreground max-sm:hidden">
              {definition.contract}
            </code>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2 px-4" onClick={onOpenApi}>
            <SquareTerminal aria-hidden />
            API
          </Button>
          <AutoRunSwitch checked={autoRun} onCheckedChange={onAutoRunChange} />
          <Button variant="primary" className="gap-2 px-4" onClick={onRun} aria-keyshortcuts="Meta+Enter Control+Enter">
            <Play aria-hidden />
            Run request
          </Button>
        </div>
      </div>
      <p className="mt-3 text-body text-muted-foreground">{definition.description}</p>
    </header>
  );
}
