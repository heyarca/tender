"use client";

import { Section } from "@/components/ui/section";
import type { MarketSectionProps } from "../market-ui";

/** Placeholder. Owned and replaced by its Phase 2 lane (see docs/INTEGRATION.md). */
export function ProviderConditionsSection({ marketId }: MarketSectionProps) {
  return (
    <Section id="conditions" title="Provider conditions" data-market={marketId}>
      <div className="h-24" />
    </Section>
  );
}
