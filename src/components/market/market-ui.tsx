"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MarketId, ProviderId } from "@/lib/tender";

/**
 * Page sections, in display order. Every section component renders
 * `<Section id={id}>` with one of these ids so the sidebar scroll-spy,
 * the command palette, and `focusSection` can find it.
 */
export const MARKET_SECTIONS = [
  { id: "providers", label: "Providers" },
  { id: "routing", label: "Routing policy" },
  { id: "conditions", label: "Provider conditions" },
  { id: "payments", label: "Pay with USDC" },
  { id: "activity", label: "Activity" },
] as const;

export type MarketSectionId = (typeof MARKET_SECTIONS)[number]["id"];

/** Every market section component takes exactly these props and reads the store itself. */
export interface MarketSectionProps {
  marketId: MarketId;
}

interface MarketUiValue {
  selectedProviders: Partial<Record<MarketId, ProviderId | null>>;
  selectProvider: (marketId: MarketId, providerId: ProviderId | null) => void;
}

const MarketUiContext = createContext<MarketUiValue | null>(null);

/**
 * Cross-section UI state that is not product state (product state lives in the
 * Tender store). Mounted once by the market page.
 */
export function MarketUiProvider({ children }: { children: ReactNode }) {
  const [selectedProviders, setSelected] = useState<MarketUiValue["selectedProviders"]>({});
  const selectProvider = useCallback((marketId: MarketId, providerId: ProviderId | null) => {
    setSelected((current) =>
      current[marketId] === providerId ? current : { ...current, [marketId]: providerId },
    );
  }, []);
  const value = useMemo(() => ({ selectedProviders, selectProvider }), [selectedProviders, selectProvider]);
  return <MarketUiContext.Provider value={value}>{children}</MarketUiContext.Provider>;
}

function useMarketUi(): MarketUiValue {
  const value = useContext(MarketUiContext);
  if (!value) throw new Error("useSelectedProvider must be used inside <MarketUiProvider>");
  return value;
}

/**
 * The provider the user is inspecting in this market (e.g. a clicked table row).
 * `null` means "none chosen": the conditions panel then shows the active provider.
 */
export function useSelectedProvider(
  marketId: MarketId,
): [ProviderId | null, (providerId: ProviderId | null) => void] {
  const { selectedProviders, selectProvider } = useMarketUi();
  const select = useCallback((providerId: ProviderId | null) => selectProvider(marketId, providerId), [marketId, selectProvider]);
  return [selectedProviders[marketId] ?? null, select];
}

/** Smooth-scroll to a section and move keyboard focus to its heading. */
export function focusSection(id: MarketSectionId): void {
  if (typeof document === "undefined") return;
  const section = document.getElementById(id);
  if (!section) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const heading = document.getElementById(`${id}-title`);
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}
