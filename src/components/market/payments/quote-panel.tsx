"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { InfoTooltip } from "@/components/ui/tooltip";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { format } from "@/lib/tender";

import { atomicUnitsLabel, formatUsdcAtomic, type PaymentQuoteView } from "./payment-model";
import type { UsdcBalance } from "./payment-records";
import type { BalancesStatus } from "./payments-store";
import { Address } from "./payment-ui";

export interface QuotePanelProps {
  quote: PaymentQuoteView;
  payeeBalance: UsdcBalance | null;
  balancesStatus: BalancesStatus;
}

function BalanceLine({ balance, status }: { balance: UsdcBalance | null; status: BalancesStatus }) {
  if (balance) {
    return (
      <span className="tabular-nums">
        Balance {formatUsdcAtomic(balance.amountAtomic)} <span className="text-faint">USDC</span>
      </span>
    );
  }
  if (status === "error") return <span>Balance unavailable</span>;
  return (
    <span className="flex items-center gap-1.5">
      Balance <Skeleton className="h-3 w-16" />
    </span>
  );
}

/** Provider, exact price, settled USDC amount, and payee of the next paid request. */
export function QuotePanel({ quote, payeeBalance, balancesStatus }: QuotePanelProps) {
  const { amounts } = quote;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" data-slot="payment-quote">
      <StatCard
        label="Provider"
        tone={quote.providerId ? "default" : "warning"}
        leading={quote.providerName ? <ProviderLogo src={quote.logo} name={quote.providerName} size={16} /> : undefined}
        value={<span data-slot="quote-provider">{quote.providerName ?? "No eligible provider"}</span>}
        sub={
          quote.bidPrice !== null ? (
            <>
              {quote.routeLabel} · Bid {format.price(quote.bidPrice)}{" "}
              <span className="text-faint">{format.priceUnit}</span>
            </>
          ) : (
            "No provider meets the policy"
          )
        }
      />
      <StatCard
        label="Price per request"
        value={amounts ? <span data-slot="quote-price">{format.cost(amounts.priceUsd)}</span> : "—"}
        sub={amounts?.rounded ? "Exact bid, before rounding" : "Exact bid ÷ 1,000,000"}
      />
      <StatCard
        label="Settles"
        action={
          <InfoTooltip
            label="How settlement is rounded"
            iconSize={12}
            content="USDC has six decimals, so a request settles whole atomic units of 0.000001 USDC. Fractions round up, never down to zero."
          />
        }
        value={amounts ? <span data-slot="quote-settled">{formatUsdcAtomic(amounts.settledAtomic)}</span> : "—"}
        unit={amounts ? "USDC" : undefined}
        sub={amounts ? (amounts.rounded ? `${atomicUnitsLabel(amounts.settledAtomic)} · rounded up` : atomicUnitsLabel(amounts.settledAtomic)) : "Nothing to settle"}
      />
      <StatCard
        label="Pays to"
        value={quote.payTo ? <Address address={quote.payTo} role="payee" className="text-base" /> : "—"}
        sub={quote.payTo ? <BalanceLine balance={payeeBalance} status={balancesStatus} /> : "No payee"}
      />
    </div>
  );
}
