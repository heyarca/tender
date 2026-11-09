"use client";

import { Activity, CircleDollarSign, Route, Server, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type * as React from "react";
import {
  SidebarNav,
  SidebarNavMenu,
  useScrollSpy,
  type SidebarNavGroup,
  type SidebarNavItem,
} from "@/components/shell/sidebar-nav";
import { focusSection, MARKET_SECTIONS, type MarketSectionId } from "@/components/market/market-ui";
import type { MarketId } from "@/lib/tender";
import { cn } from "@/lib/utils";

/** Section icons, shared with each section's header. */
export const SECTION_ICONS: Record<MarketSectionId, LucideIcon> = {
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
  onSwitchMarket: (marketId: MarketId) => void;
}

const STICKY =
  "sticky top-[calc(var(--navbar-height)+var(--sticky-bar-offset,0px)+24px)] transition-[top] duration-fast ease-smooth-out motion-reduce:transition-none";

/**
 * Left column (lg+): "On this page" with scroll-spy, so only the current section carries the
 * lime wash. Below lg, one dropdown (`SidebarNavMenu`) holds the same group.
 */
export function MarketSidebar({}: MarketSidebarProps) {
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

  const menuGroups: SidebarNavGroup[] = [{ id: "sections", label: "On this page", items: sectionItems }];

  return (
    <>
      <aside className="hidden min-w-0 lg:block">
        <div className={cn("flex flex-col gap-5", STICKY)}>
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
