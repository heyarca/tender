"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { AutoSizeStrategy, ColDef, RowClickedEvent } from "ag-grid-community";
import type { AgGridReactProps } from "ag-grid-react";

import { cn } from "@/lib/utils";

/*
 * `DataGrid` is AG Grid (Community) themed as Tender's `or-table`. This file holds the types and a small
 * loader; the grid itself (`./data-grid-core`) is a separate chunk that loads when a grid comes within
 * a screen of the viewport. Pages that never show a grid, or show one far below the fold (the landing
 * page), do not download AG Grid up front.
 */

export type DataGridDensity = "regular" | "tight";

/** Opt-in AG Grid features (Community modules). See `FEATURE_MODULES` in `./data-grid-core`. */
export type DataGridFeature =
  | "quickFilter"
  | "externalFilter"
  | "numberFilter"
  | "textFilter"
  | "dateFilter"
  | "editing"
  | "undoRedo"
  | "tooltips"
  | "csvExport"
  | "totalsRow"
  | "transactions"
  | "columnState";

export interface DataGridColumn<TData> extends ColDef<TData> {
  /** Unit after the header label, 10px faint (for example "/M req" or "USDC"). */
  headerUnit?: ReactNode;
  /** Explanation shown on hover; the header label gets a dotted underline. */
  headerHint?: ReactNode;
  /** Hide the header label visually (screen readers still read it). */
  headerHidden?: boolean;
  /** Right-align the header and cells (numeric columns). */
  align?: "left" | "right";
  /** Cell and header padding in px. Defaults to 16px at the row edges and the theme padding elsewhere. */
  padding?: { start?: number; end?: number };
}

export interface DataGridProps<TData>
  extends Omit<
    AgGridReactProps<TData>,
    "theme" | "rowData" | "columnDefs" | "getRowId" | "domLayout" | "onRowClicked" | "autoSizeStrategy" | "modules"
  > {
  rowData: readonly TData[];
  columnDefs: readonly DataGridColumn<TData>[];
  /**
   * Id of a row (for example the provider id), so updates move rows instead of recreating them.
   * Read once when the grid is created.
   */
  getRowId: (data: TData) => string;
  /** `autoHeight` (default) grows with the rows inside the page flow, with no inner vertical scroll. */
  domLayout?: AgGridReactProps<TData>["domLayout"];
  density?: DataGridDensity;
  /** Clicks inside an element with `data-grid-ignore-click` (row menus, links) do not reach this handler. */
  onRowClicked?: (event: RowClickedEvent<TData>) => void;
  /** Accessible name of the grid. */
  "aria-label"?: string;
  "data-slot"?: string;
  /**
   * Height (CSS length) reserved until the grid has rendered its rows. The grid renders on the client,
   * so this keeps prerendered pages from jumping when it appears.
   */
  reserveHeight?: string;
  /** Class for the outer box. */
  className?: string;
  /**
   * Let cells take keyboard focus (arrow keys, Enter, editing). Off by default: most grids are
   * read-only lists where a row click is the only action.
   */
  cellFocus?: boolean;
  /** Minimum body height in px, so an overlay (no matching rows) has room in an auto-height grid. */
  minBodyHeight?: number;
  /** Defaults to fitting columns to their content; `null` keeps the column widths and flex as defined. */
  autoSizeStrategy?: AutoSizeStrategy | null;
  /** AG Grid features this grid uses. Read once, when the grid is created. */
  features?: readonly DataGridFeature[];
}

type GridComponent = <TData>(props: DataGridProps<TData>) => ReactNode;

let loadedCore: GridComponent | null = null;
let coreRequest: Promise<GridComponent> | null = null;

function loadCore(): Promise<GridComponent> {
  coreRequest ??= import("./data-grid-core").then((module) => {
    loadedCore = module.DataGridCore as GridComponent;
    return loadedCore;
  });
  return coreRequest;
}

/** A screen of lead time, so the grid is usually drawn before it scrolls into view. */
const NEAR_MARGIN = "100% 0px";

/**
 * Typed AG Grid with the Tender theme. Until AG Grid has loaded, the box keeps `reserveHeight` with the
 * grid's frame, so nothing jumps.
 */
export function DataGrid<TData>(props: DataGridProps<TData>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [Core, setCore] = useState<ComponentType<DataGridProps<TData>> | null>(() => loadedCore);

  useEffect(() => {
    if (Core) return;
    const box = boxRef.current;
    if (!box) return;
    let cancelled = false;
    const load = () => void loadCore().then((core) => !cancelled && setCore(() => core));
    // Without IntersectionObserver (jsdom), load at once.
    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        cancelled = true;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load();
      },
      { rootMargin: NEAR_MARGIN },
    );
    observer.observe(box);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [Core]);

  if (Core) return <Core {...props} />;
  return (
    <div
      ref={boxRef}
      data-slot={props["data-slot"]}
      className={cn("relative w-full min-w-0", props.className)}
      style={props.reserveHeight ? { minHeight: props.reserveHeight } : undefined}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg border border-border bg-card" />
    </div>
  );
}
