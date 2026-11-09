"use client";

import { focusSection } from "@/components/market/market-ui";
import { toast } from "@/components/ui/toast";
import { getMarketDefinition, selectMarketViewFromState, type MarketId, type RouteEvent } from "@/lib/tender";
import { useRouteEvents, useTenderActions, useTenderStore } from "@/lib/tender/client";
import { routeEventToast, type RouteToastAction } from "./route-toast-copy";

/**
 * One toast per route event (switch, no eligible provider, pinned violation) in every market.
 * Events of the other market say which market they belong to and offer "View market".
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

  const onEvent = (event: RouteEvent) => {
    const view = selectMarketViewFromState(store.api.getState(), event.marketId);
    const spec = routeEventToast(event, {
      marketName: getMarketDefinition(event.marketId).name,
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
  };

  useRouteEvents("sf-weather", onEvent);
  useRouteEvents("btc-usd", onEvent);
}
