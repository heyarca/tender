"use client";

import { ProviderLogo } from "@/components/ui/provider-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, getProviderFixture, type MarketId, type MarketTimeZone } from "@/lib/tender";

import { formatUsdcAtomic } from "./payment-model";
import type { PaidRequestRecord } from "./payment-records";
import { RelativeTime, TxLink } from "./payment-ui";

export interface ReceiptsTableProps {
  records: readonly PaidRequestRecord[];
  marketId: MarketId;
  timeZone: MarketTimeZone;
}

/** Recent paid requests of a market, newest first (OpenRouter `or-table` style). */
export function ReceiptsTable({ records, marketId, timeZone }: ReceiptsTableProps) {
  return (
    <Table aria-label="Recent paid requests" data-slot="payment-receipts">
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Result</TableHead>
          <TableHead align="right" unit="/req" tooltip="Exact provider bid for one request, in USD.">
            Price
          </TableHead>
          <TableHead align="right" unit="USDC" tooltip="Amount transferred on Base Sepolia. USDC settles whole atomic units (0.000001), rounded up.">
            Settled
          </TableHead>
          <TableHead align="right">Latency</TableHead>
          <TableHead align="right">Data age</TableHead>
          <TableHead>Transaction</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => {
          const { receipt } = record;
          const logo = getProviderFixture(marketId, receipt.providerId)?.logo ?? null;
          return (
            <TableRow key={record.id} data-tx={receipt.txHash}>
              <TableCell>
                <span title={format.time(record.at, timeZone, { seconds: true })}>
                  <RelativeTime at={record.at} />
                </span>
              </TableCell>
              <TableCell strong>
                <span className="flex items-center gap-2.5">
                  <ProviderLogo src={logo} name={receipt.providerName} size={20} />
                  <span className="text-xs">{receipt.providerName}</span>
                </span>
              </TableCell>
              <TableCell strong className="tabular-nums">
                {record.summary ?? "—"}
              </TableCell>
              <TableCell numeric strong>
                {format.cost(receipt.price_usd)}
              </TableCell>
              <TableCell numeric strong>
                {formatUsdcAtomic(receipt.settled_atomic)}
              </TableCell>
              <TableCell numeric strong>
                {format.latency(receipt.latency_ms)}
              </TableCell>
              <TableCell numeric strong>
                {format.dataAge(receipt.data_age_ms)}
              </TableCell>
              <TableCell className="py-1.5">
                <TxLink hash={receipt.txHash} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
