"use client";

import { useEffect, useEffectEvent } from "react";
import { focusSection } from "@/components/market/market-ui";
import { toast } from "@/components/ui/toast";
import { getMarketSpec } from "@/lib/registry";
import { selectMarketViewFromState, type MarketId, type RouteEvent, type RouteEventKind } from "@/lib/tender";
import { useTenderActions, useTenderStore } from "@/lib/tender/client";
import { routeEventToast, type RouteToastAction } from "./route-toast-copy";

const ROUTE_EVENT_KINDS: readonly RouteEventKind[] = ["route-switch", "no-eligible", "pin-violation"];
const isRouteEvent = (entry: { kind: string; notify: boolean }): entry is RouteEvent =>
  entry.notify && (ROUTE_EVENT_KINDS as readonly string[]).includes(entry.kind);

/**
 * One toast per route event (switch, no eligible provider, pinned violation) in every market.
 * Events of the other market say which market they belong to and offer "View market".
 *
 * One store subscription for all markets: on each change it scans only the markets whose state
 * changed, and only their entries newer than the last seen activity sequence number.
 */
export function useRouteToasts(currentMarketId: MarketId, onViewMarket: (marketId: MarketId) => void): void {
  const store = useTenderStore();
  const actions = useTenderActions();

  const run = (marketId: MarketId, action: RouteToastAction) => {
    switch (action.kind) {
      case "switch-to-recommended":
        actions.switchToRecommended(marketId);
        break;
      case "use-automatic":
        actions.setRoutingMode(marketId, { kind: "auto" });
        break;
      case "edit-policy":
        focusSection("routing");
        break;
      case "view-market":
        onViewMarket(action.marketId);
        break;
    }
  };

  const onEvent = useEffectEvent((event: RouteEvent) => {
    const view = selectMarketViewFromState(store.api.getState(), event.marketId);
    const spec = routeEventToast(event, {
      marketName: getMarketSpec(event.marketId)?.name ?? view.definition.name,
      current: event.marketId === currentMarketId,
      recommendedProviderId: view.recommended?.id ?? null,
    });
    const action = spec.action;
    toast({
      id: spec.id,
      title: spec.title,
      description: spec.description,
      tone: spec.tone,
      action: action ? { label: action.label, onClick: () => run(event.marketId, action) } : undefined,
    });
  });

  useEffect(() => {
    let lastSeq = store.api.getState().nextActivitySeq - 1;
    return store.api.subscribe((state, prev) => {
      const seen = lastSeq;
      lastSeq = state.nextActivitySeq - 1;
      if (state.markets === prev.markets) return;
      const fresh: RouteEvent[] = [];
      for (const id of Object.keys(state.markets) as MarketId[]) {
        const market = state.markets[id];
        if (market === prev.markets[id]) continue;
        for (const entry of market.activity) {
          if (entry.seq <= seen) break;
          if (isRouteEvent(entry)) fresh.push(entry);
        }
      }
      fresh.sort((a, b) => a.seq - b.seq);
      for (const event of fresh) onEvent(event);
    });
  }, [store]);
}
