"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GridApi, GridReadyEvent } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Bot, User } from "lucide-react";

import { DataGrid, type DataGridColumn, type DataGridFeature } from "@/components/ui/data-grid";
import { GridEmptyOverlay, SelectFloatingFilter, type EmptyOverlayParams } from "@/components/ui/data-grid-features";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { usePrefersReducedMotion } from "@/components/viz";
import { format, getMarketDefinition, type ActivityEntry, type BidUpdatedEntry, type MarketId } from "@/lib/tender";
import { useTenderSelector } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

const FEATURES: DataGridFeature[] = ["transactions", "textFilter", "tooltips"];
const ROW_HEIGHT = 44;
/** Up to six rows the grid grows with its rows; beyond that it keeps this height and older bids scroll inside. */
const VISIBLE_ROWS = 6;
const SCROLL_HEIGHT = 43 + 41 + VISIBLE_ROWS * ROW_HEIGHT + 2;
const EMPTY_BODY_HEIGHT = 140;

interface BidRow {
  id: string;
  at: number;
  providerId: string;
  providerName: string;
  logo: string;
  from: number;
  to: number;
  /** Relative change, e.g. -0.1 for a 10% cut. */
  change: number;
  source: "agent" | "you";
  reason: string;
}

const getRowId = (row: BidRow) => row.id;

const isBidUpdate = (entry: ActivityEntry): entry is BidUpdatedEntry => entry.kind === "bid-updated";

function toRow(entry: BidUpdatedEntry): BidRow {
  const provider = getMarketDefinition(entry.marketId).providers.find((p) => p.id === entry.providerId);
  return {
    id: entry.id,
    at: entry.at,
    providerId: entry.providerId,
    providerName: provider?.name ?? entry.providerId,
    logo: provider?.logo ?? "",
    from: entry.from,
    to: entry.to,
    change: entry.from ? (entry.to - entry.from) / entry.from : 0,
    source: entry.agent ? "agent" : "you",
    reason: entry.agent?.reason ?? "Edited in Provider conditions.",
  };
}

type CellProps = CustomCellRendererProps<BidRow>;

/**
 * Every bid change in the market, newest first: bidding-agent rounds and your own edits. Rows arrive as
 * AG Grid transactions (`applyTransaction({ add, addIndex: 0 })`), so earlier rows stay put and the new
 * ones slide in and flash. Past six rows the grid stops growing and virtualises the rest.
 */
export function BidHistoryGrid({ marketId }: { marketId: MarketId }) {
  const reduceMotion = usePrefersReducedMotion();
  const definition = getMarketDefinition(marketId);
  const activity = useTenderSelector((state) => state.markets[marketId]?.activity);
  const rows = useMemo(() => (activity ?? []).filter(isBidUpdate).map(toRow), [activity]);

  // The grid gets the first rows once; every later change is a transaction.
  const [initialRows] = useState(rows);
  const shown = useRef(new Set(initialRows.map((row) => row.id)));
  const [api, setApi] = useState<GridApi<BidRow> | null>(null);
  const [count, setCount] = useState(initialRows.length);

  useEffect(() => {
    if (!api || api.isDestroyed()) return;
    const current = new Set(rows.map((row) => row.id));
    const add = rows.filter((row) => !shown.current.has(row.id));
    const remove = [...shown.current].filter((id) => !current.has(id)).map((id) => ({ id }) as BidRow);
    if (!add.length && !remove.length) return;
    const result = api.applyTransaction({ add, addIndex: 0, remove });
    for (const row of add) shown.current.add(row.id);
    for (const row of remove) shown.current.delete(row.id);
    setCount(shown.current.size);
    if (result?.add.length) {
      api.flashCells({ rowNodes: result.add, flashDuration: reduceMotion ? 1200 : 300, fadeDuration: reduceMotion ? 0 : 1200 });
    }
  }, [api, rows, reduceMotion]);

  const onGridReady = useCallback((event: GridReadyEvent<BidRow>) => setApi(event.api), []);

  const columns = useMemo<DataGridColumn<BidRow>[]>(
    () => [
      {
        colId: "time",
        headerName: "Time",
        width: 128,
        sortable: true,
        valueGetter: ({ data }) => data?.at ?? null,
        cellRenderer: ({ data }: CellProps) =>
          data ? <span className="text-foreground tabular-nums">{format.time(data.at, definition.timeZone, { seconds: true })}</span> : null,
      },
      {
        colId: "provider",
        headerName: "Provider",
        width: 184,
        sortable: true,
        valueGetter: ({ data }) => data?.providerName ?? null,
        filter: "agTextColumnFilter",
        filterParams: { filterOptions: ["equals"], maxNumConditions: 1 },
        floatingFilter: true,
        floatingFilterComponent: SelectFloatingFilter,
        floatingFilterComponentParams: {
          kind: "text",
          allLabel: "All providers",
          options: definition.providers.map((provider) => ({ value: provider.name, label: provider.name, image: provider.logo || undefined })),
        },
        suppressFloatingFilterButton: true,
        suppressHeaderFilterButton: true,
        cellRenderer: ({ data }: CellProps) =>
          data ? (
            <span className="flex min-w-0 items-center gap-2">
              <ProviderLogo src={data.logo} name={data.providerName} size={16} />
              <span className="truncate text-foreground">{data.providerName}</span>
            </span>
          ) : null,
      },
      {
        colId: "bid",
        headerName: "Bid",
        headerUnit: definition.units.price,
        align: "right",
        width: 152,
        sortable: true,
        valueGetter: ({ data }) => data?.to ?? null,
        cellRenderer: ({ data }: CellProps) =>
          data ? (
            <span className="tabular-nums">
              <span className="text-muted-foreground">{format.price(data.from)} → </span>
              <span className="text-foreground">{format.price(data.to)}</span>
            </span>
          ) : null,
        context: { csv: (row: BidRow) => row.to },
      },
      {
        colId: "change",
        headerName: "Change",
        align: "right",
        width: 96,
        sortable: true,
        valueGetter: ({ data }) => data?.change ?? null,
        cellRenderer: ({ data }: CellProps) =>
          data ? (
            <span className={cn("tabular-nums", data.change < 0 ? "text-positive-text" : data.change > 0 ? "text-warning-text" : "text-muted-foreground")}>
              {data.change > 0 ? "+" : data.change < 0 ? "\u2212" : ""}
              {Math.abs(data.change * 100).toFixed(1)}%
            </span>
          ) : null,
      },
      {
        colId: "source",
        headerName: "By",
        width: 132,
        valueGetter: ({ data }) => data?.source ?? null,
        cellRenderer: ({ data }: CellProps) =>
          data ? (
            <span className="flex items-center gap-1.5 text-foreground">
              {data.source === "agent" ? (
                <Bot aria-hidden="true" className="size-3.5 text-muted-foreground" />
              ) : (
                <User aria-hidden="true" className="size-3.5 text-muted-foreground" />
              )}
              {data.source === "agent" ? "Bidding agent" : "You"}
            </span>
          ) : null,
      },
      {
        colId: "reason",
        headerName: "Reason",
        flex: 1,
        minWidth: 240,
        valueGetter: ({ data }) => data?.reason ?? null,
        tooltip: true,
        cellRenderer: ({ data }: CellProps) => (data ? <span className="block truncate text-muted-foreground">{data.reason}</span> : null),
      },
    ],
    [definition],
  );

  const overlayParams = useMemo<EmptyOverlayParams>(
    () => ({ title: "No bid changes yet", description: "Select Rebid now, or edit a bid in Provider conditions." }),
    [],
  );

  return (
    <DataGrid<BidRow>
      aria-label={`${definition.name} bid history`}
      data-slot="bid-history"
      features={FEATURES}
      density="tight"
      rowData={initialRows}
      columnDefs={columns}
      getRowId={getRowId}
      domLayout={count > VISIBLE_ROWS ? "normal" : "autoHeight"}
      height={count > VISIBLE_ROWS ? SCROLL_HEIGHT : undefined}
      minBodyHeight={count === 0 ? EMPTY_BODY_HEIGHT : undefined}
      reserveHeight={`${43 + 41 + (count === 0 ? EMPTY_BODY_HEIGHT : Math.min(count, VISIBLE_ROWS) * ROW_HEIGHT) + 2}px`}
      floatingFiltersHeight={40}
      autoSizeStrategy={null}
      animateRows={!reduceMotion}
      tooltipShowMode="whenTruncated"
      suppressNoRowsOverlay={false}
      overlayComponent={GridEmptyOverlay}
      overlayComponentParams={overlayParams}
      onGridReady={onGridReady}
    />
  );
}
