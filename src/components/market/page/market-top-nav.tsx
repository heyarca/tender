"use client";

import { Play } from "lucide-react";
import type * as React from "react";
import { useMemo } from "react";
import { TopNav, type TopNavLink } from "@/components/shell/top-nav";
import { Button } from "@/components/ui/button";
import { focusSection, MARKET_SECTIONS, type MarketSectionId } from "@/components/market/market-ui";
import type { MarketId } from "@/lib/tender";
import { marketHref } from "./routes";

/** Hash of the TopNav link that opens the API dialog. */
export const API_HASH = "#api";

const SECTION_IDS = new Set<string>(MARKET_SECTIONS.map((section) => section.id));

export function isSectionId(value: string): value is MarketSectionId {
  return SECTION_IDS.has(value);
}

/** TopNav links: the market itself, its sections, and the API dialog. */
export function topNavLinks(marketId: MarketId): TopNavLink[] {
  return [
    { label: "Markets", href: marketHref(marketId) },
    { label: "Providers", href: "#providers" },
    { label: "Routing", href: "#routing" },
    { label: "Payments", href: "#payments" },
    { label: "Activity", href: "#activity" },
    { label: "API", href: API_HASH },
  ];
}

export interface MarketTopNavProps {
  marketId: MarketId;
  onSearch: () => void;
  onOpenApi: () => void;
  onRun: () => void;
}

function scrollToTop() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/**
 * The shared `TopNav` wired to the market page. Section links scroll to the section and move
 * focus to its heading, "API" opens the API dialog, and "Markets" returns to the top of the
 * current market. Plain hrefs keep the links usable in a new tab.
 */
export function MarketTopNav({ marketId, onSearch, onOpenApi, onRun }: MarketTopNavProps) {
  const links = useMemo(() => topNavLinks(marketId), [marketId]);

  // TopNav renders next/link anchors without click hooks; intercept in the capture phase
  // (this also covers the mobile menu, whose portal still bubbles through React).
  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.("a[href]");
    const href = anchor?.getAttribute("href");
    if (!href) return;
    if (href === API_HASH) {
      event.preventDefault();
      onOpenApi();
    } else if (href.startsWith("#") && isSectionId(href.slice(1))) {
      event.preventDefault();
      focusSection(href.slice(1) as MarketSectionId);
    } else if (href === marketHref(marketId)) {
      event.preventDefault();
      scrollToTop();
    }
  };

  return (
    <div className="contents" onClickCapture={onClickCapture}>
      <TopNav
        links={links}
        activeHref={marketHref(marketId)}
        homeHref="/landing"
        onSearch={onSearch}
        searchLabel="Search"
        actions={
          <Button variant="primary" onClick={onRun} aria-keyshortcuts="Meta+Enter Control+Enter">
            <Play aria-hidden />
            <span className="max-sm:sr-only">Run request</span>
          </Button>
        }
      />
    </div>
  );
}
