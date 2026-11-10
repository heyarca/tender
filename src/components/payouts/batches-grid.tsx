"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import type { CustomCellRendererProps } from "ag-grid-react";
import type { ColDef, RowClickedEvent } from "ag-grid-community";

import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import type { PayoutBatch, PayoutItem } from "@/lib/paypal/payouts";
import { cn } from "@/lib/utils";

import { formatCents, formatDateTime } from "./format";
import { PayoutStatusBadge } from "./payout-status-badge";
import { ProviderName } from "./provider-name";

/** A batch row, followed by its item rows when the batch is expanded. */
type Row =
  | { kind: "batch"; id: string; batch: PayoutBatch; expanded: boolean }
  | { kind: "item"; id: string; item: PayoutItem; batchStatus: string };

type CellProps = CustomCellRendererProps<Row>;

const getRowId = (row: Row) => row.id;

const Mono = ({ children }: { children: string | null }) =>
  children ? <span className="font-mono text-caption text-foreground">{children}</span> : <span className="text-faint">—</span>;

const COLUMNS: DataGridColumn<Row>[] = [
  {
    colId: "time",
    headerName: "Sent",
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
    cellRenderer: ({ data }: CellProps) => (data?.kind === "item" ? <span>{data.item.receiver}</span> : null),
  },
  {
    colId: "amount",
    headerName: "Amount",
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
}

/** Payout batches, newest first. Click a batch to show one row per provider. */
export function BatchesGrid({ batches, expanded, onToggle }: BatchesGridProps) {
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
      onRowClicked={handleRowClicked}
      defaultColDef={DEFAULT_COL_DEF}
      reserveHeight={`${43 + rows.length * 44 + 2}px`}
    />
  );
}
