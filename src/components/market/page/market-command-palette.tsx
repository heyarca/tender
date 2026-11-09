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
  return [
    {
      heading: "Markets",
      items: MARKET_IDS.map((id) => ({
        id: `market:${id}`,
        label: MARKETS[id].name,
        description: MARKETS[id].identifier + (id === marketId ? " · Current" : ""),
        icon: <MarketGlyph icon={MARKETS[id].icon} tinted={false} />,
        keywords: [MARKETS[id].shortName, "market", "switch"],
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
          keywords: ["go to", "section"],
          onSelect: () => afterDialogClose(() => focusSection(section.id)),
        };
      }),
    },
    {
      heading: "Actions",
      items: [
        {
          id: "action:run",
          label: "Run request",
          description: view.route.activeProvider ? `via ${view.route.activeProvider.name}` : "No eligible provider",
          icon: <Play />,
          shortcut: ["⌘", "↵"],
          keywords: ["request", "send", "execute"],
          onSelect: () => actions.runRequest(marketId),
        },
        {
          id: "action:auto-run",
          label: view.autoRun ? "Turn off Auto-run" : "Turn on Auto-run",
          description: "One request every 2 s",
          icon: <Repeat />,
          keywords: ["auto", "run", "toggle"],
          onSelect: () => actions.setAutoRun(marketId, !view.autoRun),
        },
        ...(pinned
          ? [
              {
                id: "action:automatic",
                label: "Use automatic switching",
                description: "Unpin the provider",
                icon: <Wand2 />,
                keywords: ["auto", "unpin", "routing mode"],
                onSelect: () => actions.setRoutingMode(marketId, { kind: "auto" }),
              },
            ]
          : []),
        ...(Object.keys(PREFERENCE_LABELS) as RoutingPreference[]).map((preference) => ({
          id: `action:preference:${preference}`,
          label: `Prefer ${PREFERENCE_LABELS[preference].toLowerCase()}`,
          description: view.policy.preference === preference ? "Current preference" : "Routing preference",
          icon: PREFERENCE_ICONS[preference],
          keywords: [PREFERENCE_LABELS[preference], "preference", "routing", "policy"],
          onSelect: () => actions.setPolicy(marketId, { preference }),
        })),
        {
          id: "action:reset-conditions",
          label: "Reset conditions",
          description: "Every provider back to its default bid and performance",
          icon: <RotateCcw />,
          keywords: ["restore", "providers", "defaults"],
          onSelect: () => actions.resetConditions(marketId),
        },
        {
          id: "action:reset-policy",
          label: "Reset policy",
          description: "Default limits and automatic switching",
          icon: <RefreshCcw />,
          keywords: ["routing", "defaults", "limits"],
          onSelect: () => actions.resetPolicy(marketId),
        },
        {
          id: "action:api",
          label: "Open API",
          description: "cURL, TypeScript, and paid requests",
          icon: <SquareTerminal />,
          keywords: ["code", "curl", "snippet", "x402", "usdc"],
          onSelect: onOpenApi,
        },
      ],
    },
    {
      heading: "Providers",
      items: view.providers.map((row) => ({
        id: `provider:${row.id}`,
        label: row.name,
        description: `${row.isActive ? "Active" : row.statusLabel} · ${format.priceWithUnit(row.conditions.bidPrice)}`,
        image: row.logo,
        keywords: [row.id, row.statusLabel, "provider", "conditions", "bid"],
        onSelect: () => onSelectProvider(row.id),
      })),
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
