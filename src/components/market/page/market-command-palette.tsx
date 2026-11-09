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
import { format, MARKET_IDS, MARKETS, PREFERENCE_LABELS, type MarketId, type MarketView, type RoutingPreference } from "@/lib/tender";
import type { TenderActions } from "@/lib/tender/client";
import { afterDialogClose } from "./after-dialog-close";
import { MarketGlyph } from "./market-icon";
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

/** Palette groups for a market: markets, sections, actions, and providers (with logos). */
export function buildPaletteGroups({ view, actions, onSwitchMarket, onOpenApi, onSelectProvider }: PaletteContext): CommandPaletteGroup[] {
  const marketId = view.id;
  const pinned = view.policy.mode.kind === "pinned";
  // cmdk ranks items inside a group but keeps the group order, so groups are ordered for the
  // common queries (market, section, provider name), and descriptions stay short to avoid
  // fuzzy matches against long text.
  return [
    {
      heading: "Markets",
      items: MARKET_IDS.map((id) => ({
        id: `market:${id}`,
        label: MARKETS[id].name,
        description: id === marketId ? `${MARKETS[id].identifier} · Current` : MARKETS[id].identifier,
        icon: <MarketGlyph icon={MARKETS[id].icon} tinted={false} />,
        keywords: [MARKETS[id].shortName],
        onSelect: () => onSwitchMarket(id),
      })),
    },
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
  const groups = useMemo(
    () =>
      buildPaletteGroups({
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
  return <CommandPalette open={open} onOpenChange={onOpenChange} groups={groups} />;
}
