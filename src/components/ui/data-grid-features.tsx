"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { DateFilterModel, GridApi, NumberFilterModel, TextFilterModel } from "ag-grid-community";
import type { CustomFloatingFilterDisplayProps, CustomNoRowsOverlayProps } from "ag-grid-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";

/*
 * Pieces that grids share on top of `DataGrid`: CSV export, Tender floating filters, and the empty overlay.
 * Type-only AG Grid imports: the AG Grid runtime stays in the `DataGrid` chunk.
 */

/**
 * Download the rows the grid shows (filtered and sorted) as CSV. Cells export their raw value (numbers stay
 * numbers); columns with `context.csv` export that instead. Columns without a header name are skipped.
 */
export function exportGridCsv<TData>(api: GridApi<TData>, fileName: string) {
  const columnKeys = (api.getColumns() ?? [])
    .filter((column) => {
      const def = column.getColDef();
      return def.headerName && def.context?.csv !== false;
    })
    .map((column) => column.getColId());
  api.exportDataAsCsv({
    fileName,
    columnKeys,
    skipPinnedBottom: false,
    processCellCallback: ({ value, column, node }) => {
      const csv = column.getColDef().context?.csv as CsvValue<TData> | undefined;
      if (typeof csv === "function") return String(csv(node?.data as TData) ?? "");
      if (value === null || value === undefined) return "";
      if (Array.isArray(value)) return "";
      if (value instanceof Date) return value.toISOString();
      return String(value);
    },
    processHeaderCallback: ({ column }) => {
      const def = column.getColDef();
      const unit = def.context?.csvUnit as string | undefined;
      return unit ? `${def.headerName} (${unit})` : (def.headerName ?? column.getColId());
    },
  });
}

/** CSV cell for a column, set as `context: { csv }`; `false` leaves the column out. */
export type CsvValue<TData> = ((data: TData) => string | number | null) | false;

/** The grid toolbar button. */
export function ExportCsvButton<TData>({ api, fileName, label = "Export CSV" }: { api: GridApi<TData> | null; fileName: string; label?: string }) {
  return (
    <Button variant="outline" size="sm" disabled={!api} onClick={() => api && exportGridCsv(api, fileName)}>
      <Download aria-hidden="true" />
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------------------------
// Floating filters (grid option `enableFilterHandlers`: controlled by the filter model)
// ---------------------------------------------------------------------------------------------

export interface LimitFloatingFilterParams {
  /** `max`: value ≤ limit (number filter `lessThanOrEqual`); `min`: value ≥ limit. */
  bound: "max" | "min";
  /** Unit inside the field ("ms", "%", "/M"). */
  unit?: string;
  /** Prefix inside the field after ≤ / ≥ ("$"). */
  prefix?: string;
  /** Display value → model value (for example 99.5 % → 0.995). Default: identity. */
  toModel?: (display: number) => number;
  /** Model value → display value. Default: identity. */
  toDisplay?: (value: number) => number;
  placeholder?: string;
}

const numberType = (bound: LimitFloatingFilterParams["bound"]) => (bound === "max" ? "lessThanOrEqual" : "greaterThanOrEqual");

const trimNumber = (value: number) => String(Math.round(value * 1000) / 1000);

/**
 * "≤ 400 ms" in a Tender input under the header. It writes the column's number filter model, so the grid's
 * Number Filter does the filtering and the model round-trips through `getFilterModel` / `setFilterModel`.
 */
export function LimitFloatingFilter({
  model,
  onModelChange,
  column,
  bound,
  unit,
  prefix,
  toModel = (value) => value,
  toDisplay = (value) => value,
  placeholder = "Any",
}: CustomFloatingFilterDisplayProps<unknown, unknown, NumberFilterModel> & LimitFloatingFilterParams) {
  const applied = typeof model?.filter === "number" ? trimNumber(toDisplay(model.filter)) : "";
  const [draft, setDraft] = useState({ text: applied, applied });
  let text = draft.text;
  // A model set elsewhere (URL, "Clear filters") replaces the text, unless it is what the text already says.
  if (draft.applied !== applied) {
    const parsed = Number.parseFloat(draft.text);
    text = Number.isFinite(parsed) && trimNumber(parsed) === applied ? draft.text : applied;
    setDraft({ text, applied });
  }

  const commit = (next: string) => {
    setDraft((current) => ({ ...current, text: next }));
    const value = Number.parseFloat(next.replace(/[^0-9.]/g, ""));
    if (next.trim() === "" || !Number.isFinite(value)) {
      if (model) onModelChange(null);
      return;
    }
    onModelChange({ filterType: "number", type: numberType(bound), filter: toModel(value) });
  };

  const name = column.getColDef().headerName ?? column.getColId();
  return (
    <Input
      size="sm"
      value={text}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      onChange={(event) => commit(event.target.value)}
      aria-label={`${name}, ${bound === "max" ? "at most" : "at least"}${unit ? ` (${unit})` : ""}`}
      prefix={
        <span className="flex items-center gap-0.5">
          <span className={text ? "text-accent-foreground" : undefined}>{bound === "max" ? "\u2264" : "\u2265"}</span>
          {prefix}
        </span>
      }
      suffix={unit}
      className="w-full text-caption"
    />
  );
}

export interface SelectFloatingFilterParams {
  options: readonly SelectOption[];
  /** Option for "no filter" (value ""). */
  allLabel: string;
  /** `text`: text filter `equals` on the value. `date`: date filter preset (`today`, `last7Days`, ...). */
  kind: "text" | "date";
}

/** A Tender select under the header that writes a text `equals` or a date preset filter model. */
export function SelectFloatingFilter({
  model,
  onModelChange,
  column,
  options,
  allLabel,
  kind,
}: CustomFloatingFilterDisplayProps<unknown, unknown, TextFilterModel | DateFilterModel> & SelectFloatingFilterParams) {
  const current = kind === "text" ? ((model as TextFilterModel | null)?.filter ?? "") : (model?.type ?? "");
  const items: SelectOption[] = [{ value: "", label: allLabel }, ...options];
  const name = column.getColDef().headerName ?? column.getColId();
  return (
    <Select
      size="sm"
      items={items}
      value={current}
      aria-label={`Filter ${name}`}
      onValueChange={(value) => {
        if (!value) onModelChange(null);
        else if (kind === "text") onModelChange({ filterType: "text", type: "equals", filter: value });
        else onModelChange({ filterType: "date", type: value as DateFilterModel["type"], dateFrom: null, dateTo: null });
      }}
      className="w-full text-caption"
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------------------------

export interface EmptyOverlayParams {
  title: string;
  description?: string;
  /** Optional action (for example "Clear filters"). */
  action?: { label: string; onClick: () => void };
}

/** No rows (or no matching rows) inside the grid body, in the `EmptyState` style. */
export function GridEmptyOverlay({ title, description, action }: CustomNoRowsOverlayProps & EmptyOverlayParams) {
  return (
    <div role="status" className="pointer-events-auto flex flex-col items-center px-6 py-8 text-center">
      <p className="text-body font-medium text-foreground">{title}</p>
      {description ? <p className="mt-0.5 max-w-sm text-caption leading-snug text-muted-foreground">{description}</p> : null}
      {action ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
