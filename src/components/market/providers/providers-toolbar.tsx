"use client";

import { Pin } from "lucide-react";

import { focusSection } from "@/components/market/market-ui";
import { Button } from "@/components/ui/button";
import { SegmentedControl, type SegmentedControlItem } from "@/components/ui/segmented-control";
import { PREFERENCE_LABELS, PREFERENCES, type MarketView, type RoutingPreference } from "@/lib/tender";
import { useTenderActions } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import { policyChips, qualifyCountText } from "./provider-table-model";

const PREFERENCE_ITEMS: readonly SegmentedControlItem<RoutingPreference>[] = PREFERENCES.map((preference) => ({
  value: preference,
  label: PREFERENCE_LABELS[preference],
}));

export interface ProvidersToolbarProps {
  view: MarketView;
}

/**
 * OpenRouter-style table toolbar: the routing preference switch, dashed chips
 * that summarize the policy (each opens Routing policy), and the qualify count.
 */
export function ProvidersToolbar({ view }: ProvidersToolbarProps) {
  const { setPolicy } = useTenderActions();
  const chips = policyChips(view);

  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="providers-toolbar">
      <SegmentedControl
        items={PREFERENCE_ITEMS}
        value={view.policy.preference}
        onValueChange={(preference) => setPolicy(view.id, { preference })}
        aria-label="Routing preference"
        className="max-sm:w-full"
        itemClassName="max-sm:flex-1"
      />
      <div role="group" aria-label="Policy requirements" className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <Button
            key={chip.key}
            variant="dashed"
            size="md"
            onClick={() => focusSection("routing")}
            aria-label={`${chip.description}. Edit routing policy`}
            data-chip={chip.key}
            data-modified={chip.modified || undefined}
            className={cn(
              "tabular-nums",
              chip.modified && "border-solid border-primary-strong/40 text-foreground",
              chip.failing && "border-solid border-negative/30 bg-negative-bg text-negative-text hover:bg-negative-bg hover:text-negative-text",
            )}
          >
            {chip.key === "mode" && chip.label !== "Auto" ? <Pin aria-hidden="true" /> : null}
            {chip.label}
          </Button>
        ))}
      </div>
      <p className="ml-auto text-caption whitespace-nowrap text-muted-foreground tabular-nums" data-slot="qualify-count">
        <span className="font-medium text-foreground">{view.qualifiedCount}</span>
        {qualifyCountText(view.qualifiedCount, view.providers.length).slice(String(view.qualifiedCount).length)}
      </p>
    </div>
  );
}
