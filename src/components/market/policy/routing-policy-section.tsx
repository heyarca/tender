"use client";

import { useState } from "react";
import { Pin, RotateCcw, Route, TriangleAlert } from "lucide-react";

import { Badge, StatusDot, type StatusDotTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import {
  PREFERENCE_LABELS,
  PREFERENCES,
  SWITCH_COOLDOWN_MS,
  selectMarketView,
  type MarketView,
  type RoutingPreference,
  type Tone,
} from "@/lib/tender";
import { useMarketView, usePendingSwitch, useTenderActions, useTenderStore } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import type { MarketSectionProps } from "../market-ui";
import { decisionFingerprint, describeMarketChange, type ChangeNote } from "./market-change";
import { POLICY_FIELDS, previewEligibility, type PolicyField } from "./policy-helpers";
import { SpecField, type FieldDraft } from "./spec-field";
import { displayOf, engineOf, formatSpecValue } from "./spec-values";

type ModeChoice = "auto" | "pinned";

const MODE_ITEMS: readonly { value: ModeChoice; label: string }[] = [
  { value: "auto", label: "Automatic switching" },
  { value: "pinned", label: "Pin a provider" },
];

const PREFERENCE_ITEMS = PREFERENCES.map((value) => ({ value, label: PREFERENCE_LABELS[value] }));

const TONE_DOT: Record<Tone, StatusDotTone> = {
  neutral: "neutral",
  positive: "positive",
  warning: "warning",
  negative: "negative",
};

export const NOTE_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-positive-text",
  warning: "text-warning-text",
  negative: "text-negative-text",
};

/** Routing policy: limits, preference, and automatic switching or a pinned provider. */
export function RoutingPolicySection({ marketId }: MarketSectionProps) {
  const view = useMarketView(marketId);
  const { resetPolicy } = useTenderActions();
  const store = useTenderStore();
  const [note, setNote] = useState<ChangeNote | null>(null);

  /** Run an operator action and keep a note of what it changed. */
  const apply = (action: () => void) => {
    const before = selectMarketView(store.api.getState().markets[marketId]);
    action();
    const after = selectMarketView(store.api.getState().markets[marketId]);
    setNote(before === after ? null : describeMarketChange(before, after));
  };

  return (
    <Section
      id="routing"
      icon={<Route aria-hidden="true" />}
      title="Routing policy"
      description="Requirements every provider must meet. Changes apply immediately and re-rank every bid."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => apply(() => resetPolicy(marketId))}
          disabled={view.modifiedPolicyFields.length === 0}
        >
          <RotateCcw aria-hidden="true" />
          Reset policy
        </Button>
      }
      className="flex flex-col last:mb-10"
      bodyClassName="flex flex-1 flex-col"
      data-market={marketId}
    >
      <PolicyForm key={marketId} view={view} note={note} apply={apply} />
    </Section>
  );
}

function PolicyForm({
  view,
  note,
  apply,
}: {
  view: MarketView;
  note: ChangeNote | null;
  apply: (action: () => void) => void;
}) {
  const marketId = view.id;
  const { setPolicy, setRoutingMode, switchToRecommended } = useTenderActions();
  const [drafts, setDrafts] = useState<Partial<Record<PolicyField, FieldDraft>>>({});
  const specs = view.definition.policyInputs;

  const preview = previewEligibility(view, drafts);
  const previewing = Object.values(drafts).some((draft) => draft && draft.value !== null);

  const setDraft = (field: PolicyField, draft: FieldDraft | null) =>
    setDrafts((current) => {
      const next = { ...current };
      if (draft) next[field] = draft;
      else delete next[field];
      return next;
    });

  const mode = view.policy.mode;
  const pinnedId = mode.kind === "pinned" ? mode.providerId : null;
  const fallbackPin = view.route.activeProviderId ?? view.recommended?.id ?? view.definition.providers[0].id;
  const pinnedRow = pinnedId ? view.providersById[pinnedId] : null;

  const pinItems = view.definition.providers.map((provider) => {
    const row = view.providersById[provider.id];
    return {
      value: provider.id,
      label: provider.name,
      image: provider.logo,
      description: row.evaluation.rank ? `${row.statusLabel} · rank ${row.evaluation.rank}` : row.statusLabel,
    };
  });

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {POLICY_FIELDS.map(({ key, label, check }) => {
          const spec = specs[key];
          const value = view.policy[key];
          const defaultValue = view.defaultPolicy[key];
          return (
            <SpecField
              key={key}
              id={`policy-${marketId}-${key}`}
              label={label}
              spec={spec}
              value={displayOf(spec, value)}
              draft={drafts[key] ?? null}
              onDraftChange={(draft) => setDraft(key, draft)}
              onCommit={(display) => apply(() => setPolicy(marketId, { [key]: engineOf(spec, display) }))}
              modified={view.modifiedPolicyFields.includes(key)}
              defaultLabel={formatSpecValue(spec, defaultValue)}
              onReset={() => apply(() => setPolicy(marketId, { [key]: defaultValue }))}
              slider
              aside={
                <span className="tabular-nums">
                  {preview.passCounts[check]} of {view.providers.length} pass
                </span>
              }
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-5">
        <div className="flex flex-col gap-1.5">
          <span id={`policy-${marketId}-preference`} className="text-caption font-medium text-muted-foreground">
            Routing preference
          </span>
          <SegmentedControl<RoutingPreference>
            items={PREFERENCE_ITEMS}
            value={view.policy.preference}
            onValueChange={(preference) => apply(() => setPolicy(marketId, { preference }))}
            aria-labelledby={`policy-${marketId}-preference`}
            className="max-w-full self-start overflow-x-auto"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={`policy-${marketId}-mode`} className="text-caption font-medium text-muted-foreground">
            Mode
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<ModeChoice>
              items={MODE_ITEMS}
              value={mode.kind}
              onValueChange={(next) =>
                apply(() =>
                  setRoutingMode(
                    marketId,
                    next === "auto" ? { kind: "auto" } : { kind: "pinned", providerId: fallbackPin },
                  ),
                )
              }
              aria-labelledby={`policy-${marketId}-mode`}
              className="max-w-full overflow-x-auto"
            />
            {pinnedId ? (
              <Select
                items={pinItems}
                value={pinnedId}
                onValueChange={(providerId) => apply(() => setRoutingMode(marketId, { kind: "pinned", providerId }))}
                size="sm"
                aria-label="Pinned provider"
                className="w-48 max-w-full"
              />
            ) : null}
          </div>
          <p className="text-caption leading-snug text-muted-foreground">
            {pinnedRow
              ? `Requests always go to ${pinnedRow.name}. Tender never switches without your permission.`
              : `Failover is immediate. A better-ranked offer takes over after a ${SWITCH_COOLDOWN_MS / 1000} s switch cooldown.`}
          </p>
          {view.decision.kind === "pinned-failing" && pinnedRow ? (
            <div
              role="alert"
              className="mt-1 flex flex-col gap-2 rounded-md border border-negative/30 bg-negative-bg px-3 py-2.5"
            >
              <p className="flex items-start gap-2 text-caption leading-snug text-negative-text">
                <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" strokeWidth={2} />
                {view.decision.summary}
              </p>
              <div className="flex flex-wrap gap-2 pl-5.5">
                {view.decision.actions.map((action) =>
                  action.kind === "switch-to-recommended" ? (
                    <Button
                      key={action.kind}
                      size="sm"
                      variant="outline"
                      onClick={() => apply(() => switchToRecommended(marketId))}
                    >
                      <Pin aria-hidden="true" />
                      {action.label}
                    </Button>
                  ) : (
                    <Button
                      key={action.kind}
                      size="sm"
                      variant="outline"
                      onClick={() => apply(() => setRoutingMode(marketId, { kind: "auto" }))}
                    >
                      {action.label}
                    </Button>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <DecisionSummary view={view} preview={preview} previewing={previewing} note={note} />
    </div>
  );
}

function DecisionSummary({
  view,
  preview,
  previewing,
  note,
}: {
  view: MarketView;
  preview: ReturnType<typeof previewEligibility>;
  previewing: boolean;
  note: ChangeNote | null;
}) {
  const pending = usePendingSwitch(view.id);
  const { decision } = view;
  const visibleNote = note && note.fingerprint === decisionFingerprint(view) ? note : null;
  const title = pending ? pending.label : decision.title;
  const total = view.providers.length;

  return (
    <div className="mt-auto flex flex-col gap-2 rounded-lg border border-border bg-muted px-3.5 py-3">
      <p className="flex min-w-0 items-start gap-2 text-xs font-medium text-foreground">
        <StatusDot tone={TONE_DOT[decision.tone]} pulse={decision.kind === "pending-switch"} className="mt-1.5" />
        <span className="min-w-0">{title}</span>
      </p>
      {decision.kind === "pinned-failing" ? null : (
        <p className="text-caption leading-snug text-muted-foreground">{decision.summary}</p>
      )}
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <EligibilityStrip view={view} preview={preview} />
        <Badge tone={preview.qualifiedIds.size ? "neutral" : "negative"} className="ml-auto bg-background tabular-nums">
          {previewing
            ? `${preview.qualifiedIds.size} of ${total} would qualify`
            : `${preview.qualifiedIds.size} of ${total} qualify`}
        </Badge>
      </div>
      <div
        role="status"
        className={cn(
          visibleNote ? "flex flex-col gap-0.5 border-t border-border pt-2 text-caption leading-snug" : "sr-only",
          visibleNote && NOTE_TEXT[visibleNote.tone],
        )}
      >
        {visibleNote?.lines
          .filter((line) => !(decision.kind === "pinned-failing" && line === decision.summary))
          .map((line) => (
            <p key={line}>{line}</p>
          ))}
      </div>
    </div>
  );
}

function EligibilityStrip({ view, preview }: { view: MarketView; preview: ReturnType<typeof previewEligibility> }) {
  const qualified = preview.ranking.map((id) => view.providersById[id]).filter(Boolean);
  const excluded = view.providers.filter((row) => !preview.qualifiedIds.has(row.id));
  const servingId = view.route.activeProviderId;

  const item = (row: MarketView["providers"][number]) => {
    const qualifies = preview.qualifiedIds.has(row.id);
    const reasons = preview.reasons[row.id];
    const serving = servingId === row.id;
    return (
      <li key={row.id}>
        <Tooltip
          content={
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">
                {row.name}
                {serving ? " · serving requests" : ""}
              </span>
              <span>{qualifies ? "Meets your policy" : reasons}</span>
            </span>
          }
        >
          <span
            role="img"
            aria-label={`${row.name}: ${qualifies ? "qualifies" : `excluded, ${reasons}`}${serving ? ", serving requests" : ""}`}
            className={cn("relative flex rounded-sm")}
          >
            <ProviderLogo
              src={row.logo}
              name={row.name}
              size={20}
              className={cn("transition-[opacity,filter] duration-quick", !qualifies && "opacity-40 grayscale")}
            />
            {serving ? (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-[1.5px] border-muted bg-primary-strong"
              />
            ) : null}
          </span>
        </Tooltip>
      </li>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {qualified.length ? (
        <ul aria-label="Qualifying providers" className="flex flex-wrap items-center gap-1.5">
          {qualified.map(item)}
        </ul>
      ) : (
        <span className="text-caption text-negative-text">No provider qualifies</span>
      )}
      {excluded.length ? (
        <>
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <ul aria-label="Excluded providers" className="flex flex-wrap items-center gap-1.5">
            {excluded.map(item)}
          </ul>
        </>
      ) : null}
    </div>
  );
}
