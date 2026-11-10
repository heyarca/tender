"use client";

import { useMemo, type ReactNode } from "react";
import { BitcoinResult, FieldsResult, PriceFieldsResult, WeatherResult } from "@/components/result";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { StatCard } from "@/components/ui/stat-card";
import { InfoTooltip } from "@/components/ui/tooltip";
import { LatencyStrip } from "@/components/viz/LatencyStrip";
import { getContract, getMarketSpec, type ContractSpec } from "@/lib/registry";
import { format, type MarketView } from "@/lib/tender";
import { useNow, usePendingSwitch, useTenderSelector } from "@/lib/tender/client";
import { cn } from "@/lib/utils";
import {
  providerIdsOf,
  toBitcoinQuote,
  toFieldsReading,
  toPricePoints,
  toResultRequest,
  toTimelineRequests,
  toWeatherReading,
  vizProvidersOf,
} from "./result-mapping";
import { splitUnit } from "./stat-values";
import { useChangeHighlight } from "./use-change-highlight";

/** "12 s ago" for the newest request. Re-renders with the store clock; isolated to keep the page still. */
function UpdatedAgo({ at }: { at: number | null }) {
  const now = useNow();
  if (at === null) return <span>No requests yet</span>;
  return <span className="tabular-nums">Updated {format.relativeTime(at, now)}</span>;
}

type ResultKind = "weather" | "btc" | "price-fields" | "fields";

/**
 * Renderer of a market's result: the served payload kind first (weather, spot price, fields), then
 * the contract's `resultView` before the first result.
 */
function resultKindOf(contract: ContractSpec | undefined, payloadKind: string | undefined): ResultKind {
  if (payloadKind === "weather") return "weather";
  if (payloadKind === "btc") return "btc";
  if (payloadKind === "fields") return contract?.resultView === "price" ? "price-fields" : "fields";
  if (!contract) return "btc";
  if (contract.resultView === "weather") return "weather";
  if (contract.id === "prices.spot") return "btc";
  return contract.resultView === "price" ? "price-fields" : "fields";
}

/** One-line note beside the result title: the price definition, else what data age means here. */
function freshnessNote(contract: ContractSpec | undefined, priceDefinition: string | undefined): string {
  if (priceDefinition) return priceDefinition;
  if (!contract) return "Data age is data freshness, not request latency.";
  if (contract.freshness.basis === "generated") return "Generated on request. Data age is time since generation.";
  return `${contract.freshness.label} is data freshness, not request latency.`;
}

function ResultCard({ view }: { view: MarketView }) {
  const { definition } = view;
  const spec = getMarketSpec(view.id);
  const contract = spec ? getContract(spec.contractId) : undefined;
  const kind = resultKindOf(contract, view.lastServed?.payload.kind);
  const request = useMemo(() => toResultRequest(view.lastResult, view.providersById), [view.lastResult, view.providersById]);
  const providers = useMemo(() => vizProvidersOf(definition), [definition]);
  const points = useMemo(
    () => (kind !== "weather" ? toPricePoints(view.series, view.recentResults) : []),
    [kind, view.series, view.recentResults],
  );
  const timeZone = definition.timeZone;


  let body: ReactNode;
  if (kind === "weather") {
    body = (
      <WeatherResult reading={toWeatherReading(view.lastServed)} request={request} timeZone={timeZone} />
    );
  } else if (kind === "btc" || !contract) {
    body = (
      <BitcoinResult
        quote={toBitcoinQuote(view.lastServed)}
        request={request}
        points={points}
        providers={providers}
        timeZone={timeZone}

        chartHeight={120}
      />
    );
  } else if (kind === "price-fields") {
    body = (
      <PriceFieldsResult
        contract={contract}
        title={spec?.shortName ?? definition.shortName}
        reading={toFieldsReading(view.lastServed)}
        request={request}
        points={points}
        providers={providers}
        timeZone={timeZone}

        chartHeight={120}
      />
    );
  } else {
    body = (
      <FieldsResult
        contract={contract}
        reading={toFieldsReading(view.lastServed)}
        request={request}
        points={points}
        providers={providers}
        timeZone={timeZone}

      />
    );
  }

  return (
    <Card padding="md" className="flex min-w-0 flex-col">
      <CardHeader className="mb-2 items-baseline">
        <div className="flex min-w-0 items-baseline gap-2">
          <CardTitle className="shrink-0">Latest result</CardTitle>
          <CardDescription className="mt-0 truncate max-sm:hidden">
            {freshnessNote(contract, definition.priceDefinition)}
          </CardDescription>
        </div>
        <div className="shrink-0 text-caption text-muted-foreground">
          <UpdatedAgo at={view.lastResult?.requestedAt ?? null} />
        </div>
      </CardHeader>
      {view.lastServed?.params && Object.keys(view.lastServed.params).length ? (
        <dl aria-label="Source input" className="mb-4 space-y-2 rounded-md bg-muted p-3">
          {Object.entries(view.lastServed.params).map(([key, value]) => (
            <div key={key}>
              <dt className="text-caption text-muted-foreground">{contract?.params.find((field) => field.key === key)?.label ?? key}</dt>
              <dd className="text-body whitespace-pre-wrap [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {body}
    </Card>
  );
}

function routeBadge(view: MarketView) {
  const active = view.route.activeProvider;
  if (!active) return <Badge tone="negative">No route</Badge>;
  if (active.role === "pinned-failing") return <Badge tone="negative">Pinned · fails policy</Badge>;
  if (view.route.mode.kind === "pinned") return <Badge tone="active">Pinned</Badge>;
  return <Badge tone="neutral">Automatic</Badge>;
}

function ActiveProviderCard({ view, className }: { view: MarketView; className?: string }) {
  const { definition, route } = view;
  const active = route.activeProvider;
  const pending = usePendingSwitch(view.id);
  const rebased = useTenderSelector((state) => state.rebased);
  const highlight = useChangeHighlight(route.activeProviderId);
  const providers = useMemo(() => vizProvidersOf(definition), [definition]);
  const providerIds = useMemo(() => providerIdsOf(definition), [definition]);
  const timeline = useMemo(() => toTimelineRequests(view.recentResults), [view.recentResults]);

  return (
    <div
      data-slot="active-provider"
      data-highlight={highlight || undefined}
      className={cn(
        "min-w-0 rounded-lg border px-3 py-2.5 transition-[background-color,border-color] duration-1000 ease-smooth-out motion-reduce:transition-none",
        highlight ? "border-accent-border bg-accent duration-quick" : "border-border bg-card",
        className,
      )}
    >
      <div className="flex min-h-5 items-center justify-between gap-1.5">
        <span className="truncate text-caption text-muted-foreground">Active provider</span>
        {routeBadge(view)}
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-2 text-base leading-tight font-medium">
        {active ? (
          <>
            <ProviderLogo src={active.logo} name={active.name} size={20} />
            <span className="truncate text-foreground">{active.name}</span>
            <StatusDot
              tone={active.role === "pinned-failing" ? "negative" : "positive"}
              pulse={active.role !== "pinned-failing"}
              size="sm"
            />
          </>
        ) : (
          <span className="truncate text-negative-text">No eligible provider</span>
        )}
        <span
          className={cn(
            "ml-auto min-w-0 truncate pl-2 text-caption font-normal",
            pending ? "text-warning-text" : "text-muted-foreground",
          )}
        >
          {pending
            ? `Switching in ${pending.secondsRemaining} s`
            : active
              ? rebased ? `Since ${format.time(route.since, definition.timeZone, { milliseconds: false })}` : "Selected route"
              : "Requests rejected"}
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        {active ? `Active provider: ${active.name}` : "No eligible provider"}
      </span>

      <div className="mt-2.5 border-t border-border pt-2">
        <div className="mb-1 flex items-center justify-between gap-2 text-caption text-muted-foreground">
          <span>Recent requests</span>
          <span className="truncate tabular-nums">{format.count(view.metrics.requests.total)} total</span>
        </div>
        <LatencyStrip
          requests={timeline}
          providers={providers}
          providerIds={providerIds}
          limitMs={view.policy.maxP95LatencyMs}
          limitLabel={`P95 limit ${format.latency(view.policy.maxP95LatencyMs)}`}
          height={30}
          barWidth={5}
          timeZone={definition.timeZone}
          showMilliseconds={definition.timeZone === "UTC"}
        />
      </div>
    </div>
  );
}

function MetricCards({ view }: { view: MarketView }) {
  const { metrics, policy } = view;
  const spec = getMarketSpec(view.id);
  const freshnessLabel = (spec && getContract(spec.contractId)?.freshness.label) ?? "Data age";
  const bid = metrics.bidPrice;
  const latency = metrics.p95LatencyMs;
  const age = metrics.dataAgeMs;
  const success = metrics.successRate;
  const [latencyValue, latencyUnit] = latency !== null ? splitUnit(format.latency(latency)) : ["–", ""];
  const [ageValue, ageUnit] = age !== null ? splitUnit(format.dataAge(age)) : ["–", ""];

  return (
    <>
      <StatCard
        label="Request price"
        {...limitProps(
          bid !== null ? (
            <>
              {format.requestCost(bid)}
              <span className="sr-only"> per request</span>
            </>
          ) : null,
        )}
        value={bid !== null ? format.price(bid) : "–"}
        unit={bid !== null ? "/M req" : undefined}
        tone={bid !== null && bid > policy.maxPrice ? "warning" : "default"}
      />
      <StatCard
        label="P95 latency"
        {...limitProps(<>Max {format.latency(policy.maxP95LatencyMs)}</>)}
        value={latencyValue}
        unit={latencyUnit || undefined}
        tone={latency !== null && latency > policy.maxP95LatencyMs ? "warning" : "default"}
      />
      <StatCard
        label={
          <span className="inline-flex items-center gap-1">
            Data freshness
            <InfoTooltip
              label="About data freshness"
              iconSize={12}
              content={`${freshnessLabel}: how old the data is when the provider serves it. It is not request latency.`}
            />
          </span>
        }
        {...limitProps(<>Max {format.dataAge(policy.maxDataAgeMs)}</>)}
        value={ageValue}
        unit={ageUnit || undefined}
        tone={age !== null && age > policy.maxDataAgeMs ? "warning" : "default"}
      />
      <StatCard
        label="Success rate"
        {...limitProps(<>Min {format.percent(policy.minSuccessRate)}</>)}
        value={success !== null ? format.percent(success) : "–"}
        tone={success !== null && success < policy.minSuccessRate ? "warning" : "default"}
      />
    </>
  );
}

/**
 * A policy limit (or the per-request cost) beside the label from `sm`, and on its own line under
 * the value on phones, where the label row has no room for it.
 */
function limitProps(content: ReactNode): { action?: ReactNode; sub?: ReactNode } {
  if (content === null) return {};
  return {
    action: <span className="text-caption text-faint tabular-nums max-sm:hidden">{content}</span>,
    sub: <span className="tabular-nums sm:hidden">{content}</span>,
  };
}

/**
 * The normalized result alongside a compact summary of the route: active provider (with recent
 * requests colored by provider), request price, P95 latency, data freshness, and success rate.
 */
export function MarketOverview({ view }: { view: MarketView }) {
  return (
    <section aria-label="Market overview" className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <ResultCard view={view} />
      <div className="grid content-start gap-2 max-md:grid-cols-2 md:grid-cols-4 lg:grid-cols-2">
        <ActiveProviderCard view={view} className="col-span-2 md:col-span-4 lg:col-span-2" />
        <MetricCards view={view} />
      </div>
    </section>
  );
}
