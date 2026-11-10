"use client";

import type { CustomCellRendererProps } from "ag-grid-react";

import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Badge } from "@/components/ui/badge";
import type { ProviderEarnings } from "@/lib/paypal/payouts";

import { formatCents, formatMicros } from "./format";
import { ProviderName } from "./provider-name";

type CellProps = CustomCellRendererProps<ProviderEarnings>;

const getRowId = (row: ProviderEarnings) => row.providerId;

const COLUMNS: DataGridColumn<ProviderEarnings>[] = [
  { colId: "provider", headerName: "Provider", cellRenderer: ({ data }: CellProps) => (data ? <ProviderName providerId={data.providerId} /> : null) },
  {
    colId: "unpaid",
    headerName: "Unpaid",
    headerHint: "Earnings from served requests that are not paid yet, in USD.",
    align: "right",
    cellRenderer: ({ data }: CellProps) => (data ? <span className="text-foreground tabular-nums">{formatMicros(data.unpaidMicros)}</span> : null),
  },
  {
    colId: "requests",
    headerName: "Requests",
    align: "right",
    cellRenderer: ({ data }: CellProps) => (data ? <span className="text-foreground tabular-nums">{data.requests.toLocaleString("en-US")}</span> : null),
  },
  {
    colId: "next",
    headerName: "Next payout",
    headerHint: "Paid in whole cents. The rest stays for the next payout.",
    align: "right",
    cellRenderer: ({ data }: CellProps) => {
      if (!data) return null;
      if (!data.connected || data.unpaidMicros === 0) return <span className="text-faint">—</span>;
      if (data.payableMicros === 0) return <span className="text-muted-foreground">Under $0.01</span>;
      return <span className="text-foreground tabular-nums">{formatCents(data.payableMicros)}</span>;
    },
  },
  {
    colId: "paypal",
    headerName: "PayPal",
    cellRenderer: ({ data }: CellProps) => {
      if (!data) return null;
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

/** Unpaid earnings per provider. */
export function EarningsGrid({ earnings }: { earnings: readonly ProviderEarnings[] }) {
  return (
    <DataGrid<ProviderEarnings>
      aria-label="Provider earnings"
      data-slot="payout-earnings"
      rowData={earnings}
      columnDefs={COLUMNS}
      getRowId={getRowId}
      reserveHeight={`${43 + earnings.length * 44 + 2}px`}
    />
  );
}
