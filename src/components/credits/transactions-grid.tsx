"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GridApi, GridReadyEvent, IDateFilterParams } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";
import { Receipt } from "lucide-react";

import { Notice, RelativeTime } from "@/components/market/payments/payment-ui";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DataGrid, type DataGridColumn, type DataGridFeature } from "@/components/ui/data-grid";
import { ExportCsvButton, GridEmptyOverlay, SelectFloatingFilter, type EmptyOverlayParams } from "@/components/ui/data-grid-features";
import { EmptyState } from "@/components/ui/empty-state";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import type { Actor, LedgerEntryView, LedgerKind } from "@/lib/ledger/types";
import { getMarketSpec, getProvider } from "@/lib/registry";
import { getProviderFixture, isMarketId } from "@/lib/tender";
import { cn } from "@/lib/utils";

import { formatMicros } from "./money";

const FEATURES: DataGridFeature[] = ["textFilter", "dateFilter", "totalsRow", "transactions", "csvExport"];
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 43;
const FLOATING_FILTER_HEIGHT = 41;
/** Up to ten entries the grid grows; past that it keeps this height and the totals stay pinned below. */
const VISIBLE_ROWS = 10;
const TOTAL_ROWS = 3;

const KIND: Record<LedgerKind, { label: string; tone: BadgeTone }> = {
  topup: { label: "Top-up", tone: "positive" },
  charge: { label: "Charge", tone: "neutral" },
  refund: { label: "Refund", tone: "info" },
  adjustment: { label: "Adjustment", tone: "neutral" },
};

const ACTOR: Record<Actor, string> = { user: "You", agent: "Ask Tender", api_key: "API key", system: "Tender" };

/** A ledger entry, or one of the totals rows pinned under the grid. */
type TxRow =
  | { kind: "entry"; id: string; entry: LedgerEntryView }
  | { kind: "total"; id: string; label: string; micros: number };

type CellProps = CustomCellRendererProps<TxRow>;

const getRowId = (row: TxRow) => row.id;
const entryOf = (row: TxRow | undefined) => (row?.kind === "entry" ? row.entry : null);

const absoluteTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

/** Compare a ledger time with a filter day (local midnight), by calendar day. */
const dayComparator: IDateFilterParams["comparator"] = (filterDay, cellValue: Date | null) => {
  if (!cellValue) return -1;
  const day = new Date(cellValue.getFullYear(), cellValue.getMonth(), cellValue.getDate()).getTime();
  return day < filterDay.getTime() ? -1 : day > filterDay.getTime() ? 1 : 0;
};

function providerOf(entry: LedgerEntryView) {
  const fixture =
    entry.market_id && entry.provider_id && isMarketId(entry.market_id) ? getProviderFixture(entry.market_id, entry.provider_id) : undefined;
  const name = fixture?.name ?? (entry.provider_id ? (getProvider(entry.provider_id)?.name ?? entry.provider_id) : null);
  return { name, logo: fixture?.logo ?? null };
}

function detailsText(entry: LedgerEntryView): string {
  if (entry.kind === "topup") return `${entry.auto_top_up ? "Top-up from saved PayPal by Ask Tender" : "PayPal"}${entry.paypal_capture_id ? ` ${entry.paypal_capture_id}` : ""}`;
  const market = entry.market_id ? getMarketSpec(entry.market_id) : undefined;
  return [providerOf(entry).name, market?.name].filter(Boolean).join(", ");
}

const usd = (micros: number) => (micros / 1_000_000).toFixed(6);

/** Top-ups, charges, and the net of the rows the filters keep. */
function totals(entries: readonly LedgerEntryView[]): TxRow[] {
  let topUps = 0;
  let charges = 0;
  for (const entry of entries) {
    if (entry.kind === "topup") topUps += entry.amount_micros;
    else if (entry.amount_micros < 0) charges += entry.amount_micros;
  }
  const net = entries.reduce((sum, entry) => sum + entry.amount_micros, 0);
  return [
    { kind: "total", id: "total-topups", label: "Top-ups", micros: topUps },
    { kind: "total", id: "total-charges", label: "Charges", micros: charges },
    { kind: "total", id: "total-net", label: "Net", micros: net },
  ];
}

function TimeCell({ data }: CellProps) {
  const entry = entryOf(data);
  if (!entry) return null;
  return (
    <span title={absoluteTime(entry.created_at)}>
      <RelativeTime at={Date.parse(entry.created_at)} />
    </span>
  );
}

function TypeCell({ data }: CellProps) {
  const entry = entryOf(data);
  if (!entry) return null;
  const kind = KIND[entry.kind];
  return <Badge tone={kind.tone}>{kind.label}</Badge>;
}

function DetailsCell({ data }: CellProps) {
  if (data?.kind === "total") return <span className="font-medium text-foreground">{data.label}</span>;
  const entry = entryOf(data);
  if (!entry) return null;
  if (entry.kind === "topup") {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-foreground">{entry.auto_top_up ? "Top-up from saved PayPal by Ask Tender" : "PayPal"}</span>
        {entry.paypal_capture_id ? <span className="truncate font-mono text-caption text-muted-foreground">{entry.paypal_capture_id}</span> : null}
      </span>
    );
  }
  const market = entry.market_id ? getMarketSpec(entry.market_id) : undefined;
  const provider = providerOf(entry);
  return (
    <span className="flex min-w-0 items-center gap-2">
      {provider.name ? <ProviderLogo src={provider.logo} name={provider.name} size={16} /> : null}
      <span className="truncate text-foreground">{provider.name ?? "—"}</span>
      {market ? <span className="truncate text-caption text-muted-foreground">{market.name}</span> : null}
    </span>
  );
}

function ActorCell({ data }: CellProps) {
  const entry = entryOf(data);
  return entry ? <span>{ACTOR[entry.actor]}</span> : null;
}

function AmountCell({ data }: CellProps) {
  const micros = data?.kind === "total" ? data.micros : entryOf(data)?.amount_micros;
  if (micros === undefined) return null;
  return (
    <span className={cn("tabular-nums", micros > 0 ? "text-positive-text" : "text-foreground", data?.kind === "total" && "font-medium")}>
      {formatMicros(micros, { signed: true })}
    </span>
  );
}

function BalanceCell({ data }: CellProps) {
  const entry = entryOf(data);
  return entry ? <span className="text-foreground tabular-nums">{formatMicros(entry.balance_after_micros)}</span> : null;
}

function selectFilter(allLabel: string, options: { value: string; label: string }[]): Partial<DataGridColumn<TxRow>> {
  return {
    filter: "agTextColumnFilter",
    filterParams: { filterOptions: ["equals"], maxNumConditions: 1 },
    floatingFilter: true,
    floatingFilterComponent: SelectFloatingFilter,
    floatingFilterComponentParams: { kind: "text", allLabel, options },
    suppressFloatingFilterButton: true,
    suppressHeaderFilterButton: true,
  };
}

const COLUMNS: DataGridColumn<TxRow>[] = [
  {
    colId: "time",
    headerName: "Time",
    width: 132,
    sortable: true,
    cellDataType: "dateTime",
    valueGetter: ({ data }) => {
      const entry = entryOf(data);
      return entry ? new Date(entry.created_at) : null;
    },
    filter: "agDateColumnFilter",
    filterParams: { comparator: dayComparator, filterOptions: ["today", "last7Days", "last30Days"], maxNumConditions: 1 },
    floatingFilter: true,
    floatingFilterComponent: SelectFloatingFilter,
    floatingFilterComponentParams: {
      kind: "date",
      allLabel: "Any time",
      options: [
        { value: "today", label: "Today" },
        { value: "last7Days", label: "Last 7 days" },
        { value: "last30Days", label: "Last 30 days" },
      ],
    },
    suppressFloatingFilterButton: true,
    suppressHeaderFilterButton: true,
    cellRenderer: TimeCell,
    context: { csv: (row: TxRow) => entryOf(row)?.created_at ?? null },
  },
  {
    colId: "type",
    headerName: "Type",
    width: 132,
    valueGetter: ({ data }) => entryOf(data)?.kind ?? null,
    cellRenderer: TypeCell,
    context: { csv: (row: TxRow) => { const entry = entryOf(row); return entry ? KIND[entry.kind].label : null; } },
    ...selectFilter("All types", [
      { value: "topup", label: "Top-ups" },
      { value: "charge", label: "Charges" },
      { value: "refund", label: "Refunds" },
    ]),
  },
  {
    colId: "details",
    headerName: "Details",
    flex: 1,
    minWidth: 220,
    cellRenderer: DetailsCell,
    context: { csv: (row: TxRow) => (row.kind === "total" ? row.label : detailsText(row.entry)) },
  },
  {
    colId: "actor",
    headerName: "By",
    width: 140,
    valueGetter: ({ data }) => entryOf(data)?.actor ?? null,
    cellRenderer: ActorCell,
    context: { csv: (row: TxRow) => { const entry = entryOf(row); return entry ? ACTOR[entry.actor] : null; } },
    ...selectFilter("Anyone", [
      { value: "user", label: "You" },
      { value: "agent", label: "Ask Tender" },
      { value: "api_key", label: "API key" },
    ]),
  },
  {
    colId: "amount",
    headerName: "Amount",
    align: "right",
    width: 128,
    sortable: true,
    valueGetter: ({ data }) => (data?.kind === "total" ? data.micros : (entryOf(data)?.amount_micros ?? null)),
    cellRenderer: AmountCell,
    context: { csv: (row: TxRow) => usd(row.kind === "total" ? row.micros : row.entry.amount_micros), csvUnit: "USD" },
  },
  {
    colId: "balance",
    headerName: "Balance",
    align: "right",
    width: 128,
    cellRenderer: BalanceCell,
    context: { csv: (row: TxRow) => (row.kind === "entry" ? usd(row.entry.balance_after_micros) : null), csvUnit: "USD" },
  },
];

const OVERLAY: EmptyOverlayParams = { title: "No transactions match", description: "Choose another type, person, or time range." };

/**
 * Transactions on AG Grid: Type and By are Text Filters set from Tender selects in the floating filter
 * row, Time is a Date Filter with relative ranges (today, last 7 and 30 days), and three totals rows
 * (top-ups, charges, net) are pinned under the rows and follow the filters. Export CSV downloads what is shown.
 */
export function Transactions({ revision }: { revision: number }) {
  const [entries, setEntries] = useState<LedgerEntryView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [api, setApi] = useState<GridApi<TxRow> | null>(null);
  const [shown, setShown] = useState<LedgerEntryView[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ledger?limit=200", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ entries: LedgerEntryView[] }>) : Promise.reject(new Error())))
      .then((body) => {
        if (!cancelled) {
          setEntries(body.entries);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const rows = useMemo<TxRow[]>(() => (entries ?? []).map((entry) => ({ kind: "entry", id: entry.id, entry })), [entries]);

  // Totals follow the filters: recount the rows the grid keeps whenever its model changes.
  const recount = useCallback((gridApi: GridApi<TxRow>) => {
    const kept: LedgerEntryView[] = [];
    gridApi.forEachNodeAfterFilter((node) => {
      if (node.data?.kind === "entry") kept.push(node.data.entry);
    });
    setShown(kept);
  }, []);
  const pinned = useMemo(() => totals(shown), [shown]);

  const onGridReady = useCallback((event: GridReadyEvent<TxRow>) => {
    setApi(event.api);
    recount(event.api);
  }, [recount]);

  const count = rows.length;
  const visible = Math.min(count, VISIBLE_ROWS);
  const bodyHeight = HEADER_HEIGHT + FLOATING_FILTER_HEIGHT + visible * ROW_HEIGHT + TOTAL_ROWS * ROW_HEIGHT + 2;

  return (
    <Section
      id="transactions"
      icon={<Receipt aria-hidden="true" />}
      title="Transactions"
      description="Top-ups and the requests your balance paid for, newest first. Filter by type, who paid, or time; the totals follow."
      framed={false}
      actions={
        count > 0 ? (
          <>
            <span className="text-caption text-muted-foreground tabular-nums">
              {shown.length === count ? `${count} shown` : `${shown.length} of ${count} shown`}
            </span>
            <ExportCsvButton api={api} fileName="tender-transactions.csv" />
          </>
        ) : null
      }
    >
      {failed ? (
        <Notice tone="negative">Transactions could not be loaded. Reload the page to try again.</Notice>
      ) : entries === null ? (
        <Skeleton className="h-32 w-full" />
      ) : count === 0 ? (
        <div className="rounded-lg border border-dashed border-border">
          <EmptyState
            icon={<Receipt aria-hidden="true" />}
            title="No transactions yet"
            description="Add funds, then run a request with credits from any market."
            className="py-8"
          />
        </div>
      ) : (
        <DataGrid<TxRow>
          aria-label="Transactions"
          data-slot="transactions"
          features={FEATURES}
          rowData={rows}
          columnDefs={COLUMNS}
          getRowId={getRowId}
          pinnedBottomRowData={pinned}
          enableFilterHandlers
          floatingFiltersHeight={FLOATING_FILTER_HEIGHT - 1}
          autoSizeStrategy={null}
          domLayout={count > VISIBLE_ROWS ? "normal" : "autoHeight"}
          height={count > VISIBLE_ROWS ? bodyHeight : undefined}
          minBodyHeight={shown.length === 0 ? 120 : undefined}
          overlayComponent={GridEmptyOverlay}
          overlayComponentParams={OVERLAY}
          onGridReady={onGridReady}
          onModelUpdated={(event) => recount(event.api)}
          reserveHeight={`${bodyHeight}px`}
        />
      )}
    </Section>
  );
}
