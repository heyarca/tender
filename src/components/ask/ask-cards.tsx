"use client";

import { CircleCheck, ExternalLink, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { applyBalance } from "@/components/credits/credits-store";
import { formatMicros } from "@/components/credits/money";
import { readVaultStatus, savePayPal } from "@/components/credits/paypal-vault";
import { usdToMicros } from "@/lib/agent/money";
import { AUTO_TOP_UP_MICROS, LOW_BALANCE_MICROS } from "@/lib/ledger/auto-top-up";
import { describePolicy, toRoutingPolicy } from "@/lib/agent/policy";
import type { AskUITools } from "@/lib/agent/types";
import { getMarketSpec } from "@/lib/registry";
import { format, isMarketId, selectMarketView } from "@/lib/tender";
import { useTenderSelector } from "@/lib/tender/client";

type LimitInput = AskUITools["request_spending_limit"]["input"];
type LimitOutput = AskUITools["request_spending_limit"]["output"];

function CardFrame({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5">
      <p className="flex items-center gap-2 text-body font-medium text-foreground [&_svg]:size-4 [&_svg]:text-primary-strong">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-caption">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!response.ok || !data) throw new Error(data?.error?.message ?? "Something went wrong. Try again.");
  return data;
}

type LimitSaved = { weekly_cap: string; spent_this_week: string; policy: string };

/**
 * Approval card for a weekly spending limit. Approve saves it for the visitor's account. With
 * "top up automatically" it also saves the visitor's PayPal in a PayPal window, so Ask Tender can
 * top up by itself within the limit. Answered that way, it stays as a summary (`output`).
 */
export function SpendingLimitCard({ input, output, onAnswer }: { input: LimitInput; output?: LimitOutput; onAnswer?: (output: LimitOutput) => void }) {
  const [paypalSaved, setPayPalSaved] = useState<boolean | null>(null);
  const [autoTopUp, setAutoTopUp] = useState(false);
  const [limit, setLimit] = useState<LimitSaved | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const known = isMarketId(input.marketId);
  const view = useTenderSelector((state) => isMarketId(input.marketId) ? selectMarketView(state.markets[input.marketId]) : null);
  const provider = view?.route.activeProvider;
  const answered = output !== undefined;

  useEffect(() => {
    if (answered) return;
    readVaultStatus()
      .then((status) => setPayPalSaved(status.saved))
      .catch(() => setPayPalSaved(false));
  }, [answered]);

  const approve = async () => {
    setBusy(true);
    setError(null);
    // A limit saved by an earlier attempt (PayPal closed before saving) is not saved again.
    const saved = { limit };
    const saveLimit = async () => {
      saved.limit ??= await postJson<LimitSaved>("/api/ask/mandate", input);
      setLimit(saved.limit);
    };
    try {
      if (autoTopUp && !paypalSaved) {
        const status = await savePayPal(saveLimit);
        if (!status.saved) throw new Error("PayPal was not saved. Try again, or clear the automatic top-up option.");
      } else {
        await saveLimit();
      }
      if (!saved.limit) throw new Error("Could not save the limit");
      onAnswer?.({ approved: true, ...saved.limit, automatic_top_ups: autoTopUp || paypalSaved === true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the limit");
      setBusy(false);
    }
  };

  const policy = known ? describePolicy(input.marketId, toRoutingPolicy(input.marketId, input.policy)) : null;

  if (output?.approved) {
    return (
      <CardFrame icon={<CircleCheck aria-hidden="true" />} title="Spending limit approved">
        <dl className="flex flex-col gap-1.5">
          <Row label="Weekly limit" value={output.weekly_cap ?? formatMicros(usdToMicros(input.weeklyCapUsd))} />
          <Row label="Market" value={getMarketSpec(input.marketId)?.name ?? input.marketId} />
          {output.policy ? <Row label="Policy" value={output.policy} /> : null}
        </dl>
        <p className="flex items-center gap-2 text-caption font-medium text-primary-strong" data-slot="paypal-saved">
          <CircleCheck aria-hidden="true" className="size-3.5" />
          PayPal saved for automatic top-ups
        </p>
      </CardFrame>
    );
  }

  return (
    <CardFrame icon={<ShieldCheck aria-hidden="true" />} title="Approve a spending limit">
      <dl className="flex flex-col gap-1.5">
        <Row label="Weekly limit" value={formatMicros(usdToMicros(input.weeklyCapUsd))} />
        <Row label="Market" value={getMarketSpec(input.marketId)?.name ?? input.marketId} />
        {policy ? <Row label="Policy" value={policy} /> : null}
        <Row label="Current provider" value={provider ? `${provider.name} · ${format.price(provider.conditions.bidPrice)} /M` : "No provider meets the policy"} />
        {paypalSaved ? <Row label="Automatic top-ups" value="PayPal saved" /> : null}
      </dl>
      <p className="text-caption leading-snug text-muted-foreground">
        Ask Tender can run paid requests up to this amount each week. Charges come from your Tender credits.
      </p>
      {paypalSaved === false ? (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5" data-slot="auto-top-up-option">
          <Checkbox className="mt-0.5" checked={autoTopUp} disabled={busy} onCheckedChange={setAutoTopUp} />
          <span className="flex flex-col gap-0.5">
            <span className="text-body leading-snug text-foreground">Let Ask Tender top up automatically with PayPal</span>
            <span className="text-caption leading-snug text-muted-foreground">
              When credits drop below {formatMicros(LOW_BALANCE_MICROS)}, Ask Tender adds {formatMicros(AUTO_TOP_UP_MICROS)} from your PayPal, up to the weekly limit.
            </span>
          </span>
        </label>
      ) : null}
      {busy && autoTopUp && !paypalSaved ? (
        <p className="text-caption leading-snug text-muted-foreground">Save your PayPal account in the PayPal window.</p>
      ) : null}
      {error ? <p className="text-caption text-negative-text">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" disabled={busy} onClick={() => onAnswer?.({ approved: false, reason: "The user declined the spending limit." })}>
          Decline
        </Button>
        <Button size="sm" variant="primary" disabled={busy || !known || paypalSaved === null} onClick={approve}>
          Approve
        </Button>
      </div>
    </CardFrame>
  );
}

type TopUpOutput = { order_id: string; approve_url: string; amount: string };
type TopUpState =
  | { kind: "idle" }
  | { kind: "waiting"; note?: string }
  | { kind: "checking" }
  | { kind: "done"; balance: string };

/** PayPal top-up card: approve in a PayPal window, then the order is captured and credited. */
export function TopUpCard({ output }: { output: TopUpOutput }) {
  const [state, setState] = useState<TopUpState>({ kind: "idle" });
  const popup = useRef<Window | null>(null);

  const check = async () => {
    setState({ kind: "checking" });
    try {
      const result = await postJson<{ status: string; balance: string; balance_micros: number }>("/api/ask/top-up", { orderId: output.order_id });
      if (result.status === "COMPLETED") {
        applyBalance(result.balance_micros);
        setState({ kind: "done", balance: result.balance });
      } else {
        setState({ kind: "waiting", note: "PayPal is still processing the payment." });
      }
    } catch (cause) {
      setState({ kind: "waiting", note: cause instanceof Error ? cause.message : undefined });
    }
  };

  // The PayPal window closes itself after approval; then capture.
  useEffect(() => {
    if (state.kind !== "waiting" || !popup.current) return;
    const timer = window.setInterval(() => {
      if (!popup.current?.closed) return;
      popup.current = null;
      void check();
    }, 800);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- check reads only stable values
  }, [state.kind]);

  const openPayPal = () => {
    popup.current = window.open(output.approve_url, "tender-paypal", "popup,width=480,height=720");
    if (!popup.current) {
      window.location.assign(output.approve_url);
      return;
    }
    setState({ kind: "waiting" });
  };

  if (state.kind === "done") {
    return (
      <CardFrame icon={<CircleCheck aria-hidden="true" />} title={`Added ${output.amount} to your credits`}>
        <dl>
          <Row label="Balance" value={state.balance} />
        </dl>
      </CardFrame>
    );
  }
  return (
    <CardFrame icon={<Wallet aria-hidden="true" />} title={`Add ${output.amount} with PayPal`}>
      <p className="text-caption leading-snug text-muted-foreground">
        {state.kind === "idle"
          ? "Approve this one-off payment in PayPal. Your automatic top-up allowance stays unchanged."
          : (state.kind === "waiting" && state.note) || "Waiting for PayPal…"}
      </p>
      <div className="flex justify-end gap-2">
        {state.kind === "idle" ? null : (
          <Button size="sm" disabled={state.kind === "checking"} onClick={check}>
            Check payment
          </Button>
        )}
        <Button size="sm" variant="primary" onClick={openPayPal}>
          Approve in PayPal
          <ExternalLink aria-hidden="true" />
        </Button>
      </div>
    </CardFrame>
  );
}
