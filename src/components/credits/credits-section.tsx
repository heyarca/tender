"use client";

import { CircleAlert, LoaderCircle, Wallet } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useRequestInputs } from "@/components/market/market-ui";
import { RequestInputs } from "@/components/market/page/request-inputs";
import { Notice } from "@/components/market/payments/payment-ui";
import { summarizePayload } from "@/components/market/payments/payment-model";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { format, getProviderFixture, PREFERENCE_LABELS, type MarketId } from "@/lib/tender";
import { useMarketView, useTenderStore } from "@/lib/tender/client";
import { AddFundsDialog } from "./add-funds-dialog";
import { applyBalance, refreshAccount, setAddFundsOpen, useCreditsStore } from "./credits-store";
import { creditsRequestUrl, type CreditsErrorResponse, type CreditsResponse } from "./credits-request";
import { formatMicros } from "./money";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; response: CreditsResponse }
  | { kind: "short"; balanceMicros: number }
  | { kind: "error"; message: string };

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * "Pay with credits": runs the market's contract request paid from the Tender balance
 * (`Tender-Payment: credits`) and shows the result, the amount charged, and the new balance.
 */
export function CreditsSection({ marketId }: { marketId: MarketId }) {
  const view = useMarketView(marketId);
  const store = useTenderStore();
  const { params, error: inputError } = useRequestInputs(marketId);
  const status = useCreditsStore((state) => state.status);
  const balanceMicros = useCreditsStore((state) => state.balanceMicros);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const running = useRef(false);

  const policy = view.policy;
  const routeLabel = policy.mode.kind === "pinned" ? "your pinned provider" : `your routing policy (${PREFERENCE_LABELS[policy.preference]})`;

  const handleRun = useCallback(async () => {
    if (running.current || inputError) return;
    if (useCreditsStore.getState().status === "ready" && useCreditsStore.getState().balanceMicros === 0) {
      setAddFundsOpen(true);
      return;
    }
    running.current = true;
    setRun({ kind: "running" });
    try {
      const response = await fetch(creditsRequestUrl(marketId, policy, params), {
        headers: { "Tender-Payment": "credits", Accept: "application/json" },
        cache: "no-store",
      });
      const body = (await response.json()) as CreditsResponse & CreditsErrorResponse;
      if (response.status === 402 && body.error?.code === "insufficient_credits") {
        setRun({ kind: "short", balanceMicros: body.balance_micros ?? 0 });
        void refreshAccount();
        setAddFundsOpen(true);
      } else if (!response.ok || body.payment?.method !== "credits") {
        setRun({ kind: "error", message: body.error?.message ?? "The request failed. Nothing was charged." });
      } else {
        applyBalance(body.payment.balance_micros);
        setRun({ kind: "done", response: body });
        store.actions.ingestServed("credits", [
          {
            request_id: body.request_id,
            market: marketId,
            provider: body.provider,
            latency_ms: body.latency_ms,
            data_age_ms: body.data_age_ms,
            price_usd: body.price_usd,
            charged_micros: body.payment.charged_micros,
            served_at: new Date().toISOString(),
            data: body.data,
            params: body.params ?? params,
          },
        ]);
      }
    } catch {
      setRun({ kind: "error", message: "Could not reach Tender. Check your connection and try again." });
    } finally {
      running.current = false;
    }
  }, [marketId, policy, store, params, inputError]);

  const done = run.kind === "done" ? run.response : null;
  const provider = done ? getProviderFixture(marketId, done.provider) : undefined;

  return (
    <Section
      id="credits"
      icon={<Wallet aria-hidden="true" />}
      title="Pay with credits"
      description="Run a request paid from your Tender balance. Each request costs the winning bid. Add funds with PayPal."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setAddFundsOpen(true)}>
            Add funds
          </Button>
          <ButtonLink href="/account" variant="ghost" size="sm">
            Account
          </ButtonLink>
        </>
      }
      data-market={marketId}
    >
      <div className="flex flex-col gap-5">
        <RequestInputs marketId={marketId} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Button
            variant="primary"
            onClick={handleRun}
            disabled={run.kind === "running" || !!inputError}
            aria-describedby={inputError ? `request-${marketId}-error` : undefined}
            data-slot="run-with-credits"
          >
            {run.kind === "running" ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <Wallet aria-hidden="true" />}
            {run.kind === "running" ? "Running…" : "Run with credits"}
          </Button>
          <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <span>Balance</span>
            {status === "ready" || status === "error" ? (
              <span className="tabular-nums text-foreground" data-slot="credits-balance">
                {status === "error" ? "unavailable" : formatMicros(balanceMicros)}
              </span>
            ) : (
              <Skeleton className="h-3.5 w-16" />
            )}
          </div>
          <p className="w-full text-caption text-muted-foreground sm:ml-auto sm:w-auto">Routed by {routeLabel}.</p>
        </div>

        {run.kind === "short" ? (
          <Notice tone="warning" icon={<CircleAlert aria-hidden="true" />} title="Not enough credits">
            Your balance is {formatMicros(run.balanceMicros)}. Add funds to run this request. Nothing was charged.
          </Notice>
        ) : null}
        {run.kind === "error" ? (
          <Notice role="alert" tone="negative" icon={<CircleAlert aria-hidden="true" />} title="Request failed">
            {run.message}
          </Notice>
        ) : null}

        {done ? (
          <div className="rounded-lg border border-border p-4" data-slot="credits-result">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Result">{summarizePayload(marketId, { data: done.data }) ?? "Done"}</Stat>
              <Stat label="Provider">
                <span className="flex items-center gap-2">
                  <ProviderLogo src={provider?.logo ?? null} name={provider?.name ?? done.provider} size={16} />
                  <span className="truncate">{provider?.name ?? done.provider}</span>
                </span>
              </Stat>
              <Stat label="Charged">{formatMicros(done.payment.charged_micros)}</Stat>
              <Stat label="New balance">{formatMicros(done.payment.balance_micros)}</Stat>
            </dl>
            <p className="mt-3 border-t border-border pt-3 text-caption text-muted-foreground tabular-nums">
              {format.latency(done.latency_ms)} · data {format.dataAge(done.data_age_ms)} old · {done.request_id}
            </p>
          </div>
        ) : run.kind === "idle" || run.kind === "running" ? (
          <div className="rounded-lg border border-dashed border-border">
            <EmptyState
              icon={<Wallet aria-hidden="true" />}
              title="No requests with credits yet"
              description={`Run a request to see the ${view.definition.shortName} result and what it cost.`}
              className="py-7"
            />
          </div>
        ) : null}
      </div>
      <AddFundsDialog />
    </Section>
  );
}
