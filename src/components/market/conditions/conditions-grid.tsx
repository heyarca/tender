"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CellEditRequestEvent,
  CellFocusedEvent,
  GridApi,
  GridReadyEvent,
  ITooltipParams,
  RowSelectionOptions,
} from "ag-grid-community";
import type { CustomCellRendererProps, CustomTooltipProps } from "ag-grid-react";
import { Check, RotateCcw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataGrid, type DataGridColumn, type DataGridFeature } from "@/components/ui/data-grid";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { usePrefersReducedMotion } from "@/components/viz";
import {
  format,
  type CheckId,
  type ConditionsPatch,
  type MarketView,
  type NumericInputSpec,
  type ProviderConditions,
  type ProviderId,
  type ProviderRow,
} from "@/lib/tender";
import { cn } from "@/lib/utils";

import { clampDisplay, displayOf, engineOf, formatSpecValue, roundDisplay } from "../policy/spec-values";
import { statusTone } from "./conditions-helpers";

const FEATURES: DataGridFeature[] = ["editing", "undoRedo", "tooltips"];
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 43;
const PROVIDER_WIDTH = 188;

export type NumericField = "bidPrice" | "p95LatencyMs" | "dataAgeMs" | "errorRate";

/** One provider, in the market's listing order (rows never jump while you edit). */
interface ConditionsRow {
  id: ProviderId;
  /** The engine row; rebuilt only when what the grid shows changes. */
  row: ProviderRow;
}

const CHECK_ORDER: readonly CheckId[] = ["price", "latency", "freshness", "reliability", "availability"];

const ROW_SELECTION: RowSelectionOptions<ConditionsRow> = { mode: "singleRow", checkboxes: false, enableClickSelection: false };

const getRowId = (row: ConditionsRow) => row.id;

const rowCache = new Map<string, { key: string; data: ConditionsRow }>();

/**
 * What a row shows. The monitor rebuilds every provider row each 5 s; when this is unchanged, the grid row
 * keeps its object and AG Grid leaves it (and an open editor) alone.
 */
const signature = (row: ProviderRow) =>
  JSON.stringify([row.conditions, row.status, row.role, row.modifiedFields, row.evaluation.reasons.length, row.evaluation.rank]);

export interface ConditionsGridProps {
  view: MarketView;
  selectedId: ProviderId | null;
  onSelect: (providerId: ProviderId) => void;
  /** Apply a patch to one provider; `note` explains a value that was clamped to the input range. */
  onEdit: (providerId: ProviderId, patch: ConditionsPatch, note?: string) => void;
  onRestore: (providerId: ProviderId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onApi?: (api: GridApi<ConditionsRow> | null) => void;
}

/**
 * Provider conditions as a spreadsheet on AG Grid. The Tender store stays the only copy of the data
 * (`readOnlyEdit`): an edit raises `cellEditRequest`, the section runs the same store action the form
 * used, and the new conditions come back as rows. Number editors parse and clamp to the market's input
 * ranges, the checkbox toggles availability, edited cells are washed and marked, and ⌘Z / ⌘⇧Z run the
 * section's undo stack (AG Grid fires `undoStarted` / `redoStarted` for the shortcut).
 */
export function ConditionsGrid({ view, selectedId, onSelect, onEdit, onRestore, onUndo, onRedo }: ConditionsGridProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [api, setApi] = useState<GridApi<ConditionsRow> | null>(null);
  const specs = view.definition.conditionInputs;
  const priceUnit = view.definition.units.price;

  const rows = useMemo(
    () =>
      view.definition.providers.map((provider) => {
        const row = view.providersById[provider.id];
        const key = signature(row);
        const cacheKey = `${view.id}/${provider.id}`;
        const hit = rowCache.get(cacheKey);
        if (hit && hit.key === key) return hit.data;
        const data = { id: provider.id, row };
        rowCache.set(cacheKey, { key, data });
        return data;
      }),
    [view],
  );

  const columns = useMemo(
    () => conditionColumns(specs, priceUnit, onRestore),
    [specs, priceUnit, onRestore],
  );

  const onCellEditRequest = useCallback(
    (event: CellEditRequestEvent<ConditionsRow>) => {
      const field = event.colDef.colId as keyof ProviderConditions | undefined;
      const data = event.data;
      if (!field || !data) return;
      if (field === "available") {
        const available = event.newValue === true;
        if (available !== data.row.conditions.available) onEdit(data.id, { available });
        return;
      }
      const spec = specs[field as NumericField];
      if (!spec) return;
      const typed = typeof event.newValue === "number" ? event.newValue : Number.parseFloat(String(event.newValue ?? ""));
      if (!Number.isFinite(typed)) return;
      const next = engineOf(spec, typed);
      const clamped = clampDisplay(spec, typed) !== roundDisplay(spec, typed);
      const note = clamped
        ? `${spec.label} must be ${formatSpecValue(spec, engineOf(spec, spec.min))} to ${formatSpecValue(spec, engineOf(spec, spec.max))}. Set to ${formatSpecValue(spec, next)}.`
        : undefined;
      if (next !== data.row.conditions[field] || note) onEdit(data.id, { [field]: next }, note);
    },
    [specs, onEdit],
  );

  const onCellFocused = useCallback(
    (event: CellFocusedEvent<ConditionsRow>) => {
      if (event.rowIndex === null || event.rowPinned) return;
      const id = event.api.getDisplayedRowAtIndex(event.rowIndex)?.data?.id;
      if (id && id !== selectedId) onSelect(id);
    },
    [onSelect, selectedId],
  );

  // The selected provider (shared with the providers table) gets the selected-row wash.
  useEffect(() => {
    if (!api || api.isDestroyed()) return;
    const node = selectedId ? api.getRowNode(selectedId) : undefined;
    if (node) {
      if (!node.isSelected()) node.setSelected(true, true, "api");
    } else {
      api.deselectAll();
    }
  }, [api, selectedId, rows]);

  const onGridReady = useCallback((event: GridReadyEvent<ConditionsRow>) => setApi(event.api), []);

  return (
    <DataGrid<ConditionsRow>
      aria-label={`${view.definition.name} provider conditions`}
      data-slot="conditions-grid"
      features={FEATURES}
      density="tight"
      rowData={rows}
      columnDefs={columns}
      getRowId={getRowId}
      cellFocus
      readOnlyEdit
      undoRedoCellEditing
      onUndoStarted={onUndo}
      onRedoStarted={onRedo}
      onCellEditRequest={onCellEditRequest}
      onCellFocused={onCellFocused}
      onGridReady={onGridReady}
      rowSelection={ROW_SELECTION}
      stopEditingWhenCellsLoseFocus
      enterNavigatesVerticallyAfterEdit
      tooltipShowDelay={300}
      tooltipInteraction
      autoSizeStrategy={null}
      animateRows={!reduceMotion}
      cellFlashDuration={reduceMotion ? 1200 : 300}
      cellFadeDuration={reduceMotion ? 0 : 1000}
      reserveHeight={`${HEADER_HEIGHT + rows.length * ROW_HEIGHT + 2}px`}
    />
  );
}

type CellProps = CustomCellRendererProps<ConditionsRow>;

function numberColumn(
  field: NumericField,
  headerName: string,
  spec: NumericInputSpec,
  options: { unit?: string; width: number },
): DataGridColumn<ConditionsRow> {
  return {
    colId: field,
    headerName,
    headerUnit: options.unit,
    headerHint: spec.hint,
    align: "right",
    width: options.width,
    editable: true,
    cellClass: "tender-editable",
    cellClassRules: { "tender-modified": ({ data }) => Boolean(data?.row.modifiedFields.includes(field)) },
    valueGetter: ({ data }) => (data ? displayOf(spec, data.row.conditions[field]) : null),
    cellEditor: "agNumberCellEditor",
    // No min/max/step here: out-of-range numbers are clamped (and explained) instead of rejected.
    cellEditorParams: { precision: spec.decimals, showStepperButtons: false },
    enableCellChangeFlash: true,
    cellRenderer: SpecValueCell,
    cellRendererParams: { spec, field },
    tooltip: ({ data }: ITooltipParams<ConditionsRow>) =>
      data?.row.modifiedFields.includes(field) ? `Edited. Default ${formatSpecValue(spec, data.row.defaults[field])}.` : undefined,
  };
}

function conditionColumns(
  specs: MarketView["definition"]["conditionInputs"],
  priceUnit: string,
  onRestore: (providerId: ProviderId) => void,
): DataGridColumn<ConditionsRow>[] {
  return [
    {
      colId: "provider",
      headerName: "Provider",
      pinned: "left",
      lockPinned: true,
      width: PROVIDER_WIDTH,
      cellRenderer: ProviderCell,
    },
    numberColumn("bidPrice", "Bid", specs.bidPrice, { unit: priceUnit, width: 120 }),
    numberColumn("p95LatencyMs", "P95", specs.p95LatencyMs, { unit: specs.p95LatencyMs.unit, width: 104 }),
    numberColumn("dataAgeMs", "Data age", specs.dataAgeMs, { unit: specs.dataAgeMs.unit, width: 112 }),
    numberColumn("errorRate", "Error rate", specs.errorRate, { unit: specs.errorRate.unit, width: 112 }),
    {
      colId: "available",
      headerName: "Available",
      headerHint: "Whether the provider responds. Unavailable providers are excluded at once.",
      width: 100,
      editable: true,
      cellDataType: "boolean",
      valueGetter: ({ data }) => data?.row.conditions.available ?? null,
      cellClassRules: { "tender-modified": ({ data }) => Boolean(data?.row.modifiedFields.includes("available")) },
      tooltip: ({ data }: ITooltipParams<ConditionsRow>) =>
        data?.row.modifiedFields.includes("available")
          ? `Edited. Default ${data.row.defaults.available ? "available" : "not responding"}.`
          : undefined,
    },
    {
      colId: "status",
      headerName: "Status",
      headerHint: "Qualification against your routing policy. Hover a status to see every check.",
      flex: 1,
      minWidth: 116,
      valueGetter: ({ data }) => data?.row.statusLabel ?? null,
      enableCellChangeFlash: true,
      cellRenderer: StatusCell,
      tooltip: ({ data }: ITooltipParams<ConditionsRow>) => data?.row.statusLabel,
      tooltipComponent: ChecksTooltip,
    },
    {
      colId: "restore",
      headerName: "Restore",
      headerHidden: true,
      width: 48,
      padding: { start: 4, end: 8 },
      cellRenderer: RestoreCell,
      cellRendererParams: { onRestore },
    },
  ];
}

function ProviderCell({ data }: CellProps) {
  if (!data) return null;
  const { row } = data;
  return (
    <span className="flex min-w-0 items-center gap-2" data-provider={row.id}>
      <ProviderLogo src={row.logo} name={row.name} />
      <span className={cn("truncate text-xs", row.role === "excluded" ? "text-muted-foreground" : "text-foreground")}>{row.name}</span>
      {row.isActive ? (
        <Badge tone={row.role === "pinned-failing" ? "negative" : "active"}>{row.role === "active" ? "Active" : "Pinned"}</Badge>
      ) : null}
    </span>
  );
}

function SpecValueCell({ value, spec }: CellProps & { spec: NumericInputSpec; field: NumericField }) {
  if (typeof value !== "number") return null;
  const number = `${spec.prefix ?? ""}${format.number(value, spec.decimals)}`;
  return (
    <span className="text-foreground tabular-nums">
      {number}
      {spec.unit === "%" ? <span className="text-muted-foreground">%</span> : null}
    </span>
  );
}

function StatusCell({ data }: CellProps) {
  if (!data) return null;
  return <Badge tone={statusTone(data.row.status)}>{data.row.statusLabel}</Badge>;
}

/** Every policy check for the row (a React tooltip component in AG Grid's tooltip popup). */
function ChecksTooltip({ data }: CustomTooltipProps<ConditionsRow>) {
  if (!data) return null;
  const checks = CHECK_ORDER.map((id) => data.row.evaluation.checks.find((check) => check.check === id)).filter((check) => check !== undefined);
  const failing = data.row.evaluation.reasons.length;
  return (
    <div className="max-w-72 rounded-md bg-popover px-2 py-1.5 text-caption text-popover-foreground shadow-popover">
      <p className="font-medium text-foreground">
        {failing ? `Excluded: ${failing} ${failing === 1 ? "check fails" : "checks fail"}` : "Meets your policy"}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {checks.map((check) => (
          <li key={check.check} className={cn("flex items-center gap-1.5", check.passed ? "text-muted-foreground" : "text-negative-text")}>
            {check.passed ? (
              <Check aria-hidden="true" className="size-3 shrink-0 text-positive" strokeWidth={2.5} />
            ) : (
              <X aria-hidden="true" className="size-3 shrink-0 text-negative" strokeWidth={2.5} />
            )}
            <span>{check.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RestoreCell({ data, onRestore }: CellProps & { onRestore: (providerId: ProviderId) => void }) {
  if (!data?.row.modified) return null;
  return (
    <span data-grid-ignore-click="" className="flex w-full justify-end">
      <button
        type="button"
        onClick={() => onRestore(data.id)}
        aria-label={`Restore provider ${data.row.name} to default conditions`}
        title="Restore defaults"
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent-subtle hover:text-accent-foreground focus-visible:shadow-focus focus-visible:outline-none"
      >
        <RotateCcw aria-hidden="true" className="size-3.5" />
      </button>
    </span>
  );
}
