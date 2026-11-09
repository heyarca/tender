"use client";

import { ArrowRight } from "lucide-react";
import type * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/tooltip";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { format, getProviderFixture, type MarketId, type MarketTimeZone } from "@/lib/tender";
import { cn } from "@/lib/utils";

import { atomicUnitsLabel, formatUsdcAtomic, ROUNDING_NOTE } from "./payment-model";
import type { PaidRequestRecord } from "./payment-records";
import { Address, Amount, RelativeTime, TxLink } from "./payment-ui";

function Field({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="flex items-center gap-1 text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs">{children}</dd>
    </div>
  );
}

export interface ReceiptCardProps {
  record: PaidRequestRecord;
  marketId: MarketId;
  timeZone: MarketTimeZone;
  /** Mark the card as the newest receipt. */
  latest?: boolean;
  className?: string;
}

/**
 * Receipt of one settled paid request: provider and result, exact price vs the
 * settled USDC amount, payer → payee, the Base Sepolia transaction, latency, and data age.
 */
export function ReceiptCard({ record, marketId, timeZone, className }: ReceiptCardProps) {
  const { receipt } = record;
  const logo = getProviderFixture(marketId, receipt.providerId)?.logo ?? null;
  const rounded = receipt.settlement_note ?? (receipt.settled_usd > receipt.price_usd ? ROUNDING_NOTE : undefined);
  return (
    <Card padding="none" className={cn("overflow-hidden", className)} data-slot="payment-receipt">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ProviderLogo src={logo} name={receipt.providerName} size={20} />
          <span className="truncate text-xs font-medium text-foreground">{receipt.providerName}</span>
          <Badge tone="positive">Settled</Badge>
        </div>
        {record.summary ? (
          <span className="text-xs text-foreground tabular-nums" data-slot="payment-summary">
            {record.summary}
          </span>
        ) : null}
        <span className="ml-auto text-caption whitespace-nowrap text-muted-foreground">
          <RelativeTime at={record.at} />
          <span aria-hidden="true"> · </span>
          <time dateTime={format.isoTimestamp(record.at)}>{format.time(record.at, timeZone, { seconds: true })}</time>
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-4">
        <Field label="Price per request">
          <Amount value={format.cost(receipt.price_usd)} />
        </Field>
        <Field
          label={
            <>
              Settled
              {rounded ? <InfoTooltip content={rounded} label="About the settled amount" iconSize={12} /> : null}
            </>
          }
        >
          <Amount value={formatUsdcAtomic(receipt.settled_atomic)} unit="USDC" />
          <span className="block text-caption text-muted-foreground">{atomicUnitsLabel(receipt.settled_atomic)}</span>
        </Field>
        <Field label="Latency">
          <Amount value={format.latency(receipt.latency_ms)} />
        </Field>
        <Field label="Data age">
          <Amount value={format.dataAge(receipt.data_age_ms)} />
        </Field>
      </dl>
      <dl className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-border bg-muted/60 px-4 py-3">
        <Field label="Payer → payee">
          <span className="flex flex-wrap items-center gap-x-1">
            <Address address={receipt.payer} role="payer" />
            <ArrowRight aria-label="to" className="size-3.5 text-muted-foreground" />
            <Address address={receipt.payTo} role="payee" />
          </span>
        </Field>
        <Field label="Transaction">
          <TxLink hash={receipt.txHash} withLabel />
        </Field>
        <Field label="Network" className="sm:ml-auto">
          <span className="text-foreground">Base Sepolia</span>
        </Field>
      </dl>
    </Card>
  );
}
