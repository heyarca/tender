"use client";

import { Play, SquareTerminal } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { breadcrumbFor, contractCall, getMarketSpec, type MarketImage } from "@/lib/registry";
import { MARKET_IDS, type MarketId } from "@/lib/tender";
import { cn } from "@/lib/utils";
import { marketIdentifier } from "../market-registry";
import { MarketGlyph, MarketIconCircle, marketIconName } from "./market-icon";
import { categoryHref, groupHref } from "./routes";

/** Id of the title block. The sticky bar appears once it scrolls under the TopNav. */
export const MARKET_TITLE_ID = "market-title";

function switcherItems(ids: readonly MarketId[]) {
  return ids.map((id) => ({
    value: id,
    label: getMarketSpec(id)?.name ?? id,
    icon: <MarketGlyph icon={marketIconName(id)} />,
  }));
}

export interface MarketSwitcherProps {
  marketId: MarketId;
  onSwitchMarket: (marketId: MarketId) => void;
  className?: string;
  /** Markets to show. Default every market; a caller with limited width should pass a short list. */
  marketIds?: readonly MarketId[];
}

/** Segmented market switcher above the title. Each market keeps its own state. */
export function MarketSwitcher({ marketId, onSwitchMarket, className, marketIds = MARKET_IDS }: MarketSwitcherProps) {
  return (
    <SegmentedControl
      aria-label="Market"
      size="md"
      items={switcherItems(marketIds)}
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

const CRUMB_LINK =
  "truncate text-muted-foreground no-underline transition-colors duration-quick hover:text-accent-foreground focus-visible:rounded-sm focus-visible:shadow-focus focus-visible:outline-none";

/** `Markets / Group / Category` above the title, like OpenRouter's model breadcrumb. */
export function MarketBreadcrumb({ marketId, className }: { marketId: string; className?: string }) {
  const crumb = breadcrumbFor(marketId);
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0 text-caption", className)}>
      <ol className="flex min-w-0 items-center gap-1.5">
        <li className="shrink-0">
          <Link href="/markets" className={CRUMB_LINK}>
            Markets
          </Link>
        </li>
        {crumb ? (
          <>
            <li aria-hidden className="shrink-0 text-faint">
              /
            </li>
            <li className="min-w-0 truncate">
              <Link href={groupHref(crumb.group.id)} className={CRUMB_LINK}>
                {crumb.group.label}
              </Link>
            </li>
            <li aria-hidden className="shrink-0 text-faint">
              /
            </li>
            <li className="min-w-0 truncate">
              <Link href={categoryHref(crumb.category.id)} className={CRUMB_LINK}>
                {crumb.category.label}
              </Link>
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}

/** Small rounded market image beside the title. */
export function MarketThumbnail({ image, size = 40, className }: { image: MarketImage; size?: number; className?: string }) {
  return (
    <picture
      className={cn("block shrink-0 overflow-hidden rounded-md border border-border bg-muted", className)}
      style={{ width: size, height: size }}
    >
      {image.avif ? <source srcSet={image.avif} type="image/avif" /> : null}
      <img src={image.src} alt={image.alt} width={size} height={size} className="size-full object-cover" />
    </picture>
  );
}

export interface MarketTitleProps {
  marketId: string;
  /** Title block id (the sticky bar watches it). */
  id?: string;
  /** Actions on the right (API, Auto-run, Run request). */
  actions?: React.ReactNode;
}

/**
 * Breadcrumb, then the title row: image, category icon, name, identifier with a copy button, and
 * the contract call, then the description. Reads the registry only.
 */
export function MarketTitle({ marketId, id = MARKET_TITLE_ID, actions }: MarketTitleProps) {
  const spec = getMarketSpec(marketId);
  if (!spec) return null;
  const identifier = marketIdentifier(spec);
  const call = contractCall(spec);
  return (
    <header>
      <MarketBreadcrumb marketId={marketId} className="mb-3" />
      <div id={id} className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {spec.image ? <MarketThumbnail image={spec.image} /> : null}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <MarketIconCircle icon={marketIconName(marketId)} className="size-6" />
              <h1 className="min-w-0 truncate">{spec.name}</h1>
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
              <MarketIdentifier identifier={identifier} />
              <CopyButton value={identifier} label="Copy market identifier" />
              <span aria-hidden className="text-faint max-sm:hidden">
                ·
              </span>
              <code className="max-w-full min-w-0 truncate font-mono text-[12px] font-normal text-muted-foreground" title={call}>
                {call}
              </code>
            </div>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <p className="mt-3 text-body text-muted-foreground">{spec.description}</p>
    </header>
  );
}

export interface MarketHeaderProps {
  marketId: MarketId;
  autoRun: boolean;
  onOpenApi: () => void;
  onAutoRunChange: (enabled: boolean) => void;
  onRun: () => void;
}

/** The market title (registry) with the API / Auto-run / Run request actions. */
export function MarketHeader({ marketId, autoRun, onOpenApi, onAutoRunChange, onRun }: MarketHeaderProps) {
  return (
    <MarketTitle
      marketId={marketId}
      actions={
        <>
          <Button variant="outline" className="gap-2 px-4" onClick={onOpenApi}>
            <SquareTerminal aria-hidden />
            API
          </Button>
          <AutoRunSwitch checked={autoRun} onCheckedChange={onAutoRunChange} />
          <Button variant="primary" className="gap-2 px-4" onClick={onRun} aria-keyshortcuts="Meta+Enter Control+Enter">
            <Play aria-hidden />
            Run request
          </Button>
        </>
      }
    />
  );
}
