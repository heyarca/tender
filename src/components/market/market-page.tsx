"use client";

import { useCallback, useState } from "react";
import { ActivitySection } from "@/components/market/activity/activity-section";
import { ProviderConditionsSection } from "@/components/market/conditions/provider-conditions-section";
import { MarketUiProvider } from "@/components/market/market-ui";
import { ApiDialog } from "@/components/market/page/api-dialog";
import { MarketCommandPalette } from "@/components/market/page/market-command-palette";
import { MarketHeader } from "@/components/market/page/market-header";
import { MarketOverview } from "@/components/market/page/market-overview";
import { MarketSidebar } from "@/components/market/page/market-sidebar";
import { MarketStickyBar } from "@/components/market/page/market-sticky-bar";
import { MarketTopNav } from "@/components/market/page/market-top-nav";
import { useRouteToasts } from "@/components/market/page/use-route-toasts";
import { PaymentsSection } from "@/components/market/payments/payments-section";
import { RoutingPolicySection } from "@/components/market/policy/routing-policy-section";
import { ProvidersSection } from "@/components/market/providers/providers-section";
import { useHotkey } from "@/components/shell/command-palette";
import { PageContainer } from "@/components/shell/page-container";
import type { MarketId } from "@/lib/tender";
import { useMarketView, useTenderActions } from "@/lib/tender/client";

export interface MarketPageProps {
  marketId: MarketId;
  /** Switches the market in place (the URL follows). */
  onSwitchMarket: (marketId: MarketId) => void;
}

/**
 * The market page: TopNav, title row and overview, sticky bar, sidebar, the five sections,
 * the command palette, the API dialog, and route-event toasts. Product state lives in the
 * Tender store, so each market keeps its requests, activity, and edits across switches.
 */
export function MarketPage({ marketId, onSwitchMarket }: MarketPageProps) {
  return (
    <MarketUiProvider>
      <MarketPageContent marketId={marketId} onSwitchMarket={onSwitchMarket} />
    </MarketUiProvider>
  );
}

function MarketPageContent({ marketId, onSwitchMarket }: MarketPageProps) {
  const view = useMarketView(marketId);
  const actions = useTenderActions();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);

  const run = useCallback(() => actions.runRequest(marketId), [actions, marketId]);
  const openApi = useCallback(() => setApiOpen(true), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);

  useRouteToasts(marketId, onSwitchMarket);
  useHotkey("mod+enter", run);

  return (
    <>
      <MarketTopNav marketId={marketId} onSearch={openPalette} onOpenApi={openApi} onRun={run} />
      <MarketStickyBar view={view} onRun={run} onOpenApi={openApi} />
      <PageContainer>
        <MarketHeader
          definition={view.definition}
          autoRun={view.autoRun}
          onSwitchMarket={onSwitchMarket}
          onOpenApi={openApi}
          onAutoRunChange={(enabled) => actions.setAutoRun(marketId, enabled)}
          onRun={run}
        />
        <MarketOverview key={marketId} view={view} />
        <div className="mt-6 grid grid-cols-1 gap-x-6 border-t border-border pt-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <MarketSidebar marketId={marketId} onSwitchMarket={onSwitchMarket} />
          <div className="min-w-0">
            <ProvidersSection key={`providers-${marketId}`} marketId={marketId} />
            <div className="grid grid-cols-1 gap-x-6 xl:grid-cols-2">
              <RoutingPolicySection key={`routing-${marketId}`} marketId={marketId} />
              <ProviderConditionsSection key={`conditions-${marketId}`} marketId={marketId} />
            </div>
            <PaymentsSection key={`payments-${marketId}`} marketId={marketId} />
            <ActivitySection key={`activity-${marketId}`} marketId={marketId} />
          </div>
        </div>
      </PageContainer>
      <MarketCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        view={view}
        actions={actions}
        onSwitchMarket={onSwitchMarket}
        onOpenApi={openApi}
      />
      <ApiDialog open={apiOpen} onOpenChange={setApiOpen} view={view} />
    </>
  );
}
