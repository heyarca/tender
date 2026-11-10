"use client";

import { CircleAlert, CircleDollarSign, LoaderCircle, Receipt, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/tooltip";
import { usePaidRequest } from "@/lib/payments/client";
import { format, getMarketDefinition, type MarketId, PREFERENCE_LABELS } from "@/lib/tender";
import { useMarketView, useNow, usePendingSwitch, useTenderStore } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import { focusSection, useRequestInputs, type MarketSectionProps } from "../market-ui";
import { deriveSteps, describeFailure } from "./payment-flow";
import {
  buildPaymentQuote,
  formatUsdcAtomic,
  modifiedConditions,
  paymentPolicy,
  ROUNDING_NOTE,
  shortAddress,
  summarizePayload,
  type PaymentQuoteView,
} from "./payment-model";
import { payeeBalance } from "./payment-records";
import { PaymentProgress } from "./payment-progress";
import { Address, Notice, RelativeTime } from "./payment-ui";
import { paymentsStore, usePaymentsState } from "./payments-store";
import { QuotePanel } from "./quote-panel";
import { ReceiptCard } from "./receipt-card";
import { ReceiptsTable } from "./receipts-table";

const sectionLinkClass =
  "cursor-pointer rounded-sm text-accent-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/** Rows of the receipts table before "Show all". */
const TABLE_PREVIEW_ROWS = 5;

/** Balances older than this are read again when the section mounts. */
const BALANCES_STALE_MS = 30_000;
/**
 * Second balance read after a payment, for RPC nodes that lag a block behind.
 * Longer than the balances endpoint's 5 s cache so it is a fresh read.
 */
const BALANCES_RECHECK_MS = 6_000;

interface Attempt {
  marketId: MarketId;
  providerName: string | null;
  quote: { settledAtomic: string; payTo: string | null } | null;
  startedAt: number;
  /** Wall-clock duration of the paid request, once it finished. */
  elapsedMs: number | null;
}

function SubHeading({ children, info, aside }: { children: ReactNode; info?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
      <h3 className="text-xs font-medium text-foreground">{children}</h3>
      {info ? <InfoTooltip content={info} iconSize={12} label={`About ${typeof children === "string" ? children.toLowerCase() : "this"}`} /> : null}
      {aside ? <div className="ml-auto flex items-center gap-2 text-caption text-muted-foreground">{aside}</div> : null}
    </div>
  );
}

/** Countdown text for the rate limit; isolated so only it ticks every second. */
function RetryCountdown({ retryAt }: { retryAt: number }) {
  const now = useNow();
  if (now >= retryAt) return null;
  return <span className="tabular-nums">Try again in {format.countdown(retryAt, now)}.</span>;
}

/**
 * The console route can lag the per-request selection (an optimization switch
 * waits for the cooldown). Paid requests select per request, like the API.
 */
function ConsoleRouteNote({ marketId, consoleName, paidName }: { marketId: MarketId; consoleName: string; paidName: string }) {
  const pending = usePendingSwitch(marketId);
  return (
    <Notice tone="neutral" data-slot="payment-console-note">
      {pending && pending.providerName === paidName
        ? `The console switches from ${consoleName} to ${paidName} in ${pending.secondsRemaining} s (switch cooldown). `
        : `The console routes to ${consoleName}. `}
      Paid requests are routed per request, so the next one pays {paidName}.
    </Notice>
  );
}

/** Clears the stored retry time once it passes. */
function useRetryExpiry(retryAt: number | null) {
  useEffect(() => {
    if (retryAt === null) return;
    const timer = setTimeout(() => paymentsStore.setRetryAt(null), Math.max(0, retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [retryAt]);
}

function routingNote(quote: PaymentQuoteView, edited: string[]): string {
  const route = quote.selection.policy.mode.kind === "pinned" ? "your pinned provider" : `your routing policy (${PREFERENCE_LABELS[quote.selection.policy.preference]})`;
  if (edited.length === 0) return `Routed by ${route}.`;
  const names = edited.length <= 2 ? edited.join(" and ") : `${edited.length} providers`;
  return `Routed by ${route} with edited conditions for ${names}.`;
}

/**
 * "Pay with USDC": run a request that is paid per call in USDC with x402.
 * Tender settles the exact winning bid (rounded up to whole atomic units) to
 * the winning provider's address on Base Sepolia and returns the receipt.
 */
export function PaymentsSection({ marketId }: MarketSectionProps) {
  const view = useMarketView(marketId);
  const store = useTenderStore();
  const { params, error: inputError } = useRequestInputs(marketId);
  const definition = getMarketDefinition(marketId);
  const { run, pending, error, failure, stage } = usePaidRequest(marketId);
  const payments = usePaymentsState();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [showAll, setShowAll] = useState(false);
  const starting = useRef(false);

  const quote = useMemo(() => buildPaymentQuote(view), [view]);
  const edited = useMemo(() => view.providers.filter((row) => row.modified).map((row) => row.name), [view.providers]);
  const records = payments.records[marketId] ?? [];
  const latest = records[0] ?? null;

  const balances = payments.balances;
  const payer = balances?.payer ?? null;
  const payee = payeeBalance(balances, quote.providerId);
  const payerMissing = payments.balancesStatus === "ready" && balances !== null && payer === null;
  const payerAtomic = payer ? BigInt(payer.amountAtomic) : null;
  const insufficient =
    payerAtomic !== null && quote.amounts !== null && payerAtomic < BigInt(quote.amounts.settledAtomic);

  const inFlightElsewhere = payments.inFlight !== null && payments.inFlight.marketId !== marketId;
  const inFlightHere = pending || payments.inFlight?.marketId === marketId;
  const failureView = pending ? null : describeFailure(failure, error);
  const rateLimited = payments.retryAt !== null;

  useRetryExpiry(payments.retryAt);

  // Balances: read on mount when missing or stale.
  useEffect(() => {
    const { balancesAt, balancesStatus } = paymentsStore.getState();
    if (balancesStatus === "loading") return;
    if (balancesAt === null || Date.now() - balancesAt > BALANCES_STALE_MS) void paymentsStore.refreshBalances();
  }, []);

  // A 429 blocks new attempts until Retry-After passes.
  useEffect(() => {
    if (failure?.status === 429) paymentsStore.setRetryAt(Date.now() + (failure.retryAfterSeconds ?? 60) * 1000);
  }, [failure]);

  const blockedReason = inputError ?? quote.blocker?.message
    ?? (payerMissing ? "The payer wallet is not configured." : null)
    ?? (insufficient ? "The payer balance is below the settled amount." : null)
    ?? (inFlightElsewhere ? `A paid request for ${getMarketDefinition(payments.inFlight!.marketId).name} is still settling.` : null);
  const disabled = inFlightHere || inFlightElsewhere || rateLimited || blockedReason !== null;

  const handleRun = useCallback(async () => {
    if (starting.current || disabled) return;
    starting.current = true;
    const startedAt = Date.now();
    setAttempt({
      marketId,
      providerName: quote.providerName,
      quote: quote.amounts ? { settledAtomic: quote.amounts.settledAtomic, payTo: quote.payTo } : null,
      startedAt,
      elapsedMs: null,
    });
    paymentsStore.start(marketId, startedAt);
    try {
      const result = await run({ params, policy: paymentPolicy(view.policy), conditions: modifiedConditions(view.providers) });
      const finishedAt = Date.now();
      setAttempt((current) => (current && current.startedAt === startedAt ? { ...current, elapsedMs: finishedAt - startedAt } : current));
      if (result) {
        paymentsStore.addRecord(marketId, result.receipt, summarizePayload(marketId, result.response), finishedAt);
        const response = result.response;
        if (typeof response.request_id === "string" && response.data && typeof response.data === "object" && !Array.isArray(response.data)) {
          store.actions.ingestServed("usdc", [{
            request_id: response.request_id, market: marketId, provider: response.provider,
            latency_ms: response.latency_ms, data_age_ms: response.data_age_ms,
            price_usd: result.receipt.settled_usd, served_at: new Date(finishedAt).toISOString(),
            data: response.data as Record<string, unknown>, params: response.params ?? params,
          }]);
        }
      }
    } finally {
      paymentsStore.finish();
      starting.current = false;
      void paymentsStore.refreshBalances();
      setTimeout(() => void paymentsStore.refreshBalances(), BALANCES_RECHECK_MS);
    }
  }, [disabled, marketId, quote.amounts, quote.payTo, quote.providerName, run, view.policy, view.providers, params, store]);

  const steps = deriveSteps({
    pending: inFlightHere,
    stage: pending ? stage : null,
    quote: attempt?.quote ?? null,
    receipt: latest?.receipt ?? null,
    failure: failureView,
  });

  let progressAside: ReactNode = null;
  if (inFlightHere) progressAside = `Paying ${attempt?.providerName ?? "the provider"}…`;
  else if (failureView) progressAside = failureView.step ? "Last attempt failed" : null;
  else if (attempt?.elapsedMs != null && latest) progressAside = `Completed in ${format.latency(attempt.elapsedMs)}`;
  else if (latest) {
    progressAside = (
      <>
        Last paid request · <RelativeTime at={latest.at} />
      </>
    );
  }

  // Screen reader announcement for the in-flight stages and the result.
  const announcement = inFlightHere
    ? stage === "signed"
      ? "USDC authorization signed. Waiting for settlement on Base Sepolia."
      : stage === "payment-required"
        ? "Payment required. Signing the USDC authorization."
        : "Paid request started."
    : latest && attempt && !failureView && attempt.elapsedMs !== null
      ? `Settled ${formatUsdcAtomic(latest.receipt.settled_atomic)} USDC to ${latest.receipt.providerName}. Transaction ${shortAddress(latest.receipt.txHash, 10, 6)}.`
      : "";

  return (
    <Section
      id="payments"
      icon={<CircleDollarSign aria-hidden="true" />}
      title="Pay with USDC"
      description="Run a request paid per call in USDC. Tender settles to the winning provider on Base Sepolia."
      actions={
        <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-info" />
          Base Sepolia
          <Badge tone="neutral">Testnet</Badge>
        </span>
      }
      data-market={marketId}
    >
      <div className="flex flex-col gap-6">
        <div>
          <SubHeading
            info="The same per-request selection as the paid API: your routing policy and current provider conditions. The bid is quoted in the 402 response and settled exactly, rounded up to whole USDC atomic units."
          >
            Next paid request
          </SubHeading>
          <QuotePanel quote={quote} payeeBalance={payee} balancesStatus={payments.balancesStatus} />
          <div className="mt-2.5 flex flex-col gap-2">
            <p className="text-caption text-muted-foreground" data-slot="payment-routing-note">
              {routingNote(quote, edited)}{" "}
              <button type="button" className={sectionLinkClass} onClick={() => focusSection(quote.blocker?.kind === "no-eligible" ? "routing" : "conditions")}>
                {quote.blocker?.kind === "no-eligible" ? "Edit routing policy" : "Edit provider conditions"}
              </button>
            </p>
            {quote.amounts?.rounded && quote.bidPrice !== null ? (
              <p className="text-caption text-muted-foreground" data-slot="payment-rounding-note">
                {format.priceWithUnit(quote.bidPrice)} is {format.cost(quote.amounts.priceUsd)} per request. {ROUNDING_NOTE}.
              </p>
            ) : null}
            {quote.violation && quote.blocker?.kind !== "unavailable" ? (
              <Notice tone="warning" icon={<TriangleAlert aria-hidden="true" />}>
                {quote.violation} Paid requests still go to {quote.providerName}.
              </Notice>
            ) : null}
            {quote.consoleProviderName && quote.providerName && !quote.blocker ? (
              <ConsoleRouteNote marketId={marketId} consoleName={quote.consoleProviderName} paidName={quote.providerName} />
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button variant="primary" onClick={handleRun} disabled={disabled} aria-describedby="payments-run-status" data-slot="run-paid-request">
            {inFlightHere ? (
              <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
            ) : (
              <CircleDollarSign aria-hidden="true" />
            )}
            {inFlightHere ? "Paying…" : "Run paid request"}
          </Button>
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-muted-foreground">
            <span>Payer</span>
            {payer ? (
              <>
                <Address address={payer.address} role="payer" />
                <span className="tabular-nums text-foreground" data-slot="payer-balance">
                  {formatUsdcAtomic(payer.amountAtomic)}
                </span>
                <span>USDC</span>
              </>
            ) : (
              payments.balancesStatus === "error" || payerMissing ? (
                <span>{payerMissing ? "not configured" : "balance unavailable"}</span>
              ) : (
                <Skeleton className="h-3.5 w-40" />
              )
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh balances"
              title="Refresh balances"
              onClick={() => void paymentsStore.refreshBalances()}
              disabled={payments.balancesStatus === "loading"}
            >
              <RefreshCw aria-hidden="true" className={cn(payments.balancesStatus === "loading" && "motion-safe:animate-spin")} />
            </Button>
          </div>
          <p id="payments-run-status" className="w-full text-caption text-muted-foreground empty:hidden sm:ml-auto sm:w-auto">
            {payments.retryAt !== null ? <RetryCountdown retryAt={payments.retryAt} /> : blockedReason}
          </p>
        </div>

        {failureView ? (
          <Notice role="alert" tone={failureView.kind === "rate-limit" ? "warning" : "negative"} icon={<CircleAlert aria-hidden="true" />} title={failureView.title}>
            {failureView.description}
            {failureView.txHash ? <> Transaction {shortAddress(failureView.txHash, 10, 6)}.</> : null}
          </Notice>
        ) : null}

        <div>
          <SubHeading aside={progressAside}>Progress</SubHeading>
          <PaymentProgress steps={steps} />
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>

        <div>
          <SubHeading
            info="Receipts are kept in this browser. Each links to its Base Sepolia transaction."
            aside={records.length > 0 ? <span className="tabular-nums">{records.length} paid</span> : null}
          >
            Latest receipt
          </SubHeading>
          {latest ? (
            <ReceiptCard record={latest} marketId={marketId} timeZone={definition.timeZone} latest />
          ) : (
            <div className="rounded-lg border border-dashed border-border">
              <EmptyState
                icon={<Receipt aria-hidden="true" />}
                title="No paid requests yet"
                description={`Run a paid request to settle ${definition.shortName} in USDC and see its receipt and transaction.`}
                className="py-7"
              />
            </div>
          )}
        </div>

        {records.length > 0 ? (
          <div>
            <SubHeading>Recent paid requests</SubHeading>
            <ReceiptsTable
              records={showAll ? records : records.slice(0, TABLE_PREVIEW_ROWS)}
              marketId={marketId}
              timeZone={definition.timeZone}
            />
            {records.length > TABLE_PREVIEW_ROWS ? (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll}>
                {showAll ? "Show fewer" : `Show all ${records.length}`}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Section>
  );
}
