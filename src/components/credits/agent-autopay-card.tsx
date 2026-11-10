"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Notice } from "@/components/market/payments/payment-ui";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { toast } from "@/components/ui/toast";
import { AUTO_TOP_UP_MICROS, LOW_BALANCE_MICROS } from "@/lib/ledger/auto-top-up";
import { useCreditsStore } from "./credits-store";
import { formatMicros } from "./money";
import { readVaultStatus, removeSavedPayPal, savePayPal, type VaultStatus } from "./paypal-vault";

/** Account page: the saved PayPal Ask Tender tops up from, the weekly limit, and this week's automatic top-ups. */
export function AgentAutopayCard() {
  const revision = useCreditsStore((state) => state.revision);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readVaultStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  /** Runs a save or remove, then shows the new status. `success` names the toast for the new status, if any. */
  const run = async (action: () => Promise<VaultStatus>, success: (next: VaultStatus) => string | null) => {
    setBusy(true);
    try {
      const next = await action();
      setStatus(next);
      const title = success(next);
      if (title) toast({ title });
    } catch (cause) {
      toast({ tone: "negative", title: cause instanceof Error ? cause.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const cap = status?.weekly_cap_micros ?? null;
  return (
    <Section
      id="automatic-top-ups"
      icon={<RefreshCw aria-hidden="true" />}
      title="Automatic top-ups"
      description={`With a saved PayPal and a weekly limit, Ask Tender adds ${formatMicros(AUTO_TOP_UP_MICROS)} by itself when your credits drop below ${formatMicros(LOW_BALANCE_MICROS)}. It never adds more than the weekly limit in one week.`}
    >
      {failed ? (
        <Notice tone="negative">Automatic top-ups could not be loaded. Reload the page to try again.</Notice>
      ) : status === null ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="flex flex-col gap-4" data-slot="automatic-top-ups">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Saved PayPal" value={status.saved ? (status.email ?? "PayPal account") : "Not saved"} tone={status.saved ? "default" : "muted"} />
            <StatCard label="Weekly limit" value={cap === null ? "Not set" : formatMicros(cap)} tone={cap === null ? "muted" : "default"} />
            <StatCard
              label="Added by Ask Tender this week"
              value={formatMicros(status.top_ups_this_week_micros)}
              unit={cap === null ? undefined : `of ${formatMicros(cap)}`}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-caption text-muted-foreground">
              {cap === null ? "Approve a weekly limit in Ask Tender to turn on automatic top-ups." : status.saved ? "Ask Tender tops up without asking you." : "Save PayPal to let Ask Tender top up without asking you."}
            </p>
            {status.saved ? (
              <Button variant="destructive-outline" disabled={busy} onClick={() => void run(removeSavedPayPal, () => "Saved PayPal removed")}>
                {busy ? "Removing…" : "Remove saved PayPal"}
              </Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => void run(() => savePayPal(), (next) => (next.saved ? "PayPal saved for automatic top-ups" : null))}>
                {busy ? "Waiting for PayPal…" : "Save PayPal"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
