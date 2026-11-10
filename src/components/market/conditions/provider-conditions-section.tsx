"use client";

import { useCallback, useState } from "react";
import {
  Clock,
  Gauge,
  Power,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Tooltip } from "@/components/ui/tooltip";
import {
  selectMarketView,
  type ConditionsPatch,
  type MarketId,
  type MarketView,
  type ProviderConditions,
  type ProviderId,
  type ProviderRow,
} from "@/lib/tender";
import { useMarketView, useTenderActions, useTenderStore } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import { useSelectedProvider, type MarketSectionProps } from "../market-ui";
import { decisionFingerprint, describeMarketChange, type ChangeNote } from "../policy/market-change";
import { NOTE_TEXT } from "../policy/routing-policy-section";
import { scenarioActions, type ScenarioId } from "./conditions-helpers";
import { ConditionsGrid } from "./conditions-grid";

const SCENARIO_ICONS: Record<ScenarioId, LucideIcon> = {
  "raise-bid": TrendingUp,
  "cut-bid": TrendingDown,
  "add-latency": Gauge,
  "delay-data": Clock,
  availability: Power,
};

const UNDO_LIMIT = 20;

interface ProviderNote extends ChangeNote {
  providerId: ProviderId | null;
}

/** One undoable change: the conditions of each affected provider before and after it. */
interface Change {
  before: Record<ProviderId, ConditionsPatch>;
  after: Record<ProviderId, ConditionsPatch>;
}

const pick = (conditions: ProviderConditions, patch: ConditionsPatch): ConditionsPatch =>
  Object.fromEntries(Object.keys(patch).map((key) => [key, conditions[key as keyof ProviderConditions]])) as ConditionsPatch;

/** Resolve the provider the panel edits: the selection, else the serving provider, else rank 1, else the first. */
export function resolveEditedProvider(view: MarketView, selectedId: ProviderId | null): ProviderRow {
  return (
    (selectedId ? view.providersById[selectedId] : undefined) ??
    (view.route.activeProviderId ? view.providersById[view.route.activeProviderId] : undefined) ??
    view.recommended ??
    view.providersById[view.definition.providers[0].id]
  );
}

/**
 * Provider conditions: every provider's bid and performance in an editable grid. Edits run the store's
 * provider actions, so qualification and routing react at once, and each change can be undone.
 */
export function ProviderConditionsSection({ marketId }: MarketSectionProps) {
  const view = useMarketView(marketId);
  return <ConditionsEditor key={marketId} marketId={marketId} view={view} />;
}

function ConditionsEditor({ marketId, view }: { marketId: MarketId; view: MarketView }) {
  const { updateProvider } = useTenderActions();
  const store = useTenderStore();
  const [selectedId, select] = useSelectedProvider(marketId);
  const [note, setNote] = useState<ProviderNote | null>(null);
  const [history, setHistory] = useState<{ undo: Change[]; redo: Change[] }>({ undo: [], redo: [] });

  const current = useCallback(() => selectMarketView(store.api.getState().markets[marketId]), [store, marketId]);

  /** Apply patches through the store and explain what the route did. */
  const applyPatches = useCallback(
    (patches: Record<ProviderId, ConditionsPatch>, focusId: ProviderId | null, extra?: string) => {
      const before = current();
      for (const [providerId, patch] of Object.entries(patches)) updateProvider(marketId, providerId, patch);
      const after = current();
      const described = describeMarketChange(before, after, focusId);
      const lines = extra ? [extra, ...described.lines] : described.lines;
      setNote(lines.length ? { ...described, lines, providerId: focusId } : null);
    },
    [current, marketId, updateProvider],
  );

  /** A new change: apply it and put it on the undo stack. */
  const commit = useCallback(
    (after: Record<ProviderId, ConditionsPatch>, focusId: ProviderId | null, extra?: string) => {
      const view = current();
      const before = Object.fromEntries(
        Object.entries(after).map(([id, patch]) => [id, pick(view.providersById[id].conditions, patch)]),
      );
      applyPatches(after, focusId, extra);
      setHistory((h) => ({ undo: [...h.undo, { before, after }].slice(-UNDO_LIMIT), redo: [] }));
    },
    [applyPatches, current],
  );

  const onEdit = useCallback(
    (providerId: ProviderId, patch: ConditionsPatch, clampNote?: string) => {
      if (selectedId !== providerId) select(providerId);
      commit({ [providerId]: patch }, providerId, clampNote);
    },
    [commit, select, selectedId],
  );

  const onRestore = useCallback(
    (providerId: ProviderId) => {
      const row = current().providersById[providerId];
      commit({ [providerId]: { ...row.defaults } }, providerId);
    },
    [commit, current],
  );

  const resetAll = () => {
    const modified = current().providers.filter((row) => row.modified);
    commit(Object.fromEntries(modified.map((row) => [row.id, { ...row.defaults }])), null);
  };

  const onUndo = useCallback(() => {
    const change = history.undo[history.undo.length - 1];
    if (!change) return;
    applyPatches(change.before, Object.keys(change.before).length === 1 ? Object.keys(change.before)[0] : null);
    setHistory((h) => ({ undo: h.undo.slice(0, -1), redo: [...h.redo, change] }));
  }, [applyPatches, history.undo]);

  const onRedo = useCallback(() => {
    const change = history.redo[history.redo.length - 1];
    if (!change) return;
    applyPatches(change.after, Object.keys(change.after).length === 1 ? Object.keys(change.after)[0] : null);
    setHistory((h) => ({ undo: [...h.undo, change], redo: h.redo.slice(0, -1) }));
  }, [applyPatches, history.redo]);

  const modifiedCount = view.providers.filter((row) => row.modified).length;
  const row = resolveEditedProvider(view, selectedId);
  const visibleNote = note && note.fingerprint === decisionFingerprint(view) ? note : null;

  return (
    <Section
      id="conditions"
      icon={<SlidersHorizontal aria-hidden="true" />}
      title="Provider conditions"
      description="Edit any provider's bid or performance like a spreadsheet: select a value, type, and press Enter. Status and the route update immediately."
      framed={false}
      actions={
        <>
          <Tooltip content="Undo (⌘Z in the grid)">
            <Button variant="ghost" size="icon-sm" onClick={onUndo} disabled={!history.undo.length} aria-label="Undo the last change">
              <Undo2 aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="Redo (⌘⇧Z in the grid)">
            <Button variant="ghost" size="icon-sm" onClick={onRedo} disabled={!history.redo.length} aria-label="Redo">
              <Redo2 aria-hidden="true" />
            </Button>
          </Tooltip>
          <Button
            variant="outline"
            size="sm"
            onClick={resetAll}
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
        </>
      }
      data-market={marketId}
    >
      <div className="flex flex-col gap-4">
        <ConditionsGrid
          view={view}
          selectedId={selectedId}
          onSelect={select}
          onEdit={onEdit}
          onRestore={onRestore}
          onUndo={onUndo}
          onRedo={onRedo}
        />
        <div
          role="status"
          className={cn(
            visibleNote ? "rounded-lg border border-border bg-muted px-3.5 py-2.5 text-caption leading-snug" : "sr-only",
            visibleNote && NOTE_TEXT[visibleNote.tone],
          )}
        >
          {visibleNote?.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <ScenarioBar view={view} row={row} onEdit={onEdit} />
      </div>
    </Section>
  );
}

function ScenarioBar({
  view,
  row,
  onEdit,
}: {
  view: MarketView;
  row: ProviderRow;
  onEdit: (providerId: ProviderId, patch: ConditionsPatch) => void;
}) {
  const scenarios = scenarioActions(view.definition, row);
  return (
    <div className="flex flex-col gap-1.5">
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
              className="gap-1 px-2 [&_svg]:size-3.5 [&_svg]:text-muted-foreground"
              disabled={!patch}
              onClick={patch ? () => onEdit(row.id, patch) : undefined}
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
