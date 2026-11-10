"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type {
  GridApi,
  GridReadyEvent,
  IsFullWidthRowParams,
  RowClickedEvent,
  RowHeightParams,
  RowSelectionOptions,
  SortComparatorFn,
  SortDirection as GridSortDirection,
} from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Check, Pin, X } from "lucide-react";

import { badgeVariants, Badge, StatusDot } from "@/components/ui/badge";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { TableValue } from "@/components/ui/table";
import { InfoTooltip, Tooltip } from "@/components/ui/tooltip";
import { Sparkline, SuccessBars, usePrefersReducedMotion, type SparklineTone } from "@/components/viz";
import { format, type MarketView, type ProviderRow } from "@/lib/tender";
import { usePendingSwitch } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import { ProviderRowMenu } from "./provider-row-menu";
import {
  compareGridRows,
  defaultDirection,
  failingMetrics,
  metricReason,
  providerGridRows,
  providerTags,
  providerTrend,
  routeLabel,
  statusTone,
  successSamples,
  trendScale,
  valueParts,
  type MetricKey,
  type ProviderGridRow,
  type SignalTone,
  type SortKey,
} from "./provider-table-model";

const FLASH_MS = 1600;
/** Row heights in px: provider rows, and the "Excluded by your policy" divider. */
const ROW_HEIGHT = 44;
const DIVIDER_HEIGHT = 29;
const HEADER_HEIGHT = 43;
/** Width of the pinned provider column on small screens (OpenRouter's `max-w-44`). */
const PINNED_PROVIDER_WIDTH = 176;

const TINT: Record<SignalTone, string> = {
  warning: "text-warning-text",
  negative: "text-negative-text",
};

export interface ProvidersTableProps {
  view: MarketView;
  selectedId: string | null;
  onSelect: (providerId: string | null) => void;
}

interface ProvidersGridContextValue {
  view: MarketView;
  selectedId: string | null;
  onSelect: (providerId: string | null) => void;
}

/** Cell renderers live inside the grid; React context gives them the market view and the selection. */
const ProvidersGridContext = createContext<ProvidersGridContextValue | null>(null);

function useProvidersGrid(): ProvidersGridContextValue {
  const value = useContext(ProvidersGridContext);
  if (!value) throw new Error("Provider cells must render inside ProvidersTable");
  return value;
}

const getRowId = (row: ProviderGridRow) => row.id;

const isFullWidthRow = (params: IsFullWidthRowParams<ProviderGridRow>) => params.rowNode.data?.kind === "divider";

const getRowHeight = (params: RowHeightParams<ProviderGridRow>) =>
  params.data?.kind === "divider" ? DIVIDER_HEIGHT : undefined;

const ROW_SELECTION: RowSelectionOptions<ProviderGridRow> = {
  mode: "singleRow",
  checkboxes: false,
  enableClickSelection: false,
  isRowSelectable: (node) => node.data?.kind === "provider",
};

/** Header click order: natural direction (cheapest, fastest, freshest, most reliable, A–Z), reversed, routing order. */
function sortingOrder(key: SortKey): GridSortDirection[] {
  const first = defaultDirection(key);
  return [first, first === "asc" ? "desc" : "asc", null];
}

function comparator(key: SortKey): SortComparatorFn<ProviderGridRow> {
  return (_a, _b, nodeA, nodeB, isDescending) =>
    nodeA.data && nodeB.data ? compareGridRows(nodeA.data, nodeB.data, key, isDescending) : 0;
}

function sortable(key: SortKey): Pick<DataGridColumn<ProviderGridRow>, "sortable" | "comparator" | "sortingOrder"> {
  return { sortable: true, comparator: comparator(key), sortingOrder: sortingOrder(key) };
}

const MD_QUERY = "(min-width: 48rem)";

function subscribeMd(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(MD_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** `md` and up. The grid renders on the client only, so the server value is never shown. */
function useIsMdUp(): boolean {
  return useSyncExternalStore(
    subscribeMd,
    () => typeof window.matchMedia !== "function" || window.matchMedia(MD_QUERY).matches,
    () => true,
  );
}

function providerColumns(priceUnit: ReactNode, mdUp: boolean): DataGridColumn<ProviderGridRow>[] {
  return [
    {
      colId: "name",
      headerName: "Provider",
      cellRenderer: ProviderCell,
      ...sortable("name"),
      // Small screens: the provider column stays in view while the metrics scroll, and tags wrap under the name.
      ...(mdUp
        ? { pinned: null, autoHeight: false }
        : {
            pinned: "left" as const,
            width: PINNED_PROVIDER_WIDTH,
            minWidth: PINNED_PROVIDER_WIDTH,
            maxWidth: PINNED_PROVIDER_WIDTH,
            suppressAutoSize: true,
            suppressSizeToFit: true,
            autoHeight: true,
          }),
    },
    {
      colId: "bid",
      headerName: "Bid",
      headerUnit: priceUnit,
      headerHint: "What the provider bids to serve this contract, in USD per 1M requests.",
      align: "right",
      ...sortable("bid"),
      // A bid edit flashes the cell.
      valueGetter: (params) => (params.data?.kind === "provider" ? params.data.row.conditions.bidPrice : null),
      enableCellChangeFlash: true,
      cellRenderer: BidCell,
    },
    {
      colId: "latency",
      headerName: "P95",
      headerHint: "95th-percentile request latency, as the monitor measures it now.",
      align: "right",
      ...sortable("latency"),
      cellRenderer: LatencyCell,
    },
    {
      colId: "dataAge",
      headerName: "Data age",
      headerHint: "Age of the data when the response is sent. This is freshness, not request latency.",
      align: "right",
      ...sortable("dataAge"),
      cellRenderer: DataAgeCell,
    },
    {
      colId: "success",
      headerName: "Success",
      headerHint: "Share of requests that succeed. Bars show the last three monitor samples.",
      align: "right",
      ...sortable("success"),
      cellRenderer: SuccessCell,
    },
    {
      colId: "trend",
      headerName: "Trend",
      headerHint:
        "Last 30 monitor samples of the metric that decides this row: the failing check, or the one your preference ranks on. Dashed line: your limit.",
      cellRenderer: TrendCell,
    },
    {
      colId: "status",
      headerName: "Status",
      headerHint: "Qualification against your routing policy. Focus or hover a status to see every check.",
      cellRenderer: StatusCell,
    },
    {
      colId: "route",
      headerName: "Route",
      headerHint: "Active serves requests now. Standby providers qualify and take over in rank order.",
      cellRenderer: RouteCell,
    },
    {
      colId: "actions",
      headerName: "Actions",
      headerHidden: true,
      padding: { start: 4, end: 8 },
      suppressSizeToFit: true,
      cellRenderer: ActionsCell,
    },
  ];
}

/**
 * OpenRouter's provider table adapted to bids, on AG Grid: routed providers
 * first (active, then qualified by rank), a muted "Excluded by your policy"
 * divider, then the excluded rows with their failing metric tinted. Numeric
 * columns sort inside each group. Rows are keyed by provider id, so a route
 * switch or a failover moves rows (animated) instead of redrawing them, and
 * the new active row flashes once.
 */
export function ProvidersTable({ view, selectedId, onSelect }: ProvidersTableProps) {
  const reduceMotion = usePrefersReducedMotion();
  const mdUp = useIsMdUp();
  const [api, setApi] = useState<GridApi<ProviderGridRow> | null>(null);

  const rowData = useMemo(() => providerGridRows(view.providers), [view.providers]);
  const priceUnit = view.definition.units.price;
  const columns = useMemo(() => providerColumns(priceUnit, mdUp), [priceUnit, mdUp]);
  const context = useMemo(() => ({ view, selectedId, onSelect }), [view, selectedId, onSelect]);

  const onGridReady = useCallback((event: GridReadyEvent<ProviderGridRow>) => setApi(event.api), []);
  const onRowClicked = useCallback(
    (event: RowClickedEvent<ProviderGridRow>) => {
      const data = event.data;
      if (data?.kind !== "provider") return;
      onSelect(selectedId === data.id ? null : data.id);
    },
    [onSelect, selectedId],
  );

  useSyncedSelection(api, selectedId, rowData);
  useActiveRowFlash(api, view, reduceMotion);

  const providerCount = rowData.filter((row) => row.kind === "provider").length;
  const tagRows = rowData.filter((row) => row.kind === "provider" && providerTags(row.row).length > 0).length;
  const dividers = rowData.length - providerCount;
  const reserveHeight = `calc(${HEADER_HEIGHT + providerCount * ROW_HEIGHT + dividers * DIVIDER_HEIGHT + 2}px + ${tagRows} * var(--tag-row-extra, 0px))`;

  return (
    <ProvidersGridContext.Provider value={context}>
      <DataGrid<ProviderGridRow>
        aria-label={`${view.definition.name} providers`}
        data-slot="providers-table"
        density="tight"
        rowData={rowData}
        columnDefs={columns}
        getRowId={getRowId}
        rowSelection={ROW_SELECTION}
        isFullWidthRow={isFullWidthRow}
        fullWidthCellRenderer={ExcludedDivider}
        getRowHeight={getRowHeight}
        animateRows={!reduceMotion}
        onGridReady={onGridReady}
        onRowClicked={onRowClicked}
        reserveHeight={reserveHeight}
        // Small screens: rows with tags are taller (the tags wrap under the name).
        className="max-md:[--tag-row-extra:27px]"
      />
    </ProvidersGridContext.Provider>
  );
}

/** Keep the grid's row selection (the selected-row wash) in step with the selected provider. */
function useSyncedSelection(api: GridApi<ProviderGridRow> | null, selectedId: string | null, rowData: readonly ProviderGridRow[]) {
  useEffect(() => {
    if (!api || api.isDestroyed()) return;
    const select = selectedId ? api.getRowNode(selectedId) : undefined;
    if (select) {
      if (!select.isSelected()) select.setSelected(true, true, "api");
    } else {
      api.deselectAll();
    }
  }, [api, selectedId, rowData]);
}

/** Flash the row that just became active (lime wash; lime is a fill only, the row text stays ink). */
function useActiveRowFlash(api: GridApi<ProviderGridRow> | null, view: MarketView, reduceMotion: boolean) {
  const activeId = view.route.activeProviderId;
  const previous = useRef<{ marketId: string; activeId: string | null } | null>(null);
  useEffect(() => {
    const prev = previous.current;
    previous.current = { marketId: view.id, activeId };
    if (!api || api.isDestroyed() || !prev || prev.marketId !== view.id || prev.activeId === activeId || !activeId) return;
    const node = api.getRowNode(activeId);
    if (!node) return;
    api.flashCells({
      rowNodes: [node],
      flashDuration: reduceMotion ? FLASH_MS : 150,
      fadeDuration: reduceMotion ? 0 : FLASH_MS - 150,
    });
  }, [api, view.id, activeId, reduceMotion]);
}

type CellProps = CustomCellRendererProps<ProviderGridRow>;

function providerOf(props: CellProps): ProviderRow | null {
  return props.data?.kind === "provider" ? props.data.row : null;
}

function ExcludedDivider({ data }: CellProps) {
  if (data?.kind !== "divider") return null;
  return (
    <div
      data-slot="excluded-divider"
      className="flex h-full items-center gap-1.5 bg-muted px-4 text-caption font-medium text-muted-foreground"
    >
      Excluded by your policy ({data.count})
      <InfoTooltip
        label="Why providers are excluded"
        iconSize={12}
        content="These providers fail at least one requirement in your routing policy. Automatic routing never sends them requests."
      />
    </div>
  );
}

function ProviderCell(props: CellProps) {
  const { selectedId } = useProvidersGrid();
  const row = providerOf(props);
  if (!row) return null;
  const excluded = row.role === "excluded";
  const selected = selectedId === row.id;
  return (
    <div
      data-provider={row.id}
      data-role={row.role}
      data-status={row.status}
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 whitespace-normal max-md:py-[9.5px]",
        excluded ? "font-normal text-muted-foreground" : "font-medium text-foreground",
      )}
    >
      {selected ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-primary-strong" />
      ) : null}
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${row.name}, select to inspect`}
        className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-sm text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ProviderLogo src={row.logo} name={row.name} className={cn(excluded && "opacity-75")} />
        <span className={cn("truncate text-xs whitespace-nowrap", excluded ? "text-muted-foreground" : "text-foreground")}>
          {row.name}
        </span>
      </button>
      <ProviderTags row={row} />
    </div>
  );
}

function metricCell(props: CellProps) {
  const row = providerOf(props);
  const failing = row ? failingMetrics(row) : {};
  const tint = (metric: MetricKey) => {
    const tone = failing[metric];
    return tone ? TINT[tone] : undefined;
  };
  const reasonTooltip = (metric: MetricKey, node: ReactNode) => {
    const reason = row ? metricReason(row, metric) : null;
    if (!reason) return node;
    return (
      <Tooltip content={reason}>
        <span className="cursor-help underline decoration-current/40 decoration-dotted underline-offset-2">{node}</span>
      </Tooltip>
    );
  };
  return { row, failing, tint, reasonTooltip, excluded: row?.role === "excluded" };
}

function BidCell(props: CellProps) {
  const { row, tint, reasonTooltip, excluded } = metricCell(props);
  if (!row) return null;
  return <BidValue row={row} muted={excluded} tintClass={tint("bid")} wrap={(node) => reasonTooltip("bid", node)} />;
}

function LatencyCell(props: CellProps) {
  const { row, tint, reasonTooltip, excluded } = metricCell(props);
  if (!row) return null;
  return reasonTooltip(
    "latency",
    <PartsValue text={format.latency(row.conditions.p95LatencyMs)} muted={excluded} tintClass={tint("latency")} />,
  );
}

function DataAgeCell(props: CellProps) {
  const { row, tint, reasonTooltip, excluded } = metricCell(props);
  if (!row) return null;
  return reasonTooltip(
    "dataAge",
    <PartsValue text={format.dataAge(row.conditions.dataAgeMs)} muted={excluded} tintClass={tint("dataAge")} />,
  );
}

function SuccessCell(props: CellProps) {
  const { view } = useProvidersGrid();
  const { row, failing, excluded } = metricCell(props);
  if (!row) return null;
  return (
    <SuccessBars
      values={successSamples(row)}
      threshold={view.policy.minSuccessRate}
      label={row.conditions.available ? format.percent(row.successRate) : "–"}
      ariaLabel={
        row.conditions.available
          ? `Success rate ${format.percent(row.successRate)}`
          : "No successful requests: the provider is not responding"
      }
      className={cn("tabular-nums [&>span]:w-14", excluded && !failing.success && "[&>span]:text-muted-foreground")}
    />
  );
}

function TrendCell(props: CellProps) {
  const { view } = useProvidersGrid();
  const row = providerOf(props);
  if (!row) return null;
  const trend = providerTrend(row, view.policy);
  const tone: SparklineTone =
    row.role === "pinned-failing" ? "negative" : row.isActive ? "active" : row.role === "excluded" ? "muted" : "neutral";
  return (
    <Tooltip content={trend.description}>
      <span className="flex w-fit cursor-help">
        <Sparkline
          values={trend.values}
          limit={trend.limit}
          tone={tone}
          width={60}
          height={22}
          {...trendScale(trend)}
          ariaLabel={trend.description}
        />
      </span>
    </Tooltip>
  );
}

function StatusCell(props: CellProps) {
  const row = providerOf(props);
  return row ? <StatusBadge row={row} /> : null;
}

function RouteCell(props: CellProps) {
  const { view } = useProvidersGrid();
  const row = providerOf(props);
  if (!row) return null;
  return row.isPendingTarget ? <PendingRouteText marketId={view.id} /> : <RouteText route={routeLabel(row)} />;
}

function ActionsCell(props: CellProps) {
  const { view, onSelect } = useProvidersGrid();
  const row = providerOf(props);
  if (!row) return null;
  return (
    // The menu opens without selecting the row.
    <div data-grid-ignore-click="" className="flex justify-end">
      <ProviderRowMenu marketId={view.id} row={row} mode={view.policy.mode} onSelect={onSelect} />
    </div>
  );
}

function ProviderTags({ row }: { row: ProviderRow }) {
  const tags = providerTags(row);
  if (!tags.length) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      {tags.map((tag) => {
        switch (tag) {
          case "active":
            return (
              <Badge key={tag} tone="active" data-tag="active">
                Active
              </Badge>
            );
          case "pinned":
            return (
              <Badge key={tag} tone={row.role === "pinned-failing" ? "negative" : "active"} icon={<Pin aria-hidden="true" />} data-tag="pinned">
                Pinned
              </Badge>
            );
          case "best-price":
            return (
              <span key={tag} className="shrink-0 text-xs font-medium text-positive-text" data-tag="best-price">
                Best price
              </span>
            );
        }
      })}
    </span>
  );
}

function PartsValue({ text, muted, tintClass }: { text: string; muted: boolean; tintClass?: string }) {
  return (
    <span className={cn("tabular-nums", tintClass ?? (muted ? "text-muted-foreground" : "text-foreground"))}>
      {valueParts(text).map((part, i) =>
        part.unit ? (
          <span key={i} className={tintClass ? undefined : "text-muted-foreground"}>
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function BidValue({
  row,
  muted,
  tintClass,
  wrap,
}: {
  row: ProviderRow;
  muted: boolean;
  tintClass?: string;
  wrap: (node: ReactNode) => ReactNode;
}) {
  const changed = row.modifiedFields.includes("bidPrice");
  const lowered = changed && row.conditions.bidPrice < row.defaults.bidPrice;
  const value = (
    <TableValue
      muted={muted}
      className={cn(tintClass ?? (lowered && !muted ? "text-positive-text" : undefined))}
    >
      {format.price(row.conditions.bidPrice)}
    </TableValue>
  );
  if (!changed) return <>{wrap(value)}</>;
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-2xs text-muted-foreground tabular-nums line-through" aria-label={`was ${format.price(row.defaults.bidPrice)}`}>
        {format.price(row.defaults.bidPrice)}
      </span>
      {wrap(value)}
    </span>
  );
}

function StatusBadge({ row }: { row: ProviderRow }) {
  const failing = row.evaluation.reasons;
  const label = failing.length
    ? `${row.statusLabel}. ${failing.map((r) => r.message).join(". ")}.`
    : `${row.statusLabel}. Meets every requirement.`;
  const passing = row.evaluation.checks.filter((c) => c.passed && c.check !== "availability");
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-1 py-0.5">
          <p className="font-medium text-foreground">
            {failing.length
              ? `Excluded: ${failing.length} ${failing.length === 1 ? "check fails" : "checks fail"}`
              : "Meets your policy"}
          </p>
          <ul className="flex flex-col gap-0.5">
            {failing.map((reason) => (
              <li key={reason.check} className="flex items-center gap-1.5">
                <X aria-hidden="true" className={cn("size-3 shrink-0", statusTone(reason.status) === "negative" ? "text-negative" : "text-warning")} strokeWidth={2.5} />
                <span>{reason.message}</span>
              </li>
            ))}
            {failing.length === 0
              ? passing.map((check) => (
                  <li key={check.check} className="flex items-center gap-1.5 text-muted-foreground">
                    <Check aria-hidden="true" className="size-3 shrink-0 text-positive" strokeWidth={2.5} />
                    <span>{check.message}</span>
                  </li>
                ))
              : null}
          </ul>
        </div>
      }
    >
      <button
        type="button"
        aria-label={label}
        className={cn(
          badgeVariants({ tone: statusTone(row.status) }),
          "cursor-help border-0 outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
        data-slot="status-badge"
      >
        {row.statusLabel}
      </button>
    </Tooltip>
  );
}

function RouteText({ route }: { route: ReturnType<typeof routeLabel> }) {
  switch (route.tone) {
    case "active":
      return (
        <span className="flex w-fit items-center gap-1.5 font-medium text-accent-foreground">
          <StatusDot tone="active" size="sm" pulse />
          {route.text}
        </span>
      );
    case "negative":
      return (
        <span className="flex w-fit items-center gap-1.5 font-medium text-negative-text">
          <StatusDot tone="negative" size="sm" />
          {route.text}
        </span>
      );
    case "warning":
      return <span className="text-warning-text">{route.text}</span>;
    case "neutral":
      return (
        <span className="text-muted-foreground">
          <span className="sr-only">Rank </span>
          {route.text}
        </span>
      );
    case "faint":
      return <span className="text-faint">{route.text}</span>;
  }
}

function PendingRouteText({ marketId }: { marketId: MarketView["id"] }) {
  const pending = usePendingSwitch(marketId);
  return (
    <span className="flex w-fit items-center gap-1.5 text-warning-text tabular-nums">
      <StatusDot tone="warning" size="sm" />
      {pending ? `Next in ${pending.secondsRemaining} s` : "Next route"}
    </span>
  );
}
