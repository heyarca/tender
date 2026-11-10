"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { defaultRequestInputs, parseRequestInputs } from "@/lib/tender/request-inputs";
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
  { id: "credits", label: "Pay with credits" },
  { id: "payments", label: "Pay with USDC" },
  { id: "activity", label: "Activity" },
] as const;

export type MarketSectionId = (typeof MARKET_SECTIONS)[number]["id"];

/** Every market section component takes exactly these props and reads the store itself. */
export interface MarketSectionProps {
  marketId: MarketId;
}

interface MarketUiValue {
  requestInputs: Record<MarketId, Record<string, string>>;
  setRequestInput: (marketId: MarketId, key: string, value: string) => void;
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
  const [requestInputs, setInputs] = useState<MarketUiValue["requestInputs"]>({});
  const setRequestInput = useCallback((marketId: MarketId, key: string, value: string) => {
    setInputs((current) => ({ ...current, [marketId]: { ...(current[marketId] ?? defaultRequestInputs(marketId)), [key]: value } }));
  }, []);
  const value = useMemo(() => ({ selectedProviders, selectProvider, requestInputs, setRequestInput }), [selectedProviders, selectProvider, requestInputs, setRequestInput]);
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

/** Draft inputs shared by both explicit paid request methods. Never used as result provenance. */
export function useRequestInputs(marketId: MarketId) {
  const { requestInputs, setRequestInput } = useMarketUi();
  const values = requestInputs[marketId] ?? defaultRequestInputs(marketId);
  let error: string | null = null;
  let params: Record<string, string> = {};
  try { params = parseRequestInputs(marketId, values); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Check request inputs"; }
  return { values, params, error, setInput: (key: string, value: string) => setRequestInput(marketId, key, value) };
}

/** Smooth-scroll to a section and move keyboard focus to its heading. */
export function focusSection(id: MarketSectionId): void {
  if (typeof document === "undefined") return;
  const section = document.getElementById(id);
  if (!section) return;
  const reduce =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const heading = document.getElementById(`${id}-title`);
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}
