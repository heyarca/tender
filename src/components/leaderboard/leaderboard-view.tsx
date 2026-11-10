"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GridApi, GridReadyEvent } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Search } from "lucide-react";

import { PayoutStatusBadge } from "@/components/payouts/payout-status-badge";
import { DataGrid, type DataGridColumn, type DataGridFeature } from "@/components/ui/data-grid";
import { ExportCsvButton, LimitFloatingFilter, type LimitFloatingFilterParams } from "@/components/ui/data-grid-features";
import { Input } from "@/components/ui/input";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { usePrefersReducedMotion } from "@/components/viz";
import type { PayoutBatch, ProviderEarnings } from "@/lib/paypal/payouts";
import { MARKET_SPECS, PROVIDERS } from "@/lib/registry";
import { format, MARKET_IDS, PRICE_UNIT, selectMarketView, type MarketState, type MarketView } from "@/lib/tender";
import { useTenderSelector, useTenderStore } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import { formatMicros } from "@/components/credits/money";

const FEATURES: DataGridFeature[] = ["quickFilter", "numberFilter", "totalsRow", "transactions", "csvExport"];
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 43;
const FLOATING_FILTER_HEIGHT = 41;

/** One provider across every market it is listed in. */
interface LeaderRow {
  id: string;
  name: string;
  logo: string;
  /** Markets the provider bids in. */
  listed: number;
  /** Markets it serves right now (live routes). */
  won: number;
  /** Mean current bid across its markets, USD per 1M requests. */
  avgBid: number | null;
  /** Fastest measured P95 across its markets (ms), latest monitor samples. */
  bestP95: number | null;
  /** Mean measured success rate across its markets. */
  avgSuccess: number | null;
  /** Unpaid earnings (micro-USD); `null` until payouts load. */
  unpaidMicros: number | null;
  /** Served requests whose earnings are unpaid. */
  requests: number | null;
  connected: boolean | null;
  /** Status of its newest PayPal payout item, if any. */
  lastPayout: string | null;
  total?: boolean;
}

interface PayoutsData {
  batches: PayoutBatch[];
  earnings: ProviderEarnings[];
}

const getRowId = (row: LeaderRow) => row.id;

const viewCache = new WeakMap<MarketState, MarketView>();
const viewOf = (state: MarketState) => {
  let view = viewCache.get(state);
  if (!view) {
    view = selectMarketView(state);
    viewCache.set(state, view);
  }
  return view;
};

const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

/** Aggregate every market view per provider (registry listings decide who competes where). */
function leaderRows(markets: Record<string, MarketState>, payouts: PayoutsData | null): LeaderRow[] {
  const stats = new Map<string, { listed: number; won: number; bids: number[]; p95s: number[]; successes: number[] }>();
  for (const spec of MARKET_SPECS) {
    const state = markets[spec.id];
    const view = state ? viewOf(state) : null;
    for (const listing of spec.listings) {
      const entry = stats.get(listing.providerId) ?? { listed: 0, won: 0, bids: [], p95s: [], successes: [] };
      entry.listed += 1;
      const row = view?.providersById[listing.providerId];
      if (row) {
        if (row.isActive) entry.won += 1;
        entry.bids.push(row.conditions.bidPrice);
        const last = row.history[row.history.length - 1];
        entry.p95s.push(last ? last.p95LatencyMs : row.conditions.p95LatencyMs);
        entry.successes.push(last ? last.successRate : row.successRate);
      } else {
        entry.bids.push(listing.bidPrice);
        entry.p95s.push(listing.p95LatencyMs);
        entry.successes.push(1 - listing.errorRate);
      }
      stats.set(listing.providerId, entry);
    }
  }
  const earnings = new Map(payouts?.earnings.map((row) => [row.providerId, row]));
  const lastPayout = new Map<string, string>();
  // Batches come newest first: the first item seen per provider is its newest payout.
  for (const batch of payouts?.batches ?? []) {
    for (const item of batch.items) if (!lastPayout.has(item.providerId)) lastPayout.set(item.providerId, item.transactionStatus ?? batch.status);
  }
  return PROVIDERS.filter((provider) => stats.has(provider.id)).map((provider) => {
    const entry = stats.get(provider.id)!;
    const earned = earnings.get(provider.id);
    return {
      id: provider.id,
      name: provider.name,
      logo: provider.logo,
      listed: entry.listed,
      won: entry.won,
      avgBid: mean(entry.bids),
      bestP95: entry.p95s.length ? Math.min(...entry.p95s) : null,
      avgSuccess: mean(entry.successes),
      unpaidMicros: payouts ? (earned?.unpaidMicros ?? 0) : null,
      requests: payouts ? (earned?.requests ?? 0) : null,
      connected: payouts ? (earned?.connected ?? null) : null,
      lastPayout: lastPayout.get(provider.id) ?? null,
    };
  });
}

/** The pinned totals row: sums for counts and money, the best P95, and means for bids and success. */
function totalRow(rows: readonly LeaderRow[]): LeaderRow {
  const p95s = rows.map((row) => row.bestP95).filter((value): value is number => value !== null);
  const sum = (pick: (row: LeaderRow) => number | null) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
  const loaded = rows.some((row) => row.unpaidMicros !== null);
  return {
    id: "total",
    name: `All ${rows.length} providers`,
    logo: "",
    listed: sum((row) => row.listed),
    won: sum((row) => row.won),
    avgBid: mean(rows.map((row) => row.avgBid).filter((value): value is number => value !== null)),
    bestP95: p95s.length ? Math.min(...p95s) : null,
    avgSuccess: mean(rows.map((row) => row.avgSuccess).filter((value): value is number => value !== null)),
    unpaidMicros: loaded ? sum((row) => row.unpaidMicros) : null,
    requests: loaded ? sum((row) => row.requests) : null,
    connected: null,
    lastPayout: null,
    total: true,
  };
}

type CellProps = CustomCellRendererProps<LeaderRow>;

function limit(params: LimitFloatingFilterParams): Partial<DataGridColumn<LeaderRow>> {
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

const COLUMNS: DataGridColumn<LeaderRow>[] = [
  {
    colId: "provider",
    headerName: "Provider",
    pinned: "left",
    lockPinned: true,
    width: 208,
    sortable: true,
    valueGetter: ({ data }) => data?.name ?? null,
    getQuickFilterText: ({ data }) => data?.name ?? "",
    cellRenderer: ProviderCell,
  },
  {
    colId: "won",
    headerName: "Markets won",
    headerHint: "Markets where this provider serves requests right now, of the markets it bids in. Updates as routes switch.",
    align: "right",
    width: 168,
    sortable: true,
    sort: "desc",
    sortingOrder: ["desc", "asc", null],
    valueGetter: ({ data }) => data?.won ?? null,
    enableCellChangeFlash: true,
    cellRenderer: WonCell,
    context: { csv: (row: LeaderRow) => row.won },
    ...limit({ bound: "min", placeholder: "Any" }),
  },
  {
    colId: "listed",
    headerName: "Markets",
    headerHint: "Markets this provider bids in.",
    align: "right",
    width: 96,
    sortable: true,
    sortingOrder: ["desc", "asc", null],
    valueGetter: ({ data }) => data?.listed ?? null,
    cellRenderer: ({ value }: CellProps) => <span className="text-foreground tabular-nums">{value}</span>,
  },
  {
    colId: "avgBid",
    headerName: "Average bid",
    headerUnit: PRICE_UNIT,
    headerHint: "Mean of its current bids across its markets, in USD per 1M requests.",
    align: "right",
    width: 136,
    sortable: true,
    valueGetter: ({ data }) => data?.avgBid ?? null,
    enableCellChangeFlash: true,
    cellRenderer: ({ value }: CellProps) => (typeof value === "number" ? <span className="text-foreground tabular-nums">{format.price(value)}</span> : <Missing />),
    context: { csvUnit: "USD per 1M requests" },
    ...limit({ bound: "max", prefix: "$", placeholder: "Any" }),
  },
  {
    colId: "bestP95",
    headerName: "Best P95",
    headerHint: "Fastest 95th-percentile latency across its markets, from the latest monitor samples (every 5 s).",
    align: "right",
    width: 120,
    sortable: true,
    cellClass: "tender-live",
    valueGetter: ({ data }) => data?.bestP95 ?? null,
    enableCellChangeFlash: true,
    cellRenderer: ({ value }: CellProps) => (typeof value === "number" ? <UnitValue text={format.latency(value)} /> : <Missing />),
    context: { csvUnit: "ms" },
    ...limit({ bound: "max", unit: "ms", placeholder: "Any" }),
  },
  {
    colId: "avgSuccess",
    headerName: "Success",
    headerHint: "Mean measured success rate across its markets.",
    align: "right",
    width: 120,
    sortable: true,
    sortingOrder: ["desc", "asc", null],
    cellClass: "tender-live",
    valueGetter: ({ data }) => data?.avgSuccess ?? null,
    enableCellChangeFlash: true,
    cellRenderer: ({ value }: CellProps) => (typeof value === "number" ? <span className="text-foreground tabular-nums">{format.percent(value)}</span> : <Missing />),
    context: { csv: (row: LeaderRow) => (row.avgSuccess === null ? null : Math.round(row.avgSuccess * 10_000) / 100), csvUnit: "%" },
    ...limit({ bound: "min", unit: "%", placeholder: "Any", toModel: (display) => Math.min(1, display / 100), toDisplay: (value) => value * 100 }),
  },
  {
    colId: "earnings",
    headerName: "Unpaid earnings",
    headerHint: "Earnings from paid requests that PayPal Payouts has not sent yet, in USD.",
    align: "right",
    width: 148,
    sortable: true,
    sortingOrder: ["desc", "asc", null],
    valueGetter: ({ data }) => data?.unpaidMicros ?? null,
    cellRenderer: EarningsCell,
    context: { csv: (row: LeaderRow) => (row.unpaidMicros === null ? null : (row.unpaidMicros / 1_000_000).toFixed(6)), csvUnit: "USD" },
  },
  {
    colId: "payout",
    headerName: "PayPal payout",
    headerHint: "The newest PayPal payout to this provider, or whether it can receive one.",
    flex: 1,
    minWidth: 152,
    valueGetter: ({ data }) => data?.lastPayout ?? (data?.connected === null ? null : data?.connected ? "Connected" : "Not connected"),
    cellRenderer: PayoutCell,
  },
];

/**
 * Every provider across the 75 markets: where it competes, where it wins right now, its bids and measured
 * performance from the live engine, and its PayPal earnings. Sorted by markets won; numbers filter from the
 * floating filter row; a pinned row totals the providers the filters keep.
 */
export function LeaderboardView() {
  const store = useTenderStore();
  const reduceMotion = usePrefersReducedMotion();
  const markets = useTenderSelector((state) => state.markets);
  const [payouts, setPayouts] = useState<PayoutsData | null>(null);
  const [query, setQuery] = useState("");
  const [api, setApi] = useState<GridApi<LeaderRow> | null>(null);
  const [kept, setKept] = useState<LeaderRow[] | null>(null);

  // Watch every market so the monitor samples them (live P95 and success).
  useEffect(() => {
    const releases = MARKET_IDS.map((id) => store.watch(id));
    return () => releases.forEach((release) => release());
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payouts", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<PayoutsData>) : Promise.reject(new Error())))
      .then((body) => !cancelled && setPayouts(body))
      .catch(() => {
        // Earnings stay empty; the engine columns still work.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => leaderRows(markets, payouts), [markets, payouts]);

  // The totals row follows the filters: recount the rows the grid keeps after every model update.
  const recount = useCallback((gridApi: GridApi<LeaderRow>) => {
    const next: LeaderRow[] = [];
    gridApi.forEachNodeAfterFilter((node) => {
      if (node.data) next.push(node.data);
    });
    setKept(next);
  }, []);
  const pinned = useMemo(() => [totalRow(kept ?? rows)], [kept, rows]);

  const onGridReady = useCallback((event: GridReadyEvent<LeaderRow>) => setApi(event.api), []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-title font-semibold text-foreground">Provider leaderboard</h1>
        <p className="mt-1 max-w-2xl text-body text-muted-foreground">
          Every provider across the {MARKET_SPECS.length} markets: where it bids, where it wins right now, how fast and
          reliable it measures, and what Tender owes it through PayPal.
        </p>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search providers…" className="pl-8" aria-label="Search providers" />
        </div>
        <p className="text-caption text-muted-foreground tabular-nums" aria-live="polite">
          {kept && kept.length !== rows.length ? `${kept.length} of ${rows.length} providers` : `${rows.length} providers`}
        </p>
        <span className="ml-auto">
          <ExportCsvButton api={api} fileName="tender-provider-leaderboard.csv" />
        </span>
      </div>
      <DataGrid<LeaderRow>
        aria-label="Provider leaderboard"
        data-slot="leaderboard"
        features={FEATURES}
        density="tight"
        rowData={rows}
        columnDefs={COLUMNS}
        getRowId={getRowId}
        rowHeight={ROW_HEIGHT}
        pinnedBottomRowData={pinned}
        enableFilterHandlers
        quickFilterText={query}
        floatingFiltersHeight={FLOATING_FILTER_HEIGHT - 1}
        autoSizeStrategy={null}
        animateRows={!reduceMotion}
        cellFlashDuration={reduceMotion ? 1200 : 250}
        cellFadeDuration={reduceMotion ? 0 : 900}
        onGridReady={onGridReady}
        onModelUpdated={(event) => recount(event.api)}
        reserveHeight={`${HEADER_HEIGHT + FLOATING_FILTER_HEIGHT + (rows.length + 1) * ROW_HEIGHT + 2}px`}
      />
    </div>
  );
}

function Missing() {
  return <span className="text-faint">—</span>;
}

function UnitValue({ text }: { text: string }) {
  const index = text.lastIndexOf(" ");
  if (index <= 0) return <span className="text-foreground tabular-nums">{text}</span>;
  return (
    <span className="text-foreground tabular-nums">
      {text.slice(0, index)} <span className="text-muted-foreground">{text.slice(index + 1)}</span>
    </span>
  );
}

function ProviderCell({ data, node }: CellProps) {
  if (!data) return null;
  if (node.rowPinned) return <span className="font-medium text-foreground">{data.name}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <ProviderLogo src={data.logo || null} name={data.name} />
      <span className="truncate text-xs text-foreground">{data.name}</span>
    </span>
  );
}

/** "12 of 18" with a thin olive bar for the share of its markets it wins. */
function WonCell({ data }: CellProps) {
  if (!data) return null;
  const share = data.listed ? data.won / data.listed : 0;
  return (
    <span className="flex items-center gap-2.5">
      {data.total ? null : (
        <span aria-hidden="true" className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary-strong transition-[width] duration-fast" style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
      )}
      <span className="tabular-nums">
        <span className={cn(data.won ? "text-foreground" : "text-muted-foreground")}>{data.won}</span>
        <span className="text-muted-foreground"> of {data.listed}</span>
      </span>
    </span>
  );
}

function EarningsCell({ data }: CellProps) {
  if (!data) return null;
  if (data.unpaidMicros === null) return <Missing />;
  return (
    <span className={cn("tabular-nums", data.requests ? "flex flex-col items-end leading-tight" : undefined)}>
      <span className={data.unpaidMicros ? "text-foreground" : "text-muted-foreground"}>{formatMicros(data.unpaidMicros)}</span>
      {data.requests ? (
        <span className="text-caption text-faint">
          {format.count(data.requests)} {data.requests === 1 ? "request" : "requests"}
        </span>
      ) : null}
    </span>
  );
}

function PayoutCell({ data }: CellProps) {
  if (!data || data.total) return null;
  if (data.lastPayout) return <PayoutStatusBadge status={data.lastPayout} />;
  if (data.connected === null) return <Missing />;
  return data.connected ? (
    <span className="text-xs text-foreground">Connected</span>
  ) : (
    <span className="text-xs text-muted-foreground">Not connected</span>
  );
}
