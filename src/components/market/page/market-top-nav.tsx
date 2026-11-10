"use client";

import { Play } from "lucide-react";
import type * as React from "react";
import { useMemo } from "react";
import { BalanceChip } from "@/components/credits/balance-chip";
import { TopNav, type TopNavLink } from "@/components/shell/top-nav";
import { Button } from "@/components/ui/button";

/** Hash of the TopNav link that opens the API dialog. */
export const API_HASH = "#api";

/** TopNav links: the product pages and the API dialog. The sidebar lists this market's sections. */
export function topNavLinks(): TopNavLink[] {
  return [
    { label: "Markets", href: "/markets" },
    { label: "Leaderboard", href: "/leaderboard" },
    { label: "Payouts", href: "/payouts" },
    { label: "Account", href: "/account" },
    { label: "API", href: API_HASH },
  ];
}

/** Left click without modifiers, so shortcut- or new-tab clicks keep following the href. */
function isPlainLeftClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export interface MarketTopNavProps {
  onSearch: () => void;
  onOpenApi: () => void;
  onRun: () => void;
  runLabel?: string;
}

/**
 * The shared `TopNav` wired to the market page. "API" opens the API dialog; the other links are
 * ordinary pages. Plain hrefs keep the links usable in a new tab.
 */
export function MarketTopNav({ onSearch, onOpenApi, onRun, runLabel = "Run request" }: MarketTopNavProps) {
  const links = useMemo(
    () =>
      topNavLinks().map((link) => {
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
        return link;
      }),
    [onOpenApi],
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
            <span className="max-sm:sr-only">{runLabel}</span>
          </Button>
        </>
      }
    />
  );
}
