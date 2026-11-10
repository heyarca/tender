"use client";

import { useCallback, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import type { CustomCellRendererProps } from "ag-grid-react";
import type { ColDef, GridApi, GridReadyEvent, RowClickedEvent } from "ag-grid-community";

import { DataGrid, type DataGridColumn, type DataGridFeature } from "@/components/ui/data-grid";
import { getProvider } from "@/lib/registry";
import type { PayoutBatch, PayoutItem } from "@/lib/paypal/payouts";
import { cn } from "@/lib/utils";

import { formatCents, formatDateTime } from "./format";
import { PayoutStatusBadge } from "./payout-status-badge";
import { ProviderName } from "./provider-name";

/** A batch row, followed by its item rows when the batch is expanded. */
export type BatchRow = Row;

type Row =
  | { kind: "batch"; id: string; batch: PayoutBatch; expanded: boolean }
  | { kind: "item"; id: string; item: PayoutItem; batchStatus: string };

type CellProps = CustomCellRendererProps<Row>;

const FEATURES: DataGridFeature[] = ["csvExport"];

const getRowId = (row: Row) => row.id;

const Mono = ({ children }: { children: string | null }) =>
  children ? <span className="font-mono text-caption text-foreground">{children}</span> : <span className="text-faint">—</span>;

const COLUMNS: DataGridColumn<Row>[] = [
  {
    colId: "time",
    headerName: "Sent",
    context: { csv: (row: Row) => (row.kind === "batch" ? row.batch.createdAt : null) },
    cellRenderer: ({ data }: CellProps) => {
      if (!data) return null;
      if (data.kind === "item") return null;
      return (
        <span className="flex items-center gap-1.5 text-foreground">
          <ChevronRight
            aria-hidden="true"
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-quick", data.expanded && "rotate-90")}
          />
          <span className="tabular-nums">{formatDateTime(data.batch.createdAt)}</span>
        </span>
      );
    },
  },
  {
    colId: "provider",
    headerName: "Provider",
    context: {
      csv: (row: Row) =>
        row.kind === "item" ? (getProvider(row.item.providerId)?.name ?? row.item.providerId) : `${row.batch.items.length} providers`,
    },
    cellRenderer: ({ data }: CellProps) => {
      if (!data) return null;
      if (data.kind === "item") return <ProviderName providerId={data.item.providerId} />;
      const count = data.batch.items.length;
      return <span>{count === 1 ? "1 provider" : `${count} providers`}</span>;
    },
  },
  {
    colId: "receiver",
    headerName: "PayPal account",
    context: { csv: (row: Row) => (row.kind === "item" ? row.item.receiver : null) },
    cellRenderer: ({ data }: CellProps) => (data?.kind === "item" ? <span>{data.item.receiver}</span> : null),
  },
  {
    colId: "amount",
    headerName: "Amount",
    context: { csv: (row: Row) => ((row.kind === "batch" ? row.batch.totalMicros : row.item.amountMicros) / 1_000_000).toFixed(2), csvUnit: "USD" },
    align: "right",
    cellRenderer: ({ data }: CellProps) => {
      if (!data) return null;
      const micros = data.kind === "batch" ? data.batch.totalMicros : data.item.amountMicros;
      return <span className={cn("tabular-nums", data.kind === "batch" && "text-foreground")}>{formatCents(micros)}</span>;
    },
  },
  {
    colId: "status",
    headerName: "Status",
    context: { csv: (row: Row) => (row.kind === "batch" ? row.batch.status : (row.item.transactionStatus ?? row.batchStatus)) },
    cellRenderer: ({ data }: CellProps) => {
      if (!data) return null;
      if (data.kind === "batch") return <PayoutStatusBadge status={data.batch.status} />;
      // Until PayPal reports an item status, the item follows its batch.
      return <PayoutStatusBadge status={data.item.transactionStatus ?? data.batchStatus} />;
    },
  },
  {
    colId: "paypalId",
    headerName: "PayPal ID",
    headerHint: "Batch id for a payout, item id for each provider.",
    context: { csv: (row: Row) => (row.kind === "batch" ? row.batch.paypalBatchId : row.item.paypalItemId) },
    cellRenderer: ({ data }: CellProps) => {
      if (!data) return null;
      return <Mono>{data.kind === "batch" ? data.batch.paypalBatchId : data.item.paypalItemId}</Mono>;
    },
  },
];

const DEFAULT_COL_DEF: ColDef<Row> = {
  cellClass: (params) => (params.data?.kind === "batch" ? "cursor-pointer" : undefined),
};

export interface BatchesGridProps {
  batches: readonly PayoutBatch[];
  expanded: ReadonlySet<string>;
  onToggle: (batchId: string) => void;
  onApi?: (api: GridApi<Row>) => void;
}

/** Payout batches, newest first. Click a batch to show one row per provider. */
export function BatchesGrid({ batches, expanded, onToggle, onApi }: BatchesGridProps) {
  const onGridReady = useCallback((event: GridReadyEvent<Row>) => onApi?.(event.api), [onApi]);
  const rows = useMemo(
    () =>
      batches.flatMap((batch): Row[] => {
        const open = expanded.has(batch.id);
        const head: Row = { kind: "batch", id: batch.id, batch, expanded: open };
        return open ? [head, ...batch.items.map((item): Row => ({ kind: "item", id: item.id, item, batchStatus: batch.status }))] : [head];
      }),
    [batches, expanded],
  );
  const handleRowClicked = (event: RowClickedEvent<Row>) => {
    if (event.data?.kind === "batch") onToggle(event.data.id);
  };
  return (
    <DataGrid<Row>
      aria-label="Payout batches"
      data-slot="payout-batches"
      rowData={rows}
      columnDefs={COLUMNS}
      getRowId={getRowId}
      features={FEATURES}
      onGridReady={onGridReady}
      onRowClicked={handleRowClicked}
      defaultColDef={DEFAULT_COL_DEF}
      reserveHeight={`${43 + rows.length * 44 + 2}px`}
    />
  );
}
