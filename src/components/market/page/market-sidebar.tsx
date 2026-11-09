"use client";

import { Activity, CircleDollarSign, Radio, Route, Server, SlidersHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import {
  SidebarNav,
  SidebarNavMenu,
  useScrollSpy,
  type SidebarNavGroup,
  type SidebarNavItem,
} from "@/components/shell/sidebar-nav";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { focusSection, MARKET_SECTIONS, type MarketSectionId } from "@/components/market/market-ui";
import { MARKET_IDS, MARKETS, type MarketId, type ProviderIdentity } from "@/lib/tender";
import { cn } from "@/lib/utils";
import { MarketGlyph } from "./market-icon";
import { marketHref } from "./routes";

/** Section icons, shared with each section's header. */
export const SECTION_ICONS: Record<MarketSectionId, LucideIcon> = {
  live: Radio,
  providers: Server,
  routing: Route,
  conditions: SlidersHorizontal,
  payments: CircleDollarSign,
  activity: Activity,
};

const SECTION_IDS = MARKET_SECTIONS.map((section) => section.id);

/** A plain left click (no modifier keys), which the page handles in place. */
export function isPlainClick(event: React.MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export interface MarketSidebarProps {
  marketId: MarketId;
  /** Active provider of each market, shown next to the market name. */
  activeProviders: Partial<Record<MarketId, ProviderIdentity | null>>;
  onSwitchMarket: (marketId: MarketId) => void;
}

const STICKY =
  "sticky top-[calc(var(--navbar-height)+var(--sticky-bar-offset,0px)+24px)] transition-[top] duration-fast ease-smooth-out motion-reduce:transition-none";

/**
 * Left column (lg+): the two markets, then "On this page" with scroll-spy. The current market
 * gets a quiet style so only the current section carries the lime wash. Below lg, one
 * dropdown (`SidebarNavMenu`) holds both groups.
 */
export function MarketSidebar({ marketId, activeProviders, onSwitchMarket }: MarketSidebarProps) {
  const activeSection = useScrollSpy(SECTION_IDS);

  const sectionItems: SidebarNavItem[] = MARKET_SECTIONS.map((section) => {
    const Icon = SECTION_ICONS[section.id];
    return {
      id: section.id,
      label: section.label,
      href: `#${section.id}`,
      icon: <Icon aria-hidden />,
      active: activeSection === section.id,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        focusSection(section.id);
      },
    };
  });

  const marketItems: SidebarNavItem[] = MARKET_IDS.map((id) => ({
    id,
    label: MARKETS[id].name,
    href: marketHref(id),
    icon: <MarketGlyph icon={MARKETS[id].icon} />,
    active: id === marketId,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      onSwitchMarket(id);
    },
  }));

  const menuGroups: SidebarNavGroup[] = [
    { id: "markets", label: "Markets", items: marketItems },
    { id: "sections", label: "On this page", items: sectionItems },
  ];

  return (
    <>
      <aside className="hidden min-w-0 lg:block">
        <div className={cn("flex flex-col gap-5", STICKY)}>
          <nav aria-label="Markets" className="flex flex-col">
            <div className="px-2 pb-1 text-caption font-medium text-muted-foreground">Markets</div>
            <ul className="flex flex-col gap-y-px">
              {MARKET_IDS.map((id) => (
                <li key={id}>
                  <MarketNavLink
                    marketId={id}
                    current={id === marketId}
                    activeProvider={activeProviders[id] ?? null}
                    onSwitchMarket={onSwitchMarket}
                  />
                </li>
              ))}
            </ul>
          </nav>
          <SidebarNav
            sticky={false}
            aria-label="On this page"
            groups={[{ id: "sections", label: "On this page", items: sectionItems }]}
          />
        </div>
      </aside>
      <SidebarNavMenu groups={menuGroups} className="mb-2" />
    </>
  );
}

function MarketNavLink({
  marketId,
  current,
  activeProvider,
  onSwitchMarket,
}: {
  marketId: MarketId;
  current: boolean;
  activeProvider: ProviderIdentity | null;
  onSwitchMarket: (marketId: MarketId) => void;
}) {
  const market = MARKETS[marketId];
  return (
    <Link
      href={marketHref(marketId)}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onSwitchMarket(marketId);
      }}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-body font-medium no-underline transition-colors duration-quick focus-visible:shadow-focus focus-visible:outline-none",
        current
          ? "text-foreground before:absolute before:inset-y-1.5 before:-left-px before:w-0.5 before:rounded-full before:bg-primary-strong"
          : "text-muted-foreground hover:bg-card-hover hover:text-accent-foreground",
      )}
    >
      <MarketGlyph icon={market.icon} tinted={current} className="size-4 shrink-0 self-start mt-[3px]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{market.name}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-caption font-normal text-muted-foreground">
          {activeProvider ? (
            <>
              <ProviderLogo src={activeProvider.logo} name={activeProvider.name} size={16} className="size-3" />
              <span className="truncate">{activeProvider.name}</span>
            </>
          ) : (
            <span className="truncate text-negative-text">No eligible provider</span>
          )}
        </span>
      </span>
    </Link>
  );
}
