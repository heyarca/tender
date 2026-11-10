"use client";

import { useCallback } from "react";
import type { GridApi, GridReadyEvent } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";

import { DataGrid, type DataGridColumn, type DataGridFeature } from "@/components/ui/data-grid";
import { Badge } from "@/components/ui/badge";
import { getProvider } from "@/lib/registry";
import type { ProviderEarnings } from "@/lib/paypal/payouts";

import { formatCents, formatMicros } from "./format";
import { ProviderName } from "./provider-name";

const FEATURES: DataGridFeature[] = ["totalsRow", "csvExport"];

type CellProps = CustomCellRendererProps<ProviderEarnings>;

const getRowId = (row: ProviderEarnings) => row.providerId;

const usd = (micros: number) => (micros / 1_000_000).toFixed(6);

const COLUMNS: DataGridColumn<ProviderEarnings>[] = [
  {
    colId: "provider",
    headerName: "Provider",
    sortable: true,
    valueGetter: ({ data }) => (data ? (getProvider(data.providerId)?.name ?? data.providerId) : null),
    cellRenderer: ({ data, node }: CellProps) => {
      if (!data) return null;
      return node.rowPinned ? <span className="font-medium text-foreground">All providers</span> : <ProviderName providerId={data.providerId} />;
    },
    context: { csv: (row: ProviderEarnings) => (row.providerId === "total" ? "All providers" : (getProvider(row.providerId)?.name ?? row.providerId)) },
  },
  {
    colId: "unpaid",
    headerName: "Unpaid",
    headerHint: "Earnings from served requests that are not paid yet, in USD.",
    align: "right",
    sortable: true,
    sort: "desc",
    sortingOrder: ["desc", "asc", null],
    valueGetter: ({ data }) => data?.unpaidMicros ?? null,
    cellRenderer: ({ data }: CellProps) => (data ? <span className="text-foreground tabular-nums">{formatMicros(data.unpaidMicros)}</span> : null),
    context: { csv: (row: ProviderEarnings) => usd(row.unpaidMicros), csvUnit: "USD" },
  },
  {
    colId: "requests",
    headerName: "Requests",
    align: "right",
    sortable: true,
    sortingOrder: ["desc", "asc", null],
    valueGetter: ({ data }) => data?.requests ?? null,
    cellRenderer: ({ data }: CellProps) => (data ? <span className="text-foreground tabular-nums">{data.requests.toLocaleString("en-US")}</span> : null),
  },
  {
    colId: "next",
    headerName: "Next payout",
    headerHint: "Paid in whole cents. The rest stays for the next payout.",
    align: "right",
    sortable: true,
    sortingOrder: ["desc", "asc", null],
    valueGetter: ({ data }) => (data?.connected ? data.payableMicros : null),
    cellRenderer: ({ data }: CellProps) => {
      if (!data) return null;
      if (!data.connected || data.unpaidMicros === 0) return <span className="text-faint">—</span>;
      if (data.payableMicros === 0) return <span className="text-muted-foreground">Under $0.01</span>;
      return <span className="text-foreground tabular-nums">{formatCents(data.payableMicros)}</span>;
    },
    context: { csv: (row: ProviderEarnings) => (row.connected ? usd(row.payableMicros) : null), csvUnit: "USD" },
  },
  {
    colId: "paypal",
    headerName: "PayPal",
    valueGetter: ({ data }) => (data?.connected ? "Connected" : "Not connected"),
    cellRenderer: ({ data, node }: CellProps) => {
      if (!data || node.rowPinned) return null;
      return data.connected ? (
        <Badge tone="positive" dot>
          Connected
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">Not connected to PayPal</span>
      );
    },
  },
];

/** Totals under the providers: everything unpaid, and what the next batch pays (connected providers only). */
function totals(earnings: readonly ProviderEarnings[]): ProviderEarnings[] {
  return [
    {
      providerId: "total",
      unpaidMicros: earnings.reduce((sum, row) => sum + row.unpaidMicros, 0),
      payableMicros: earnings.reduce((sum, row) => sum + (row.connected ? row.payableMicros : 0), 0),
      requests: earnings.reduce((sum, row) => sum + row.requests, 0),
      connected: true,
    },
  ];
}

/** Unpaid earnings per provider, largest first, with a pinned totals row. */
export function EarningsGrid({ earnings, onApi }: { earnings: readonly ProviderEarnings[]; onApi?: (api: GridApi<ProviderEarnings>) => void }) {
  const onGridReady = useCallback((event: GridReadyEvent<ProviderEarnings>) => onApi?.(event.api), [onApi]);
  return (
    <DataGrid<ProviderEarnings>
      aria-label="Provider earnings"
      data-slot="payout-earnings"
      features={FEATURES}
      rowData={earnings}
      columnDefs={COLUMNS}
      getRowId={getRowId}
      pinnedBottomRowData={totals(earnings)}
      onGridReady={onGridReady}
      reserveHeight={`${43 + (earnings.length + 1) * 44 + 2}px`}
    />
  );
}
