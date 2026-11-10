"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import type { PayoutBatch, ProviderEarnings } from "@/lib/paypal/payouts";

import { BatchesGrid } from "./batches-grid";
import { EarningsGrid } from "./earnings-grid";
import { formatCents, formatMicros } from "./format";

interface PayoutsData {
  batches: PayoutBatch[];
  earnings: ProviderEarnings[];
}

type Notice = { tone: keyof typeof NOTICE_STYLES; text: string };

const NOTICE_STYLES = {
  positive: "bg-positive-bg text-positive-text",
  neutral: "bg-muted text-foreground",
  negative: "bg-negative-bg text-negative-text",
};

/** How often the page reloads while a batch is not final. */
const POLL_MS = 10_000;
const OPEN_STATUSES = new Set(["PENDING", "PROCESSING", "NEW"]);

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

/** Provider earnings, the Settle now action, and PayPal payout batches. */
export function PayoutsView() {
  const [data, setData] = useState<PayoutsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/payouts", { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));
      setData((await response.json()) as PayoutsData);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load payouts.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasOpenBatch = data?.batches.some((batch) => OPEN_STATUSES.has(batch.status)) ?? false;
  useEffect(() => {
    if (!hasOpenBatch) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [hasOpenBatch, load]);

  const toggle = useCallback((batchId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(batchId)) next.add(batchId);
      return next;
    });
  }, []);

  async function settle() {
    setSettling(true);
    setNotice(null);
    try {
      const response = await fetch("/api/payouts/settle", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { batch?: PayoutBatch; error?: { message?: string } };
      if (body.batch) {
        const batch = body.batch;
        setExpanded((current) => new Set(current).add(batch.id));
      }
      if (response.ok && body.batch) {
        setNotice({ tone: "positive", text: `Sent ${formatCents(body.batch.totalMicros)} to ${body.batch.items.length} ${body.batch.items.length === 1 ? "provider" : "providers"} with PayPal.` });
      } else {
        setNotice({ tone: response.status === 409 ? "neutral" : "negative", text: body.error?.message ?? `Request failed (${response.status}).` });
      }
    } catch {
      setNotice({ tone: "negative", text: "The payout could not be sent. Try again." });
    } finally {
      setSettling(false);
      await load();
    }
  }

  const earnings = data?.earnings ?? [];
  const batches = data?.batches ?? [];
  const unpaid = earnings.reduce((sum, row) => sum + row.unpaidMicros, 0);
  const payable = earnings.reduce((sum, row) => sum + (row.connected ? row.payableMicros : 0), 0);
  const paid = batches.filter((batch) => batch.status === "SUCCESS").reduce((sum, batch) => sum + batch.totalMicros, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          <h1 className="text-title font-medium text-foreground">Payouts</h1>
          <p className="mt-1 max-w-2xl text-body text-muted-foreground">
            Providers earn their bid for every request they serve. Tender pays them with PayPal Payouts, in whole cents.
          </p>
        </div>
        <Button variant="primary" size="lg" className="ml-auto" onClick={settle} disabled={settling || data === null}>
          {settling ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {settling ? "Sending payout…" : "Settle now"}
        </Button>
      </div>

      {notice ? (
        <p role="status" className={`mb-6 rounded-md px-3 py-2 text-body ${NOTICE_STYLES[notice.tone]}`}>
          {notice.text}
        </p>
      ) : null}

      {loadError ? <p className="mb-6 rounded-md bg-negative-bg px-3 py-2 text-body text-negative-text">{loadError}</p> : null}

      <div className="mb-10 grid gap-3 sm:grid-cols-3">
        <StatCard label="Unpaid earnings" value={data ? formatMicros(unpaid) : "—"} />
        <StatCard label="Ready to pay" value={data ? formatCents(payable) : "—"} sub="Connected providers, whole cents" />
        <StatCard label="Paid with PayPal" value={data ? formatCents(paid) : "—"} sub="Successful batches" />
      </div>

      <Section id="earnings" title="Provider earnings" description="Unpaid earnings per provider. Earnings under $0.01 wait for the next payout." framed={false}>
        {data === null ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : earnings.length === 0 ? (
          <EmptyState className="rounded-lg border border-border" icon={<Banknote />} title="No unpaid earnings" description="Earnings appear here after paid requests." />
        ) : (
          <EarningsGrid earnings={earnings} />
        )}
      </Section>

      <Section id="batches" title="Payout batches" description="Each batch pays every connected provider at once. Click a batch to see each provider." framed={false}>
        {data === null ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : batches.length === 0 ? (
          <EmptyState className="rounded-lg border border-border" icon={<Send />} title="No payouts yet" description="Select Settle now to pay provider earnings." />
        ) : (
          <BatchesGrid batches={batches} expanded={expanded} onToggle={toggle} />
        )}
      </Section>
    </div>
  );
}
