"use client";

import {
  ArrowDownWideNarrow,
  Clock,
  Play,
  RefreshCcw,
  Repeat,
  RotateCcw,
  SquareTerminal,
  Wand2,
  Zap,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { CommandPalette, type CommandPaletteGroup } from "@/components/shell/command-palette";
import { focusSection, MARKET_SECTIONS, useSelectedProvider } from "@/components/market/market-ui";
import { CATEGORIES, getGroup, listMarkets } from "@/lib/registry";
import { format, isMarketId, PREFERENCE_LABELS, type MarketId, type MarketView, type RoutingPreference } from "@/lib/tender";
import type { TenderActions } from "@/lib/tender/client";
import { afterDialogClose } from "./after-dialog-close";
import { marketIdentifier } from "../market-registry";
import { MarketGlyph, marketIconName } from "./market-icon";
import { SECTION_ICONS } from "./market-sidebar";

const PREFERENCE_ICONS: Record<RoutingPreference, ReactNode> = {
  "lowest-cost": <ArrowDownWideNarrow />,
  "lowest-latency": <Zap />,
  "freshest-data": <Clock />,
};

export interface PaletteContext {
  view: MarketView;
  actions: TenderActions;
  onSwitchMarket: (marketId: MarketId) => void;
  onOpenApi: () => void;
  onSelectProvider: (providerId: string) => void;
}

/**
 * Markets grouped by category (registry order), with the current market's category first.
 * Static registry data only: no store subscriptions.
 */
export function marketPaletteGroups(marketId: MarketId, onSwitchMarket: (marketId: MarketId) => void): CommandPaletteGroup[] {
  const groups = CATEGORIES.map((category) => ({
    categoryId: category.id,
    heading: category.label,
    items: listMarkets({ categoryId: category.id }).flatMap((market) => {
      const id = market.id;
      if (!isMarketId(id)) return [];
      const identifier = marketIdentifier(market);
      return [
        {
          id: `market:${id}`,
          label: market.name,
          description: id === marketId ? `${identifier} · Current` : identifier,
          icon: <MarketGlyph icon={marketIconName(id)} tinted={false} />,
          keywords: [market.shortName, category.label, getGroup(category.groupId)?.label ?? ""],
          onSelect: () => onSwitchMarket(id),
        },
      ];
    }),
  })).filter((group) => group.items.length > 0);
  const current = groups.findIndex((group) => group.items.some((item) => item.id === `market:${marketId}`));
  const ordered = current > 0 ? [groups[current], ...groups.slice(0, current), ...groups.slice(current + 1)] : groups;
  return ordered.map(({ heading, items }) => ({ heading, items }));
}

/** Palette groups for a market: the current category, sections, providers, actions, then every other category. */
export function buildPaletteGroups({ view, actions, onSwitchMarket, onOpenApi, onSelectProvider }: PaletteContext): CommandPaletteGroup[] {
  const [currentCategory, ...otherCategories] = marketPaletteGroups(view.id, onSwitchMarket);
  return [
    ...(currentCategory ? [currentCategory] : []),
    ...pageGroups({ view, actions, onSwitchMarket, onOpenApi, onSelectProvider }),
    ...otherCategories,
  ];
}

/** Sections, providers, and actions of the market on screen. */
export function pageGroups({ view, actions, onOpenApi, onSelectProvider }: PaletteContext): CommandPaletteGroup[] {
  const marketId = view.id;
  const pinned = view.policy.mode.kind === "pinned";
  // cmdk ranks items inside a group; the palette orders groups by their best match while searching.
  return [
    {
      heading: "On this page",
      items: MARKET_SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.id];
        return {
          id: `section:${section.id}`,
          label: section.label,
          icon: <Icon />,
          onSelect: () => afterDialogClose(() => focusSection(section.id)),
        };
      }),
    },
    {
      heading: "Providers",
      items: view.providers.map((row) => ({
        id: `provider:${row.id}`,
        label: row.name,
        description: `${row.isActive ? "Active" : row.statusLabel} · ${format.priceWithUnit(row.conditions.bidPrice)}`,
        image: row.logo,
        keywords: [row.id],
        onSelect: () => onSelectProvider(row.id),
      })),
    },
    {
      heading: "Actions",
      items: [
        {
          id: "action:run",
          label: "Run request",
          icon: <Play />,
          shortcut: ["⌘", "↵"],
          keywords: ["send"],
          onSelect: () => actions.runRequest(marketId),
        },
        {
          id: "action:auto-run",
          label: view.autoRun ? "Turn off Auto-run" : "Turn on Auto-run",
          description: "Every 2 s",
          icon: <Repeat />,
          onSelect: () => actions.setAutoRun(marketId, !view.autoRun),
        },
        ...(pinned
          ? [
              {
                id: "action:automatic",
                label: "Use automatic switching",
                icon: <Wand2 />,
                keywords: ["unpin"],
                onSelect: () => actions.setRoutingMode(marketId, { kind: "auto" }),
              },
            ]
          : []),
        ...(Object.keys(PREFERENCE_LABELS) as RoutingPreference[]).map((preference) => ({
          id: `action:preference:${preference}`,
          label: `Prefer ${PREFERENCE_LABELS[preference].toLowerCase()}`,
          description: view.policy.preference === preference ? "Current" : undefined,
          icon: PREFERENCE_ICONS[preference],
          keywords: [PREFERENCE_LABELS[preference]],
          onSelect: () => actions.setPolicy(marketId, { preference }),
        })),
        {
          id: "action:reset-conditions",
          label: "Reset conditions",
          icon: <RotateCcw />,
          keywords: ["restore"],
          onSelect: () => actions.resetConditions(marketId),
        },
        {
          id: "action:reset-policy",
          label: "Reset policy",
          icon: <RefreshCcw />,
          keywords: ["defaults"],
          onSelect: () => actions.resetPolicy(marketId),
        },
        {
          id: "action:api",
          label: "Open API",
          icon: <SquareTerminal />,
          keywords: ["curl", "code", "x402"],
          onSelect: onOpenApi,
        },
      ],
    },
  ];
}

export interface MarketCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: MarketView;
  actions: TenderActions;
  onSwitchMarket: (marketId: MarketId) => void;
  onOpenApi: () => void;
}

/** ⌘K palette of the market page. Choosing a provider opens it in Provider conditions. */
export function MarketCommandPalette({ open, onOpenChange, view, actions, onSwitchMarket, onOpenApi }: MarketCommandPaletteProps) {
  const [, selectProvider] = useSelectedProvider(view.id);
  const marketGroups = useMemo(() => marketPaletteGroups(view.id, onSwitchMarket), [view.id, onSwitchMarket]);
  const sectionGroups = useMemo(
    () =>
      pageGroups({
        view,
        actions,
        onSwitchMarket,
        onOpenApi,
        onSelectProvider: (providerId) => {
          selectProvider(providerId);
          afterDialogClose(() => focusSection("conditions"));
        },
      }),
    [view, actions, onSwitchMarket, onOpenApi, selectProvider],
  );
  const groups = useMemo(() => {
    const [currentCategory, ...otherCategories] = marketGroups;
    return [...(currentCategory ? [currentCategory] : []), ...sectionGroups, ...otherCategories];
  }, [marketGroups, sectionGroups]);
  return <CommandPalette open={open} onOpenChange={onOpenChange} groups={groups} />;
}
