"use client";

import { CircleCheck, ExternalLink, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { dollars, usdToMicros } from "@/lib/agent/money";
import { describePolicy, toRoutingPolicy } from "@/lib/agent/policy";
import type { AskUITools } from "@/lib/agent/types";
import { getMarketSpec } from "@/lib/registry";
import { isMarketId } from "@/lib/tender";

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

/** Approval card for a weekly spending limit. Approve saves it for the visitor's account. */
export function SpendingLimitCard({ input, onAnswer }: { input: LimitInput; onAnswer: (output: LimitOutput) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const known = isMarketId(input.marketId);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await postJson<{ weekly_cap: string; spent_this_week: string; policy: string }>("/api/ask/mandate", input);
      onAnswer({ approved: true, ...saved });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the limit");
      setBusy(false);
    }
  };

  return (
    <CardFrame icon={<ShieldCheck aria-hidden="true" />} title="Approve a spending limit">
      <dl className="flex flex-col gap-1.5">
        <Row label="Weekly limit" value={dollars(usdToMicros(input.weeklyCapUsd))} />
        <Row label="Market" value={getMarketSpec(input.marketId)?.name ?? input.marketId} />
        {known ? <Row label="Policy" value={describePolicy(input.marketId, toRoutingPolicy(input.marketId, input.policy))} /> : null}
      </dl>
      <p className="text-caption leading-snug text-muted-foreground">
        Ask Tender can run paid requests up to this amount each week. Charges come from your Tender credits.
      </p>
      {error ? <p className="text-caption text-negative-text">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" disabled={busy} onClick={() => onAnswer({ approved: false, reason: "The user declined the spending limit." })}>
          Decline
        </Button>
        <Button size="sm" variant="primary" disabled={busy || !known} onClick={approve}>
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
      const result = await postJson<{ status: string; balance: string }>("/api/ask/top-up", { orderId: output.order_id });
      setState(result.status === "COMPLETED" ? { kind: "done", balance: result.balance } : { kind: "waiting", note: "PayPal is still processing the payment." });
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
        {state.kind === "idle" ? "Approve the payment in PayPal. Credits arrive right after." : (state.kind === "waiting" && state.note) || "Waiting for PayPal…"}
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
