"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CellKeyDownEvent,
  FilterChangedEvent,
  FilterModel,
  GridApi,
  GridReadyEvent,
  IRowNode,
  NumberFilterModel,
  RowClickedEvent,
  SortComparatorFn,
  SortDirection as GridSortDirection,
} from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Pin } from "lucide-react";

import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import {
  COLUMN_STATE_MODULES,
  EXPORT_MODULES,
  FILTER_MODULES,
  GridEmptyOverlay,
  LimitFloatingFilter,
  type EmptyOverlayParams,
  type LimitFloatingFilterParams,
} from "@/components/ui/data-grid-features";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { Tooltip } from "@/components/ui/tooltip";
import { Sparkline, SuccessBars, usePrefersReducedMotion } from "@/components/viz";
import { format, PRICE_UNIT } from "@/lib/tender";
import { cn } from "@/lib/utils";

import {
  compareRows,
  passesSidebar,
  sidebarActive,
  type DirectoryLimits,
  type DirectoryQuery,
  type DirectoryRow,
  type DirectorySort,
  type SortColumn,
} from "./directory-model";
import { MarketThumbnail } from "./market-thumbnail";

const MODULES = [...FILTER_MODULES, ...EXPORT_MODULES, ...COLUMN_STATE_MODULES];

const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 43;
const FLOATING_FILTER_HEIGHT = 41;
const PINNED_MARKET_WIDTH = 188;

/** From `xl` every column fits beside the sidebar; below it the market column stays pinned while the rest scrolls. */
const WIDE_QUERY = "(min-width: 80rem)";
const subscribeWide = (onChange: () => void) => {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
/** The grid renders on the client, so the server value never shows. */
const useIsWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true);

const getRowId = (row: DirectoryRow) => row.id;

type CellProps = CustomCellRendererProps<DirectoryRow>;

function comparator(column: SortColumn): SortComparatorFn<DirectoryRow> {
  return (_a, _b, nodeA, nodeB, descending) => (nodeA.data && nodeB.data ? compareRows(nodeA.data, nodeB.data, column, descending) : 0);
}

/** Header click order: the useful direction first, then the other, then Recommended. */
function sortable(column: SortColumn, first: "asc" | "desc"): Partial<DataGridColumn<DirectoryRow>> {
  const order: GridSortDirection[] = [first, first === "asc" ? "desc" : "asc", null];
  return { sortable: true, comparator: comparator(column), sortingOrder: order };
}

function limitFilter(params: LimitFloatingFilterParams): Partial<DataGridColumn<DirectoryRow>> {
  return {
    filter: "agNumberColumnFilter",
    filterParams: { filterOptions: [params.bound === "max" ? "lessThanOrEqual" : "greaterThanOrEqual"], maxNumConditions: 1 },
    floatingFilter: true,
    floatingFilterComponent: LimitFloatingFilter,
    floatingFilterComponentParams: params,
    suppressFloatingFilterButton: true,
    suppressHeaderFilterButton: true,
  };
}

const LIMIT_COLUMNS = { maxBid: "bid", maxP95: "p95", minSuccess: "success" } as const;

export function limitsToModel(limits: DirectoryLimits): FilterModel {
  const model: FilterModel = {};
  if (limits.maxBid !== undefined) model.bid = { filterType: "number", type: "lessThanOrEqual", filter: limits.maxBid };
  if (limits.maxP95 !== undefined) model.p95 = { filterType: "number", type: "lessThanOrEqual", filter: limits.maxP95 };
  if (limits.minSuccess !== undefined) model.success = { filterType: "number", type: "greaterThanOrEqual", filter: limits.minSuccess };
  return model;
}

function modelToLimits(model: FilterModel): DirectoryLimits {
  const read = (colId: string) => {
    const value = (model[colId] as NumberFilterModel | undefined)?.filter;
    return typeof value === "number" ? value : undefined;
  };
  return { maxBid: read(LIMIT_COLUMNS.maxBid), maxP95: read(LIMIT_COLUMNS.maxP95), minSuccess: read(LIMIT_COLUMNS.minSuccess) };
}

const sameLimits = (a: DirectoryLimits, b: DirectoryLimits) =>
  a.maxBid === b.maxBid && a.maxP95 === b.maxP95 && a.minSuccess === b.minSuccess;

function columnsFor(wide: boolean): DataGridColumn<DirectoryRow>[] {
  return [
    {
      colId: "market",
      headerName: "Market",
      valueGetter: ({ data }) => data?.name,
      getQuickFilterText: ({ data }) => data?.searchText ?? "",
      cellRenderer: MarketCell,
      ...sortable("market", "asc"),
      ...(wide
        ? { pinned: null, flex: 1, minWidth: 200 }
        : {
            pinned: "left" as const,
            width: PINNED_MARKET_WIDTH,
            minWidth: PINNED_MARKET_WIDTH,
            maxWidth: PINNED_MARKET_WIDTH,
            suppressAutoSize: true,
            suppressSizeToFit: true,
          }),
      lockPinned: true,
    },
    {
      colId: "category",
      headerName: "Category",
      valueGetter: ({ data }) => data?.categoryLabel,
      cellRenderer: CategoryCell,
      context: { csv: (row: DirectoryRow) => `${row.groupLabel} / ${row.categoryLabel}` },
      // Hidden: the sidebar filters by category and the search matches it; the CSV keeps it.
      hide: true,
    },
    {
      colId: "active",
      headerName: "Active provider",
      width: 148,
      headerHint: "The provider that serves requests now. It flashes when the route switches.",
      valueGetter: ({ data }) => data?.activeProviderName ?? null,
      enableCellChangeFlash: true,
      cellRenderer: ActiveCell,
      ...sortable("active", "asc"),
    },
    {
      colId: "bid",
      headerName: "Winning bid",
      headerHint: `The active provider's bid, in USD per 1M requests (${PRICE_UNIT}). Bidding agents and your edits move it.`,
      align: "right",
      width: 112,
      valueGetter: ({ data }) => data?.bid ?? null,
      enableCellChangeFlash: true,
      cellRenderer: BidCell,
      context: { csvUnit: "USD per 1M requests" },
      ...sortable("bid", "asc"),
      ...limitFilter({ bound: "max", prefix: "$", unit: "/M", placeholder: "Any" }),
    },
    {
      colId: "p95",
      headerName: "P95",
      headerHint: "95th-percentile latency of the active provider, measured every 5 s.",
      align: "right",
      width: 96,
      cellClass: "tender-live",
      valueGetter: ({ data }) => data?.p95 ?? null,
      enableCellChangeFlash: true,
      cellRenderer: LatencyCell,
      context: { csvUnit: "ms" },
      ...sortable("p95", "asc"),
      ...limitFilter({ bound: "max", unit: "ms", placeholder: "Any" }),
    },
    {
      colId: "dataAge",
      headerName: "Data age",
      headerHint: "Age of the active provider's data when it responds, measured every 5 s.",
      align: "right",
      width: 96,
      cellClass: "tender-live",
      valueGetter: ({ data }) => data?.dataAge ?? null,
      enableCellChangeFlash: true,
      cellRenderer: DataAgeCell,
      context: { csvUnit: "ms" },
      ...sortable("dataAge", "asc"),
    },
    {
      colId: "success",
      headerName: "Success",
      headerHint: "Share of the active provider's requests that succeed. Bars show the last three samples.",
      align: "right",
      width: 112,
      cellClass: "tender-live",
      valueGetter: ({ data }) => data?.success ?? null,
      enableCellChangeFlash: true,
      cellRenderer: SuccessCell,
      context: { csv: (row: DirectoryRow) => (row.success === null ? null : Math.round(row.success * 10_000) / 100), csvUnit: "%" },
      ...sortable("success", "desc"),
      ...limitFilter({
        bound: "min",
        unit: "%",
        placeholder: "Any",
        toModel: (display) => Math.min(1, display / 100),
        toDisplay: (value) => value * 100,
      }),
    },
    {
      colId: "providers",
      headerName: "Providers",
      width: 98,
      headerHint: "Providers that meet the routing policy, of all providers in the market.",
      align: "right",
      valueGetter: ({ data }) => data?.providerCount ?? null,
      cellRenderer: ProvidersCell,
      ...sortable("providers", "desc"),
    },
    {
      colId: "trend",
      headerName: "Trend",
      width: 84,
      headerHint: "The active provider's P95 over the last 30 monitor samples (2.5 min).",
      valueGetter: ({ data }) => data?.sampledAt ?? null,
      cellRenderer: TrendCell,
      context: { csv: false },
    },
  ];
}

export interface DirectoryGridProps {
  /** Every market (the grid filters them). */
  rows: readonly DirectoryRow[];
  query: DirectoryQuery;
  /** Rows the query keeps (the grid shows the same set), to reserve height before the grid draws. */
  visibleCount: number;
  onSortChange: (sort: DirectorySort | null) => void;
  onLimitsChange: (limits: DirectoryLimits) => void;
  onClear: () => void;
  onApi: (api: GridApi<DirectoryRow> | null) => void;
}

/**
 * The directory's table view on AG Grid. The page's query is the single source of truth: the search box is
 * the grid's quick filter, the group tabs and sidebar are its external filter, the Winning bid / P95 / Success
 * limits are Number Filters edited in floating filters, and the sort is column state. Grid-side changes
 * (header clicks, floating filters) flow back into the query, which mirrors itself in the URL.
 */
export function DirectoryGrid({ rows, query, visibleCount, onSortChange, onLimitsChange, onClear, onApi }: DirectoryGridProps) {
  const router = useRouter();
  const wide = useIsWide();
  const reduceMotion = usePrefersReducedMotion();
  const [api, setApi] = useState<GridApi<DirectoryRow> | null>(null);
  const columns = useMemo(() => columnsFor(wide), [wide]);

  const onGridReady = useCallback(
    (event: GridReadyEvent<DirectoryRow>) => {
      setApi(event.api);
      onApi(event.api);
    },
    [onApi],
  );
  useEffect(() => () => onApi(null), [onApi]);

  // Sort: the query drives the column state; a header click reports back.
  const { sort, limits } = query;
  useEffect(() => {
    if (!api || api.isDestroyed()) return;
    const current = readSort(api);
    if (current?.column === sort?.column && current?.direction === sort?.direction) return;
    api.applyColumnState({ state: sort ? [{ colId: sort.column, sort: sort.direction }] : [], defaultState: { sort: null } });
  }, [api, sort]);
  const onSortChanged = useCallback(() => {
    if (!api) return;
    const next = readSort(api);
    if (next?.column !== sort?.column || next?.direction !== sort?.direction) onSortChange(next);
  }, [api, sort, onSortChange]);

  // Column filters: the query's limits are the Number Filter models.
  useEffect(() => {
    if (!api || api.isDestroyed()) return;
    if (!sameLimits(modelToLimits(api.getFilterModel()), limits)) api.setFilterModel(limitsToModel(limits));
  }, [api, limits]);
  const onFilterChanged = useCallback(
    (event: FilterChangedEvent<DirectoryRow>) => {
      const next = modelToLimits(event.api.getFilterModel());
      if (!sameLimits(next, limits)) onLimitsChange(next);
    },
    [limits, onLimitsChange],
  );

  // External filter: new callbacks when the sidebar changes re-run it (reactive grid options).
  const { group, categories, maxFreshnessMs, minProviders } = query;
  const sidebar = useMemo(
    () => ({ ...query, group, categories, maxFreshnessMs, minProviders }),
    // Only the sidebar fields matter here; the search, sort, and limits have their own grid features.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group, categories, maxFreshnessMs, minProviders],
  );
  const isExternalFilterPresent = useCallback(() => sidebarActive(sidebar), [sidebar]);
  const doesExternalFilterPass = useCallback((node: IRowNode<DirectoryRow>) => !node.data || passesSidebar(node.data, sidebar), [sidebar]);

  const open = useCallback((row: DirectoryRow | undefined) => row && router.push(row.href), [router]);
  const onRowClicked = useCallback((event: RowClickedEvent<DirectoryRow>) => open(event.data), [open]);
  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent<DirectoryRow>) => {
      const key = (event.event as KeyboardEvent | undefined)?.key;
      if (key === "Enter") open(event.data);
    },
    [open],
  );

  const overlayParams = useMemo<EmptyOverlayParams>(
    () => ({
      title: "No markets match your filters",
      description: "Try a different search, raise a limit, or clear the filters.",
      action: { label: "Clear filters", onClick: onClear },
    }),
    [onClear],
  );

  return (
    <DataGrid<DirectoryRow>
      aria-label="Markets"
      data-slot="directory-grid"
      modules={MODULES}
      density="tight"
      rowData={rows}
      columnDefs={columns}
      getRowId={getRowId}
      cellFocus
      rowHeight={ROW_HEIGHT}
      floatingFiltersHeight={FLOATING_FILTER_HEIGHT - 1}
      // Fixed widths: live values change every 5 s inside them, and the market column takes the rest.
      autoSizeStrategy={null}
      enableFilterHandlers
      quickFilterText={query.q}
      isExternalFilterPresent={isExternalFilterPresent}
      doesExternalFilterPass={doesExternalFilterPass}
      onSortChanged={onSortChanged}
      onFilterChanged={onFilterChanged}
      onGridReady={onGridReady}
      onRowClicked={onRowClicked}
      onCellKeyDown={onCellKeyDown}
      className="[&_.ag-row]:cursor-pointer"
      animateRows={!reduceMotion}
      cellFlashDuration={reduceMotion ? 1200 : 250}
      cellFadeDuration={reduceMotion ? 0 : 900}
      loading={false}
      overlayComponent={GridEmptyOverlay}
      overlayComponentParams={overlayParams}
      minBodyHeight={visibleCount === 0 ? 168 : undefined}
      reserveHeight={`${HEADER_HEIGHT + FLOATING_FILTER_HEIGHT + Math.max(visibleCount * ROW_HEIGHT, visibleCount === 0 ? 168 : 0) + 2}px`}
    />
  );
}

function readSort(api: GridApi<DirectoryRow>): DirectorySort | null {
  const sorted = api.getColumnState().find((column) => column.sort);
  return sorted?.sort ? { column: sorted.colId as SortColumn, direction: sorted.sort } : null;
}

function MarketCell({ data }: CellProps) {
  if (!data) return null;
  return (
    <Link
      href={data.href}
      tabIndex={-1}
      data-grid-ignore-click=""
      className="flex w-full min-w-0 items-center gap-2.5 overflow-hidden text-foreground no-underline"
    >
      <MarketThumbnail image={data.image} icon={data.icon} size={32} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-xs font-medium text-foreground">{data.name}</span>
        <span className="block truncate text-caption text-faint">{data.identifier}</span>
      </span>
    </Link>
  );
}

function CategoryCell({ data }: CellProps) {
  if (!data) return null;
  return (
    <span className="min-w-0 leading-tight">
      <span className="block truncate text-foreground">{data.categoryLabel}</span>
      <span className="block truncate text-caption text-faint">{data.groupLabel}</span>
    </span>
  );
}

function ActiveCell({ data }: CellProps) {
  if (!data) return null;
  if (!data.activeProviderName) return <span className="text-warning-text">No eligible provider</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ProviderLogo src={data.activeProviderLogo} name={data.activeProviderName} size={16} />
      <span className="truncate text-foreground">{data.activeProviderName}</span>
      {data.mode === "pinned" ? (
        <Tooltip content="Pinned: requests always go to this provider.">
          <Pin aria-label="Pinned" className="size-3.5 shrink-0 text-muted-foreground" />
        </Tooltip>
      ) : null}
    </span>
  );
}

function Missing() {
  return <span className="text-faint">—</span>;
}

/** "212 ms": number in ink, unit muted. */
function UnitValue({ text }: { text: string }) {
  const index = text.lastIndexOf(" ");
  if (index <= 0) return <span className="text-foreground tabular-nums">{text}</span>;
  return (
    <span className="text-foreground tabular-nums">
      {text.slice(0, index)} <span className="text-muted-foreground">{text.slice(index + 1)}</span>
    </span>
  );
}

function BidCell({ data }: CellProps) {
  if (!data || data.bid === null) return <Missing />;
  return <span className="text-foreground tabular-nums">{format.price(data.bid)}</span>;
}

function LatencyCell({ data }: CellProps) {
  return data && data.p95 !== null ? <UnitValue text={format.latency(data.p95)} /> : <Missing />;
}

function DataAgeCell({ data }: CellProps) {
  return data && data.dataAge !== null ? <UnitValue text={format.dataAge(data.dataAge)} /> : <Missing />;
}

function SuccessCell({ data }: CellProps) {
  if (!data || data.success === null) return <Missing />;
  return (
    <SuccessBars
      values={data.successSamples.length ? data.successSamples : [data.success]}
      threshold={data.successThreshold}
      label={format.percent(data.success)}
      className="tabular-nums"
    />
  );
}

function ProvidersCell({ data }: CellProps) {
  if (!data) return null;
  return (
    <span className="tabular-nums">
      <span className="text-foreground">{data.qualifiedCount}</span>
      <span className="text-muted-foreground"> of {data.providerCount}</span>
    </span>
  );
}

function TrendCell({ data }: CellProps) {
  if (!data || data.trend.length < 2) return <Missing />;
  return (
    <Sparkline
      values={data.trend}
      width={64}
      height={20}
      tone={data.activeProviderId ? "active" : "muted"}
      ariaLabel={`P95 trend of ${data.activeProviderName ?? "the market"}, latest ${data.p95 === null ? "unknown" : format.latency(data.p95)}`}
      className={cn("shrink-0")}
    />
  );
}
