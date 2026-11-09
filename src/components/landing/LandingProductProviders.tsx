"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { MarketUiProvider } from "@/components/market/market-ui";
import type { MarketId } from "@/lib/tender";

type MarketSelection = readonly [MarketId, (marketId: MarketId) => void];

const LandingMarketContext = createContext<MarketSelection | null>(null);

/**
 * Landing wrapper for the embedded product sections. The root layout already mounts the
 * shared Tender store, tooltips, and toasts; this adds the market page's UI state and the
 * market that the embedded product shows.
 */
export function LandingProductProviders({ children }: { children: ReactNode }) {
  const [marketId, setMarketId] = useState<MarketId>("btc-usd");
  return (
    <MarketUiProvider>
      <LandingMarketContext.Provider value={[marketId, setMarketId]}>{children}</LandingMarketContext.Provider>
    </MarketUiProvider>
  );
}

export function useLandingMarket(): MarketSelection {
  const selection = useContext(LandingMarketContext);
  if (!selection) throw new Error("useLandingMarket must be used inside <LandingProductProviders>");
  return selection;
}
