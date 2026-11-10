"use client";

import { useMemo } from "react";
import type { SortComparatorFn } from "ag-grid-community";
import type { CustomCellRendererProps } from "ag-grid-react";

import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { format, getProviderFixture, type MarketId, type MarketTimeZone } from "@/lib/tender";

import { formatUsdcAtomic } from "./payment-model";
import type { PaidRequestRecord } from "./payment-records";
import { RelativeTime, TxLink } from "./payment-ui";

/** Row heights in px (the `or-table` regular density). */
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 43;

export interface ReceiptsTableProps {
  records: readonly PaidRequestRecord[];
  marketId: MarketId;
  timeZone: MarketTimeZone;
}

interface ReceiptCellParams {
  marketId: MarketId;
  timeZone: MarketTimeZone;
}

type CellProps = CustomCellRendererProps<PaidRequestRecord> & ReceiptCellParams;

const getRowId = (record: PaidRequestRecord) => record.id;

const byNumber =
  (value: (record: PaidRequestRecord) => number): SortComparatorFn<PaidRequestRecord> =>
  (_a, _b, nodeA, nodeB) =>
    nodeA.data && nodeB.data ? value(nodeA.data) - value(nodeB.data) : 0;

function receiptColumns(params: ReceiptCellParams): DataGridColumn<PaidRequestRecord>[] {
  return [
    {
      colId: "time",
      headerName: "Time",
      cellRenderer: TimeCell,
      cellRendererParams: params,
      sortable: true,
      comparator: byNumber((record) => record.at),
      // Newest first, like the list it replaces; a click shows the oldest first.
      initialSort: "desc",
      sortingOrder: ["desc", "asc"],
    },
    { colId: "provider", headerName: "Provider", cellRenderer: ProviderCell, cellRendererParams: params },
    { colId: "result", headerName: "Result", cellRenderer: ResultCell },
    {
      colId: "price",
      headerName: "Price",
      headerUnit: "/req",
      headerHint: "Exact provider bid for one request, in USD.",
      align: "right",
      cellRenderer: PriceCell,
      sortable: true,
      comparator: byNumber((record) => record.receipt.price_usd),
      sortingOrder: ["desc", "asc", null],
    },
    {
      colId: "settled",
      headerName: "Settled",
      headerUnit: "USDC",
      headerHint: "Amount transferred on Base Sepolia. USDC settles whole atomic units (0.000001), rounded up.",
      align: "right",
      cellRenderer: SettledCell,
      sortable: true,
      comparator: byNumber((record) => Number(record.receipt.settled_atomic)),
      sortingOrder: ["desc", "asc", null],
    },
    { colId: "latency", headerName: "Latency", align: "right", cellRenderer: LatencyCell },
    { colId: "dataAge", headerName: "Data age", align: "right", cellRenderer: DataAgeCell },
    { colId: "transaction", headerName: "Transaction", cellRenderer: TransactionCell },
  ];
}

/** Recent paid requests of a market, newest first (OpenRouter `or-table` style), sortable by time and amount. */
export function ReceiptsTable({ records, marketId, timeZone }: ReceiptsTableProps) {
  const columns = useMemo(() => receiptColumns({ marketId, timeZone }), [marketId, timeZone]);
  return (
    <DataGrid<PaidRequestRecord>
      aria-label="Recent paid requests"
      data-slot="payment-receipts"
      rowData={records}
      columnDefs={columns}
      getRowId={getRowId}
      reserveHeight={`${HEADER_HEIGHT + records.length * ROW_HEIGHT + 2}px`}
    />
  );
}

function TimeCell({ data, timeZone }: CellProps) {
  if (!data) return null;
  return (
    <span title={format.time(data.at, timeZone, { seconds: true })}>
      <RelativeTime at={data.at} />
    </span>
  );
}

function ProviderCell({ data, marketId }: CellProps) {
  if (!data) return null;
  const { receipt } = data;
  const logo = getProviderFixture(marketId, receipt.providerId)?.logo ?? null;
  return (
    <span className="flex items-center gap-2.5 text-foreground">
      <ProviderLogo src={logo} name={receipt.providerName} size={20} />
      <span className="text-xs">{receipt.providerName}</span>
    </span>
  );
}

function ResultCell({ data }: CellProps) {
  if (!data) return null;
  return <span className="text-foreground tabular-nums">{data.summary ?? "—"}</span>;
}

function Strong({ children }: { children: string }) {
  return <span className="text-foreground tabular-nums">{children}</span>;
}

function PriceCell({ data }: CellProps) {
  return data ? <Strong>{format.cost(data.receipt.price_usd)}</Strong> : null;
}

function SettledCell({ data }: CellProps) {
  return data ? <Strong>{formatUsdcAtomic(data.receipt.settled_atomic)}</Strong> : null;
}

function LatencyCell({ data }: CellProps) {
  return data ? <Strong>{format.latency(data.receipt.latency_ms)}</Strong> : null;
}

function DataAgeCell({ data }: CellProps) {
  return data ? <Strong>{format.dataAge(data.receipt.data_age_ms)}</Strong> : null;
}

function TransactionCell({ data }: CellProps) {
  return data ? <TxLink hash={data.receipt.txHash} /> : null;
}
