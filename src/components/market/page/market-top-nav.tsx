"use client";

import { Play } from "lucide-react";
import type * as React from "react";
import { useMemo } from "react";
import { BalanceChip } from "@/components/credits/balance-chip";
import { TopNav, type TopNavLink } from "@/components/shell/top-nav";
import { Button } from "@/components/ui/button";
import { focusSection, MARKET_SECTIONS, type MarketSectionId } from "@/components/market/market-ui";
import type { MarketId } from "@/lib/tender";

/** Hash of the TopNav link that opens the API dialog. */
export const API_HASH = "#api";

const SECTION_IDS = new Set<string>(MARKET_SECTIONS.map((section) => section.id));

export function isSectionId(value: string): value is MarketSectionId {
  return SECTION_IDS.has(value);
}

/** TopNav links: the API directory, this market's sections, provider payouts, and the API dialog. */
export function topNavLinks(marketId: MarketId): TopNavLink[] {
  return [
    { label: "Markets", href: "/markets" },
    { label: "Providers", href: "#providers" },
    { label: "Routing", href: "#routing" },
    { label: "Payments", href: "#payments" },
    { label: "Activity", href: "#activity" },
    { label: "Payouts", href: "/payouts" },
    { label: "API", href: API_HASH },
  ];
}

/** Left click without modifiers, so shortcut- or new-tab clicks keep following the href. */
function isPlainLeftClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export interface MarketTopNavProps {
  marketId: MarketId;
  onSearch: () => void;
  onOpenApi: () => void;
  onRun: () => void;
}

/**
 * The shared `TopNav` wired to the market page. Section links scroll to the section and move
 * focus to its heading, "API" opens the API dialog, and "Markets" opens the API directory.
 * Plain hrefs keep the links usable in a new tab.
 */
export function MarketTopNav({ marketId, onSearch, onOpenApi, onRun }: MarketTopNavProps) {
  const links = useMemo(
    () =>
      topNavLinks(marketId).map((link) => {
        if (link.href === API_HASH) {
          return {
            ...link,
            onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
              if (!isPlainLeftClick(event)) return;
              event.preventDefault();
              onOpenApi();
            },
          };
        }
        if (link.href.startsWith("#") && isSectionId(link.href.slice(1))) {
          const section = link.href.slice(1) as MarketSectionId;
          return {
            ...link,
            onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
              if (!isPlainLeftClick(event)) return;
              event.preventDefault();
              focusSection(section);
            },
          };
        }
        return link;
      }),
    [marketId, onOpenApi],
  );

  return (
    <TopNav
      links={links}
      homeHref="/landing"
      onSearch={onSearch}
      searchLabel="Search"
      actions={
        <>
          <BalanceChip />
          <Button variant="primary" onClick={onRun} aria-keyshortcuts="Meta+Enter Control+Enter">
            <Play aria-hidden />
            <span className="max-sm:sr-only">Run request</span>
          </Button>
        </>
      }
    />
  );
}
