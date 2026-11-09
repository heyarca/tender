"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { MarketPage } from "@/components/market/market-page";
import { isMarketId, MARKET_IDS, type MarketId } from "@/lib/tender";
import { marketHref } from "./routes";

/**
 * Client frame of `/markets/*`. Reads the market from the URL segment and switches markets
 * in place: the new market renders immediately, then the URL (and metadata) follow.
 * Back/forward navigation updates the segment, which wins again.
 */
export function MarketsFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const [state, setState] = useState(() => ({ segment, marketId: segment }));
  if (state.segment !== segment) setState({ segment, marketId: segment });

  const marketId = state.marketId;

  const switchMarket = useCallback(
    (next: MarketId) => {
      setState((current) => (current.marketId === next ? current : { ...current, marketId: next }));
      router.push(marketHref(next), { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    for (const id of MARKET_IDS) router.prefetch(marketHref(id));
  }, [router]);

  if (!isMarketId(marketId)) return children;
  return (
    <>
      <MarketPage marketId={marketId} onSwitchMarket={switchMarket} />
      {children}
    </>
  );
}
