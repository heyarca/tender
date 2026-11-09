"use client";

import { useState } from "react";
import {
  Check,
  Clock,
  Gauge,
  Power,
  RotateCcw,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  format,
  selectMarketView,
  type CheckId,
  type ConditionsPatch,
  type MarketView,
  type ProviderConditions,
  type ProviderId,
  type ProviderRow,
} from "@/lib/tender";
import { useMarketView, useTenderActions, useTenderStore } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import { useSelectedProvider, type MarketSectionProps } from "../market-ui";
import { describeMarketChange, type ChangeNote } from "../policy/market-change";
import { NOTE_TEXT } from "../policy/routing-policy-section";
import { SpecField, type FieldDraft } from "../policy/spec-field";
import { displayOf, engineOf, formatSpecValue } from "../policy/spec-values";
import { roleBadge, roleSummary, scenarioActions, statusTone, type ScenarioId } from "./conditions-helpers";

type NumericCondition = "p95LatencyMs" | "dataAgeMs" | "errorRate";

const NUMERIC_FIELDS: readonly { key: NumericCondition; label: string }[] = [
  { key: "p95LatencyMs", label: "P95 latency" },
  { key: "dataAgeMs", label: "Data age" },
  { key: "errorRate", label: "Error rate" },
];

const SCENARIO_ICONS: Record<ScenarioId, LucideIcon> = {
  "raise-bid": TrendingUp,
  "cut-bid": TrendingDown,
  "add-latency": Gauge,
  "delay-data": Clock,
  availability: Power,
};

const CHECK_DISPLAY_ORDER: readonly CheckId[] = ["price", "latency", "freshness", "reliability", "availability"];

interface ProviderNote extends ChangeNote {
  providerId: ProviderId | null;
}

/** Resolve the provider the panel edits: the selection, else the serving provider, else rank 1, else the first. */
export function resolveEditedProvider(view: MarketView, selectedId: ProviderId | null): ProviderRow {
  return (
    (selectedId ? view.providersById[selectedId] : undefined) ??
    (view.route.activeProviderId ? view.providersById[view.route.activeProviderId] : undefined) ??
    view.recommended ??
    view.providersById[view.definition.providers[0].id]
  );
}

/** Provider conditions: edit one provider's bid and performance and watch qualification and routing react. */
export function ProviderConditionsSection({ marketId }: MarketSectionProps) {
  const view = useMarketView(marketId);
  const { resetConditions } = useTenderActions();
  const store = useTenderStore();
  const [note, setNote] = useState<ProviderNote | null>(null);

  const apply = (providerId: ProviderId | null, action: () => void) => {
    const before = selectMarketView(store.api.getState().markets[marketId]);
    action();
    const after = selectMarketView(store.api.getState().markets[marketId]);
    setNote(before === after ? null : { ...describeMarketChange(before, after, providerId), providerId });
  };

  const modifiedCount = view.providers.filter((row) => row.modified).length;

  return (
    <Section
      id="conditions"
      icon={<SlidersHorizontal aria-hidden="true" />}
      title="Provider conditions"
      description="Change a provider's bid or performance. Its status and the route update immediately."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => apply(null, () => resetConditions(marketId))}
          disabled={!view.conditionsModified}
          aria-label={
            modifiedCount
              ? `Reset conditions for all providers (${modifiedCount} modified)`
              : "Reset conditions for all providers"
          }
        >
          <RotateCcw aria-hidden="true" />
          Reset conditions
        </Button>
      }
      className="flex flex-col"
      bodyClassName="flex flex-1 flex-col"
      data-market={marketId}
    >
      <ConditionsEditor key={marketId} view={view} note={note} apply={apply} />
    </Section>
  );
}

function ConditionsEditor({
  view,
  note,
  apply,
}: {
  view: MarketView;
  note: ProviderNote | null;
  apply: (providerId: ProviderId | null, action: () => void) => void;
}) {
  const marketId = view.id;
  const [selectedId, select] = useSelectedProvider(marketId);
  const { restoreProvider } = useTenderActions();
  const row = resolveEditedProvider(view, selectedId);
  const status = roleBadge(row);
  const visibleNote = note && (note.providerId === null || note.providerId === row.id) ? note : null;

  const pickerItems = view.definition.providers.map((provider) => {
    const providerRow = view.providersById[provider.id];
    const role = roleBadge(providerRow);
    return {
      value: provider.id,
      textValue: provider.name,
      label: (
        <span className="inline-flex items-center gap-1.5">
          {provider.name}
          {providerRow.modified ? (
            <span aria-label="modified" className="size-1.5 shrink-0 rounded-full bg-primary" />
          ) : null}
        </span>
      ),
      image: provider.logo,
      description:
        providerRow.role === "excluded" || providerRow.role === "standby"
          ? `${providerRow.statusLabel}${providerRow.modified ? " · modified" : ""}`
          : `${role.label} · ${providerRow.statusLabel}${providerRow.modified ? " · modified" : ""}`,
    };
  });

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={pickerItems}
            value={row.id}
            onValueChange={(providerId) => select(providerId)}
            aria-label="Provider"
            className="w-52 max-w-full"
          />
          <Badge tone={statusTone(row.status)}>{row.statusLabel}</Badge>
          <Badge tone={status.tone}>{status.label}</Badge>
          {row.modified ? (
            <Badge variant="outline" tone="active" title="Conditions differ from defaults">
              Modified
            </Badge>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => apply(row.id, () => restoreProvider(marketId, row.id))}
            disabled={!row.modified}
            aria-label={`Restore provider ${row.name} to default conditions`}
          >
            <RotateCcw aria-hidden="true" />
            Restore provider
          </Button>
        </div>
        <p className="text-caption leading-snug text-muted-foreground">{roleSummary(row, view.policy.preference)}</p>
      </div>

      <ProviderFields key={row.id} view={view} row={row} apply={apply} />

      <ScenarioBar view={view} row={row} apply={apply} />

      <div className="mt-auto flex flex-col gap-3">
        <div
          role="status"
          className={cn(
            visibleNote
              ? "rounded-lg border border-border bg-muted px-3.5 py-2.5 text-caption leading-snug"
              : "sr-only",
            visibleNote && NOTE_TEXT[visibleNote.tone],
          )}
        >
          {visibleNote?.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <PolicyChecks row={row} />
      </div>
    </div>
  );
}

function ProviderFields({
  view,
  row,
  apply,
}: {
  view: MarketView;
  row: ProviderRow;
  apply: (providerId: ProviderId | null, action: () => void) => void;
}) {
  const marketId = view.id;
  const { updateProvider } = useTenderActions();
  const specs = view.definition.conditionInputs;
  const [drafts, setDrafts] = useState<Partial<Record<keyof ProviderConditions, FieldDraft>>>({});

  const setDraft = (field: keyof ProviderConditions, draft: FieldDraft | null) =>
    setDrafts((current) => {
      const next = { ...current };
      if (draft) next[field] = draft;
      else delete next[field];
      return next;
    });

  const update = (patch: ConditionsPatch) => apply(row.id, () => updateProvider(marketId, row.id, patch));

  const bidSpec = specs.bidPrice;
  const bidDisplay = displayOf(bidSpec, row.conditions.bidPrice);
  const bidDraft = drafts.bidPrice ?? null;
  const bidChanged = bidDraft !== null && bidDraft.value !== null && bidDraft.value !== bidDisplay;
  const submitBid = () => {
    if (!bidDraft || bidDraft.value === null) return;
    const next = engineOf(bidSpec, bidDraft.value);
    setDraft("bidPrice", null);
    if (next !== row.conditions.bidPrice) update({ bidPrice: next });
  };

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
      <SpecField
        id={`conditions-${marketId}-bidPrice`}
        label="Bid"
        spec={bidSpec}
        value={bidDisplay}
        draft={bidDraft}
        onDraftChange={(draft) => setDraft("bidPrice", draft)}
        onSubmit={submitBid}
        modified={row.modifiedFields.includes("bidPrice")}
        defaultLabel={formatSpecValue(bidSpec, row.defaults.bidPrice)}
        onReset={() => update({ bidPrice: row.defaults.bidPrice })}
        action={
          <Button variant={bidChanged ? "primary" : "outline"} onClick={submitBid} disabled={!bidChanged}>
            Update bid
          </Button>
        }
        hint={
          bidChanged ? (
            <span className="text-warning-text">Not submitted. Current bid {format.price(row.conditions.bidPrice)} /M req.</span>
          ) : undefined
        }
        className="sm:col-span-2"
      />
      {NUMERIC_FIELDS.map(({ key, label }) => {
        const spec = specs[key];
        return (
          <SpecField
            key={key}
            id={`conditions-${marketId}-${key}`}
            label={label}
            spec={spec}
            value={displayOf(spec, row.conditions[key])}
            draft={drafts[key] ?? null}
            onDraftChange={(draft) => setDraft(key, draft)}
            onCommit={(display) => update({ [key]: engineOf(spec, display) })}
            modified={row.modifiedFields.includes(key)}
            defaultLabel={formatSpecValue(spec, row.defaults[key])}
            onReset={() => update({ [key]: row.defaults[key] })}
          />
        );
      })}
      <div className="flex min-w-0 flex-col">
        <div className="mb-1.5 flex min-h-5 items-center gap-1">
          <span id={`conditions-${marketId}-available-label`} className="text-caption font-medium text-muted-foreground">
            Availability
          </span>
          {row.modifiedFields.includes("available") ? (
            <span aria-hidden="true" className="ml-0.5 size-1.5 rounded-full bg-primary" />
          ) : null}
        </div>
        <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md border border-input bg-input-bg px-2.5 text-body text-foreground">
          <Switch
            checked={row.conditions.available}
            onCheckedChange={(available) => update({ available })}
            aria-labelledby={`conditions-${marketId}-available-label conditions-${marketId}-available-text`}
          />
          <span id={`conditions-${marketId}-available-text`}>
            {row.conditions.available ? "Available" : "Not responding"}
          </span>
        </label>
        <div className="mt-1.5 flex min-h-4 items-center text-caption text-faint">
          Default {row.defaults.available ? "available" : "not responding"}
        </div>
      </div>
    </div>
  );
}

function ScenarioBar({
  view,
  row,
  apply,
}: {
  view: MarketView;
  row: ProviderRow;
  apply: (providerId: ProviderId | null, action: () => void) => void;
}) {
  const { updateProvider } = useTenderActions();
  const scenarios = scenarioActions(view.definition, row);
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-5">
      <span id={`conditions-${view.id}-quick`} className="text-caption font-medium text-muted-foreground">
        Quick changes for {row.name}
      </span>
      <div role="group" aria-labelledby={`conditions-${view.id}-quick`} className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => {
          const Icon = SCENARIO_ICONS[scenario.id];
          const patch = scenario.patch;
          return (
            <Button
              key={scenario.id}
              variant="outline"
              size="sm"
              disabled={!patch}
              onClick={patch ? () => apply(row.id, () => updateProvider(view.id, row.id, patch)) : undefined}
            >
              <Icon aria-hidden="true" />
              {scenario.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function PolicyChecks({ row }: { row: ProviderRow }) {
  const checks = CHECK_DISPLAY_ORDER.map((id) => row.evaluation.checks.find((check) => check.check === id)!);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-muted-foreground">
        Policy checks · {row.evaluation.qualifies ? "qualifies" : `${row.evaluation.reasons.length} failing`}
      </span>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {checks.map((check) => (
          <li
            key={check.check}
            className={cn(
              "flex items-start gap-1.5 text-caption leading-snug",
              check.passed ? "text-muted-foreground" : "text-negative-text",
            )}
          >
            {check.passed ? (
              <Check aria-label="Pass" className="mt-px size-3.5 shrink-0 text-positive" strokeWidth={2.25} />
            ) : (
              <X aria-label="Fail" className="mt-px size-3.5 shrink-0 text-negative" strokeWidth={2.25} />
            )}
            <span>{check.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
