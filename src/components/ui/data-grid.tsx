"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColumnAutoSizeModule,
  HighlightChangesModule,
  ModuleRegistry,
  RenderApiModule,
  RowApiModule,
  RowAutoHeightModule,
  RowSelectionModule,
  createPart,
  iconOverrides,
  themeQuartz,
  type AutoSizeStrategy,
  type CellStyle,
  type CellStyleFunc,
  type ColDef,
  type FirstDataRenderedEvent,
  type GetRowIdParams,
  type GridReadyEvent,
  type HeaderStyle,
  type HeaderStyleFunc,
  type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact, type AgGridReactProps, type CustomInnerHeaderProps } from "ag-grid-react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/*
 * AG Grid (Community) themed as Tender's `or-table`: framed white surface, 13px
 * muted headers, 14px cells, hairline row borders, hover and selected washes,
 * and lucide chevrons for sorting. The theme reads the design tokens from
 * globals.css, so it follows any token change. No AG Grid CSS files are
 * imported: the Theming API injects the styles.
 */

// Only the features the grids use (AllCommunityModule adds ~95 KB gzipped). When a grid needs another
// feature, add its module here; AG Grid logs the name of a missing module in the console.
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  CellStyleModule,
  ColumnAutoSizeModule,
  HighlightChangesModule,
  RenderApiModule,
  RowApiModule,
  RowAutoHeightModule,
  RowSelectionModule,
]);

/** Row edge padding (OpenRouter's `first:pl-4 last:pr-4`). */
const EDGE_PADDING = 16;

const svg = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

/** Lucide ChevronUp, ChevronDown, ChevronsUpDown, and Funnel, painted in the header text color. */
const sortIcons = iconOverrides({
  type: "image",
  mask: true,
  icons: {
    asc: { svg: svg('<path d="m18 15-6-6-6 6"/>') },
    desc: { svg: svg('<path d="m6 9 6 6 6-6"/>') },
    none: { svg: svg('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>') },
    // Lucide Funnel: the "filtered" mark in a header.
    filter: {
      svg: svg(
        '<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>',
      ),
    },
  },
});

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const HIDDEN: CSSProperties = { visibility: "hidden" };

const tenderPart = createPart({
  feature: "tender",
  css: `
    .ag-header-cell-label { gap: 4px; }
    .ag-sort-indicator-container { display: flex; align-items: center; }
    .ag-sort-indicator-icon { padding: 0; }
    .ag-sort-none-icon { opacity: 0; transition: opacity 250ms ${EASE}; }
    .ag-header-cell:hover .ag-sort-none-icon,
    .ag-header-cell:focus-visible .ag-sort-none-icon { opacity: 1; }
    .ag-header-cell-sortable { transition: color 150ms; }
    .ag-header-cell-sortable:hover,
    .ag-header-cell-sorted-asc,
    .ag-header-cell-sorted-desc { color: var(--foreground); }
    .ag-cell { display: flex; align-items: center; }
    .ag-cell-wrapper { min-width: 0; max-width: 100%; }
    .ag-cell-wrapper > .ag-cell-value { min-width: 0; }
    .ag-right-aligned-cell { justify-content: flex-end; }
    .ag-row-animation .ag-row {
      transition: transform 500ms ${EASE}, top 500ms ${EASE}, height 500ms ${EASE}, opacity 200ms;
    }
    .ag-row-selected.ag-row-hover::before { background-image: none; }
    .ag-header-cell:focus-visible,
    .ag-header-cell.ag-focus-managed:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
    /* Measured values that tick every few seconds flash softer than a bid or route change. */
    .tender-live.ag-cell-data-changed { background-color: var(--accent-subtle) !important; }
    /* Floating filters: one Tender input per column, no button. */
    .ag-floating-filter { padding-top: 6px; padding-bottom: 6px; }
    .ag-floating-filter-body { height: 100%; }
    /* Editable cells look like a field on hover; the focused cell gets the olive outline. */
    .tender-editable { cursor: text; }
    .ag-row:not(.ag-row-pinned) .tender-editable:hover { box-shadow: inset 0 0 0 1px var(--border); }
    /* A value that differs from its default: lime wash (ink text) and an olive corner mark. */
    .tender-modified { background-color: var(--accent-subtle); }
    .tender-modified::after {
      content: ""; position: absolute; top: 0; right: 0; width: 0; height: 0;
      border-style: solid; border-width: 0 6px 6px 0; border-color: transparent var(--ring) transparent transparent;
    }
    .ag-checkbox-input-wrapper { box-shadow: none; }
    .ag-row-pinned { font-variant-numeric: tabular-nums; }
    @media (prefers-reduced-motion: reduce) {
      .ag-row-animation .ag-row { transition: none; }
    }
  `,
});

const tokens = {
  fontFamily: "inherit",
  headerFontFamily: "inherit",
  cellFontFamily: "inherit",
  fontSize: 14,
  dataFontSize: 14,
  headerFontSize: 13,
  headerFontWeight: 500,
  foregroundColor: "var(--foreground)",
  textColor: "var(--foreground)",
  cellTextColor: "var(--muted-foreground)",
  subtleTextColor: "var(--muted-foreground)",
  headerTextColor: "var(--muted-foreground)",
  backgroundColor: "var(--card)",
  chromeBackgroundColor: "var(--card)",
  headerBackgroundColor: "var(--card)",
  borderColor: "var(--border)",
  wrapperBorder: true,
  wrapperBorderRadius: 8,
  borderRadius: 4,
  rowBorder: true,
  headerRowBorder: true,
  columnBorder: false,
  headerColumnBorder: false,
  headerColumnResizeHandleColor: "transparent",
  headerCellHoverBackgroundColor: "transparent",
  rowHeight: 44,
  // Short grids hug their rows (the default keeps room for an empty-state overlay).
  autoHeightMinBodyHeight: 0,
  // 42px plus the 1px header border: the 43px `or-table` header row.
  headerHeight: 42,
  cellHorizontalPadding: 12,
  rowHoverColor: "var(--card-hover)",
  selectedRowBackgroundColor: "var(--selected-bg)",
  accentColor: "var(--ring)",
  iconColor: "inherit",
  iconSize: 14,
  // The brief wash on a row that just took over (lime 25%; lime is a fill, the text stays ink).
  valueChangeValueHighlightBackgroundColor: "var(--accent)",
  browserColorScheme: "light",
  focusShadow: "none",
  // The focused cell (keyboard navigation and editing grids): the olive focus outline.
  rangeSelectionBorderColor: "var(--ring)",
  cellEditingBorder: { width: 1, style: "solid", color: "var(--ring)" },
  cellEditingShadow: "var(--shadow-focus)",
  // Inputs (floating filters, cell editors): the Tender input, 28px.
  inputHeight: 28,
  inputPaddingStart: 8,
  inputBorderRadius: 6,
  inputBackgroundColor: "var(--input-bg)",
  inputBorder: { width: 1, style: "solid", color: "var(--input)" },
  inputTextColor: "var(--foreground)",
  inputPlaceholderTextColor: "var(--text-faint)",
  inputIconColor: "var(--muted-foreground)",
  inputFocusBorder: { width: 1, style: "solid", color: "var(--focus-border)" },
  inputFocusShadow: "var(--shadow-focus)",
  inputInvalidBorder: { width: 1, style: "solid", color: "var(--negative)" },
  inputInvalidTextColor: "var(--negative-text)",
  invalidColor: "var(--negative-text)",
  // Checkboxes: lime fill with an ink check, like `ui/checkbox`.
  checkboxBorderRadius: 4,
  checkboxUncheckedBackgroundColor: "var(--input-bg)",
  checkboxUncheckedBorderColor: "color-mix(in srgb, var(--foreground) 25%, transparent)",
  checkboxCheckedBackgroundColor: "var(--primary)",
  checkboxCheckedBorderColor: "var(--primary-border)",
  checkboxCheckedShapeColor: "var(--primary-foreground)",
  // Popups, menus, and tooltips: the popover surface.
  menuBackgroundColor: "var(--popover)",
  menuTextColor: "var(--popover-foreground)",
  menuBorder: false,
  menuShadow: "var(--shadow-popover)",
  popupShadow: "var(--shadow-popover)",
  dropdownShadow: "var(--shadow-popover)",
  tooltipBackgroundColor: "var(--popover)",
  tooltipTextColor: "var(--popover-foreground)",
  tooltipBorder: { width: 1, style: "solid", color: "var(--border)" },
  tooltipErrorBackgroundColor: "var(--popover)",
  tooltipErrorTextColor: "var(--negative-text)",
  tooltipErrorBorder: { width: 1, style: "solid", color: "var(--negative)" },
  // Pinned columns keep a hairline edge while the rest scrolls; totals rows are muted and medium.
  pinnedColumnBorder: true,
  pinnedRowBorder: true,
  pinnedRowBackgroundColor: "var(--muted)",
  pinnedRowFontWeight: 500,
  pinnedRowTextColor: "var(--foreground)",
} as const;

/** Tender theme: 12px cell padding (the default `or-table` density). */
export const dataGridTheme = themeQuartz.withPart(sortIcons).withPart(tenderPart).withParams(tokens);

/** Tight theme: 10px cell padding (OpenRouter's `or-table--tight-x`), for wide tables. */
export const dataGridThemeTight = dataGridTheme.withParams({ cellHorizontalPadding: 10 });

export type DataGridDensity = "regular" | "tight";

/**
 * Like an HTML table's auto layout: columns fit their content (header included),
 * then share any spare width, and refit when the data changes.
 */
const AUTO_SIZE: AutoSizeStrategy = { type: "fitCellContents", scaleUpToFitGridWidth: true, continuous: true };

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
    "theme" | "rowData" | "columnDefs" | "getRowId" | "domLayout" | "onRowClicked" | "autoSizeStrategy"
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
}

/**
 * Typed AG Grid with the Tender theme. Rows are immutable data: pass a new
 * `rowData` array and the grid diffs it by `getRowId`, keeping selection and
 * animating moved rows.
 */
export function DataGrid<TData>({
  rowData,
  columnDefs,
  getRowId,
  domLayout = "autoHeight",
  density = "regular",
  onRowClicked,
  onGridReady,
  onFirstDataRendered,
  defaultColDef,
  autoSizeStrategy = AUTO_SIZE,
  "aria-label": ariaLabel,
  "data-slot": dataSlot,
  reserveHeight,
  className,
  cellFocus = false,
  minBodyHeight,
  ...props
}: DataGridProps<TData>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // AG Grid reads `getRowId` once, when the grid is created.
  const [gridGetRowId] = useState(() => (params: GetRowIdParams<TData>) => getRowId(params.data));

  const columns = useMemo(
    () => columnDefs.map((column, index) => toColDef(column, index, columnDefs.length)),
    [columnDefs],
  );

  const gridDefaultColDef = useMemo<ColDef<TData>>(
    () => ({
      sortable: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      suppressHeaderContextMenu: true,
      unSortIcon: true,
      ...defaultColDef,
    }),
    [defaultColDef],
  );

  const handleGridReady = useCallback(
    (event: GridReadyEvent<TData>) => {
      const root = boxRef.current?.querySelector('[role="grid"], [role="treegrid"]');
      if (root && ariaLabel) root.setAttribute("aria-label", ariaLabel);
      onGridReady?.(event);
    },
    [ariaLabel, onGridReady],
  );

  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<TData>) => {
      onFirstDataRendered?.(event);
      // React cells and header labels mount a moment after the rows, and the web font may still be
      // loading. Size the columns once both have settled, then show the grid.
      const settle = () => {
        if (event.api.isDestroyed()) return;
        if (autoSizeStrategy?.type === "fitCellContents") {
          const { colIds, skipHeader, scaleUpToFitGridWidth, defaultMinWidth, defaultMaxWidth } = autoSizeStrategy;
          event.api.autoSizeColumns({ colIds, skipHeader, scaleUpToFitGridWidth, defaultMinWidth, defaultMaxWidth });
        }
        setReady(true);
      };
      const fonts = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
      void fonts.then(() => requestAnimationFrame(() => requestAnimationFrame(settle)));
    },
    [autoSizeStrategy, onFirstDataRendered],
  );

  const handleRowClicked = useMemo(() => {
    if (!onRowClicked) return undefined;
    return (event: RowClickedEvent<TData>) => {
      const target = event.event?.target;
      if (target instanceof Element && target.closest("[data-grid-ignore-click]")) return;
      onRowClicked(event);
    };
  }, [onRowClicked]);

  const style: CSSProperties | undefined = !ready && reserveHeight ? { minHeight: reserveHeight } : undefined;
  const theme = useMemo(() => {
    const base = density === "tight" ? dataGridThemeTight : dataGridTheme;
    return minBodyHeight ? base.withParams({ autoHeightMinBodyHeight: minBodyHeight }) : base;
  }, [density, minBodyHeight]);

  return (
    <div ref={boxRef} data-slot={dataSlot} data-ready={ready || undefined} className={cn("relative w-full min-w-0", className)} style={style}>
      {ready ? null : (
        // The empty frame holds the grid's place until AG Grid has drawn the rows.
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg border border-border bg-card" />
      )}
      <AgGridReact<TData>
        containerStyle={ready ? undefined : HIDDEN}
        theme={theme}
        rowData={rowData as TData[]}
        columnDefs={columns}
        defaultColDef={gridDefaultColDef}
        getRowId={gridGetRowId}
        domLayout={domLayout}
        animateRows
        suppressCellFocus={!cellFocus}
        suppressMovableColumns
        suppressDragLeaveHidesColumns
        suppressColumnVirtualisation
        // Table-like text selection. No `ensureDomOrder`: it turns off row animation.
        enableCellTextSelection
        suppressNoRowsOverlay
        autoSizeStrategy={autoSizeStrategy ?? undefined}
        // A little room for sub-pixel text widths, so a measured label never wraps or clips.
        autoSizePadding={2}
        onGridReady={handleGridReady}
        onFirstDataRendered={handleFirstDataRendered}
        onRowClicked={handleRowClicked}
        {...props}
      />
    </div>
  );
}

interface HeaderLabelParams {
  unit?: ReactNode;
  hint?: ReactNode;
  hidden?: boolean;
}

/** Header label: 13px medium, an optional faint unit, and a dotted underline when it has a hint. */
function DataGridHeaderLabel({ displayName, unit, hint, hidden }: CustomInnerHeaderProps & HeaderLabelParams) {
  if (hidden) return <span className="sr-only">{displayName}</span>;
  const label = (
    <span
      className={cn(
        "min-w-0 truncate text-[13px] font-medium whitespace-nowrap",
        hint ? "cursor-help underline decoration-dotted underline-offset-2" : undefined,
      )}
    >
      {displayName}
      {unit ? (
        <>
          {" "}
          <span className="text-micro font-normal text-faint">{unit}</span>
        </>
      ) : null}
    </span>
  );
  return hint ? <Tooltip content={hint}>{label}</Tooltip> : label;
}

type Padding = { paddingLeft?: string; paddingRight?: string };

function mergeCellStyle<TData>(
  style: ColDef<TData>["cellStyle"],
  padding: Padding,
): ColDef<TData>["cellStyle"] {
  if (!padding.paddingLeft && !padding.paddingRight) return style;
  if (typeof style === "function") {
    const fn: CellStyleFunc<TData> = (params) => ({ ...padding, ...(style(params) ?? {}) });
    return fn;
  }
  return { ...padding, ...(style ?? {}) } as CellStyle;
}

function mergeHeaderStyle<TData>(
  style: ColDef<TData>["headerStyle"],
  padding: Padding,
): ColDef<TData>["headerStyle"] {
  if (!padding.paddingLeft && !padding.paddingRight) return style;
  if (typeof style === "function") {
    const fn: HeaderStyleFunc<TData> = (params) => ({ ...padding, ...(style(params) ?? {}) });
    return fn;
  }
  return { ...padding, ...(style ?? {}) } as HeaderStyle;
}

function toColDef<TData>(column: DataGridColumn<TData>, index: number, count: number): ColDef<TData> {
  const { headerUnit, headerHint, headerHidden, align, padding, ...colDef } = column;
  const start = padding?.start ?? (index === 0 ? EDGE_PADDING : undefined);
  const end = padding?.end ?? (index === count - 1 ? EDGE_PADDING : undefined);
  const pad: Padding = {
    ...(start === undefined ? {} : { paddingLeft: `${start}px` }),
    ...(end === undefined ? {} : { paddingRight: `${end}px` }),
  };
  const labelParams: HeaderLabelParams = { unit: headerUnit, hint: headerHint, hidden: headerHidden };
  return {
    ...colDef,
    type: align === "right" ? "rightAligned" : colDef.type,
    headerComponentParams: {
      ...colDef.headerComponentParams,
      innerHeaderComponent: DataGridHeaderLabel,
      innerHeaderComponentParams: labelParams,
    },
    cellStyle: mergeCellStyle(colDef.cellStyle, pad),
    headerStyle: mergeHeaderStyle(colDef.headerStyle, pad),
  };
}
