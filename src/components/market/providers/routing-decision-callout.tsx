"use client";

import { Check, CircleAlert, CircleCheck, Pin, Timer, X } from "lucide-react";
import type { ReactNode } from "react";

import { focusSection } from "@/components/market/market-ui";
import { Button } from "@/components/ui/button";
import { ProviderLogo } from "@/components/ui/provider-logo";
import type { CheckId, MarketView, RoutingDecision } from "@/lib/tender";
import { useNow, usePendingSwitch, useTenderActions } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import { checkTone } from "./provider-table-model";

const CHECK_LINE_ORDER: readonly CheckId[] = ["price", "latency", "freshness", "reliability"];
/** Availability first (only shown when it fails), then the four limits in policy-form order. */
const checkRank = (check: CheckId) => (check === "availability" ? -1 : CHECK_LINE_ORDER.indexOf(check));

const FRAME: Record<RoutingDecision["kind"], string> = {
  routing: "border-border bg-card",
  pinned: "border-border bg-card",
  "pending-switch": "border-warning/30 bg-warning-bg",
  "no-eligible": "border-negative/30 bg-negative-bg",
  "pinned-failing": "border-negative/30 bg-negative-bg",
};

function DecisionIcon({ kind }: { kind: RoutingDecision["kind"] }) {
  const className = "mt-0.5 size-4 shrink-0";
  switch (kind) {
    case "routing":
      return <CircleCheck aria-hidden="true" className={cn(className, "text-positive")} />;
    case "pinned":
      return <Pin aria-hidden="true" className={cn(className, "text-accent-foreground")} />;
    case "pending-switch":
      return <Timer aria-hidden="true" className={cn(className, "text-warning")} />;
    case "no-eligible":
    case "pinned-failing":
      return <CircleAlert aria-hidden="true" className={cn(className, "text-negative")} />;
  }
}

export interface RoutingDecisionCalloutProps {
  view: MarketView;
}

/**
 * The routing decision under the table: who serves requests and why, the
 * cooldown countdown, "No eligible provider", and pinned violations with
 * explicit actions.
 */
export function RoutingDecisionCallout({ view }: RoutingDecisionCalloutProps) {
  const { decision } = view;
  const { setRoutingMode, switchToRecommended, resetPolicy } = useTenderActions();
  const marketId = view.id;
  const serving = decision.activeProviderId ? view.providersById[decision.activeProviderId] : null;

  const actions: ReactNode[] = [];
  for (const action of decision.actions) {
    if (action.kind === "switch-to-recommended") {
      actions.push(
        <Button key="switch" variant="primary" size="sm" onClick={() => switchToRecommended(marketId)}>
          {action.label}
        </Button>,
      );
    } else {
      actions.push(
        <Button key="auto" variant="outline" size="sm" onClick={() => setRoutingMode(marketId, { kind: "auto" })}>
          {action.label}
        </Button>,
      );
    }
  }
  if (decision.kind === "pending-switch") {
    actions.push(
      <Button key="now" variant="outline" size="sm" onClick={() => switchToRecommended(marketId)}>
        Switch now
      </Button>,
    );
  }
  if (decision.kind === "pinned") {
    actions.push(
      <Button key="auto" variant="outline" size="sm" onClick={() => setRoutingMode(marketId, { kind: "auto" })}>
        Use automatic switching
      </Button>,
    );
  }
  if (decision.kind === "no-eligible") {
    actions.push(
      <Button key="relax" variant="primary" size="sm" onClick={() => focusSection("routing")}>
        Relax policy
      </Button>,
    );
    if (view.policyModified) {
      actions.push(
        <Button key="reset" variant="outline" size="sm" onClick={() => resetPolicy(marketId)}>
          Reset policy
        </Button>,
      );
    }
  }

  return (
    <section
      aria-labelledby={`${marketId}-decision-title`}
      data-slot="routing-decision"
      data-kind={decision.kind}
      className={cn("mt-4 rounded-lg border px-4 py-3", FRAME[decision.kind])}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 gap-2.5">
          <DecisionIcon kind={decision.kind} />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted-foreground">Routing decision</p>
            <h3 id={`${marketId}-decision-title`} className="text-body font-medium text-foreground">
              {decision.title}
            </h3>
            <p className="text-body text-muted-foreground">{decision.summary}</p>

            {decision.kind === "pending-switch" ? <CooldownProgress view={view} /> : null}

            {(decision.kind === "routing" || decision.kind === "pinned" || decision.kind === "pinned-failing") &&
            serving ? (
              <CheckList
                items={serving.evaluation.checks
                  .filter((c) => CHECK_LINE_ORDER.includes(c.check) || !c.passed)
                  .sort((a, b) => checkRank(a.check) - checkRank(b.check))
                  .map((c) => ({ key: c.check, text: c.message, passed: c.passed, tone: checkTone(c.check) }))}
              />
            ) : null}

            {decision.kind === "no-eligible" ? <ExclusionList view={view} /> : null}

            <DetailLines decision={decision} />
          </div>
        </div>
        {actions.length ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:pl-6.5" data-slot="decision-actions">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CheckList({ items }: { items: { key: string; text: string; passed: boolean; tone: "warning" | "negative" }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption" aria-label="Policy checks">
      {items.map((item) => (
        <li key={item.key} className={cn("inline-flex items-center gap-1 tabular-nums", item.passed ? "text-muted-foreground" : item.tone === "negative" ? "text-negative-text" : "text-warning-text")}>
          {item.passed ? (
            <Check aria-hidden="true" className="size-3.5 shrink-0 text-positive" strokeWidth={2.25} />
          ) : (
            <X aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.25} />
          )}
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Extra lines: excluded-but-better alternatives, best price, pinned notes. */
function DetailLines({ decision }: { decision: RoutingDecision }) {
  // routing / pinned: the first line repeats the checks rendered above; no-eligible lines are rendered with logos.
  const lines =
    decision.kind === "routing" || decision.kind === "pinned"
      ? decision.details.slice(1)
      : decision.kind === "no-eligible"
        ? []
        : decision.details;
  if (!lines.length) return null;
  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-caption text-muted-foreground">
      {lines.map((line) => (
        <li key={line} className="flex gap-1.5">
          <span aria-hidden="true" className="mt-[0.45em] size-1 shrink-0 rounded-full bg-faint" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

/** Every provider with the checks it fails, for "No eligible provider". */
function ExclusionList({ view }: { view: MarketView }) {
  return (
    <ul className="mt-2 grid gap-x-6 gap-y-1 text-caption md:grid-cols-2" aria-label="Why each provider is excluded">
      {view.providers.map((row) => (
        <li key={row.id} className="flex min-w-0 items-start gap-2">
          <ProviderLogo src={row.logo} name={row.name} size={16} className="mt-px" />
          <span className="shrink-0 font-medium text-foreground">{row.name}</span>
          <span className="min-w-0 text-negative-text">{row.evaluation.reasons.map((r) => r.message).join("; ")}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Switching to Slatework in 7 s — switch cooldown" with a progress bar. Re-renders every second. */
function CooldownProgress({ view }: { view: MarketView }) {
  const pending = usePendingSwitch(view.id);
  const now = useNow();
  const scheduled = view.route.pending;
  if (!pending || !scheduled) return null;
  const span = Math.max(1, scheduled.executeAt - scheduled.scheduledAt);
  const progress = Math.min(1, Math.max(0, (now - scheduled.scheduledAt) / span));
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" data-slot="cooldown">
      <div
        role="progressbar"
        aria-label="Switch cooldown"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-1 w-40 overflow-hidden rounded-full bg-warning/20"
      >
        <div
          className="h-full rounded-full bg-warning transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="text-caption font-medium text-warning-text tabular-nums">{pending.label}</span>
    </div>
  );
}
