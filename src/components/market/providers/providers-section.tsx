"use client";

import { Server } from "lucide-react";

import { Section } from "@/components/ui/section";
import { useMarketView } from "@/lib/tender/client";

import { useSelectedProvider, type MarketSectionProps } from "../market-ui";
import { ProvidersTable } from "./providers-table";
import { ProvidersToolbar } from "./providers-toolbar";
import { RoutingDecisionCallout } from "./routing-decision-callout";

/**
 * Providers: the bids competing for this contract in OpenRouter's provider
 * table layout, with the routing preference, policy chips, and the routing
 * decision.
 */
export function ProvidersSection({ marketId }: MarketSectionProps) {
  const view = useMarketView(marketId);
  const [selectedId, select] = useSelectedProvider(marketId);

  return (
    <Section
      id="providers"
      icon={<Server aria-hidden="true" />}
      title="Providers"
      description="Providers bid to serve this contract. Tender routes each request to the best provider that meets your policy."
      data-market={marketId}
    >
      <div className="flex flex-col gap-3">
        <ProvidersToolbar view={view} />
        <ProvidersTable view={view} selectedId={selectedId} onSelect={select} />
      </div>
      <RoutingDecisionCallout view={view} />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {view.decision.title}
      </p>
    </Section>
  );
}
