"use client";

import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  Ban,
  Check,
  CircleCheck,
  CircleX,
  Gauge,
  History,
  ListChecks,
  OctagonX,
  Pause,
  Pin,
  PinOff,
  Play,
  RotateCcw,
  Route,
  Shuffle,
  Tag,
  Timer,
  TimerOff,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tooltip } from "@/components/ui/tooltip";
import {
  format,
  getProviderFixture,
  type ActivityEntry,
  type MarketId,
  type MarketTimeZone,
  type ProviderId,
  type RouteEstablishedEntry,
  type RouteSwitchEntry,
  type Tone,
} from "@/lib/tender";
import { useMarketView, useNow, useRouteEvents } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import type { MarketSectionProps } from "../market-ui";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_PAGE_SIZE,
  countByFilter,
  EMPTY_COPY,
  filterActivity,
  parseRouteSwitchDetails,
  TRIGGER_LABELS,
  type ActivityFilter,
} from "./activity-helpers";

const KIND_ICONS: Record<ActivityEntry["kind"], LucideIcon> = {
  "route-established": Route,
  "route-switch": ArrowRightLeft,
  "no-eligible": OctagonX,
  "switch-scheduled": Timer,
  "switch-cancelled": TimerOff,
  "pin-violation": PinOff,
  "pin-recovered": Pin,
  "request-served": CircleCheck,
  "request-failed": CircleX,
  "request-rejected": Ban,
  "bid-updated": Tag,
  "conditions-updated": Gauge,
  "provider-restored": RotateCcw,
  "conditions-reset": RotateCcw,
  "policy-updated": ListChecks,
  "policy-reset": RotateCcw,
  "policy-restored": History,
  "mode-changed": Shuffle,
  "auto-run": Play,
};

const TILE_TONE: Record<Tone, string> = {
  neutral: "border-border bg-background text-muted-foreground",
  positive: "border-transparent bg-positive-bg text-positive-text",
  warning: "border-transparent bg-warning-bg text-warning-text",
  negative: "border-transparent bg-negative-bg text-negative-text",
};

const TRIGGER_TONE: Record<RouteSwitchEntry["trigger"], BadgeTone> = {
  failover: "warning",
  optimization: "positive",
  "policy-change": "neutral",
  "mode-change": "neutral",
  recovery: "positive",
  "operator-switch": "neutral",
  restored: "neutral",
};

/** Provider an entry is about, for the inline logo. */
function entryProviderId(entry: ActivityEntry): ProviderId | null {
  switch (entry.kind) {
    case "request-served":
    case "request-failed":
    case "bid-updated":
    case "conditions-updated":
    case "provider-restored":
    case "pin-violation":
    case "pin-recovered":
      return entry.providerId;
    case "route-established":
    case "switch-cancelled":
      return entry.toProviderId;
    case "switch-scheduled":
      return entry.toProviderId;
    case "mode-changed":
      return entry.mode.kind === "pinned" ? entry.mode.providerId : null;
    default:
      return null;
  }
}

/** Activity: chronological feed of bids, conditions, policy edits, requests, and routing decisions. */
export function ActivitySection({ marketId }: MarketSectionProps) {
  return (
    <Section
      id="activity"
      icon={<Activity aria-hidden="true" />}
      title="Activity"
      description="Bids, condition changes, policy edits, requests, and routing decisions for this market, newest first."
      data-market={marketId}
    >
      <ActivityFeed key={marketId} marketId={marketId} />
    </Section>
  );
}

function ActivityFeed({ marketId }: { marketId: MarketId }) {
  const view = useMarketView(marketId);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [limit, setLimit] = useState(ACTIVITY_PAGE_SIZE);
  const [announcement, setAnnouncement] = useState("");
  useRouteEvents(marketId, (event) => setAnnouncement(event.title));

  const counts = countByFilter(view.activity);
  const entries = filterActivity(view.activity, filter);
  const visible = entries.slice(0, limit);
  const remaining = entries.length - visible.length;
  const timeZone = view.definition.timeZone;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl<ActivityFilter>
            items={ACTIVITY_FILTERS.map((item) => ({
              ...item,
              "aria-label": `${item.label} (${counts[item.value]})`,
            }))}
            value={filter}
            onValueChange={(next) => {
              setFilter(next);
              setLimit(ACTIVITY_PAGE_SIZE);
            }}
            aria-label="Filter activity"
          />
        </div>
        <span className="ml-auto text-caption text-muted-foreground tabular-nums">
          {entries.length === 1 ? "1 event" : `${format.count(entries.length)} events`}
        </span>
      </div>

      {visible.length ? (
        <ol aria-label="Activity" className="overflow-hidden rounded-lg border border-border bg-card">
          {visible.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} marketId={marketId} timeZone={timeZone} />
          ))}
        </ol>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={<Activity aria-hidden="true" />}
            title={EMPTY_COPY[filter].title}
            description={EMPTY_COPY[filter].description}
          />
        </div>
      )}

      {remaining > 0 ? (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setLimit((current) => current + ACTIVITY_PAGE_SIZE)}>
            Show {Math.min(remaining, ACTIVITY_PAGE_SIZE)} more
          </Button>
          <span className="text-caption text-muted-foreground tabular-nums">
            Showing {visible.length} of {entries.length}
          </span>
        </div>
      ) : null}

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function ActivityRow({ entry, marketId, timeZone }: { entry: ActivityEntry; marketId: MarketId; timeZone: MarketTimeZone }) {
  const isSwitch = entry.kind === "route-switch";
  const Icon = entry.kind === "auto-run" && !entry.enabled ? Pause : KIND_ICONS[entry.kind];
  const providerId = entryProviderId(entry);
  const provider = providerId ? getProviderFixture(marketId, providerId) : undefined;

  return (
    <li
      data-kind={entry.kind}
      className={cn(
        "relative flex gap-3 border-b border-border px-4 py-2.5 last:border-b-0",
        "transition-[opacity,translate] duration-fast ease-smooth-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none",
        isSwitch && "bg-accent-subtle before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary",
        entry.kind === "no-eligible" && "bg-negative-bg/50 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-negative",
        entry.kind === "pin-violation" && "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-negative",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-px flex size-6 shrink-0 items-center justify-center rounded-md border [&_svg]:size-3.5",
          isSwitch ? "border-transparent bg-accent text-accent-foreground" : TILE_TONE[entry.tone],
        )}
      >
        <Icon strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {entry.kind === "route-switch" ? (
              <SwitchTitle entry={entry} marketId={marketId} />
            ) : (
              <p className="flex min-w-0 items-center gap-2 text-xs text-foreground">
                {provider ? <ProviderLogo src={provider.logo} name={provider.name} size={16} /> : null}
                <span className="min-w-0">{entry.title}</span>
              </p>
            )}
          </div>
          <RelativeTime at={entry.at} timeZone={timeZone} />
        </div>
        {entry.kind === "route-switch" || entry.kind === "route-established" ? (
          <SwitchDetails entry={entry} />
        ) : entry.details.length ? (
          <div className="mt-0.5 flex flex-col gap-0.5">
            {entry.details.map((line, index) => (
              <p key={index} className="text-caption leading-snug text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function ProviderChip({ marketId, providerId }: { marketId: MarketId; providerId: ProviderId }) {
  const provider = getProviderFixture(marketId, providerId);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <ProviderLogo src={provider?.logo} name={provider?.name ?? providerId} size={16} />
      <span className="truncate font-medium text-foreground">{provider?.name ?? providerId}</span>
    </span>
  );
}

function SwitchTitle({ entry, marketId }: { entry: RouteSwitchEntry; marketId: MarketId }) {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="sr-only">{entry.title}</span>
      <span aria-hidden="true" className="inline-flex min-w-0 flex-wrap items-center gap-2">
        {entry.fromProviderId ? (
          <>
            <ProviderChip marketId={marketId} providerId={entry.fromProviderId} />
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
          </>
        ) : (
          <span className="text-muted-foreground">Routing to</span>
        )}
        <ProviderChip marketId={marketId} providerId={entry.toProviderId} />
      </span>
      <Badge tone={entry.tone === "negative" ? "negative" : TRIGGER_TONE[entry.trigger]}>
        {TRIGGER_LABELS[entry.trigger]}
      </Badge>
    </p>
  );
}

function SwitchDetails({ entry }: { entry: RouteSwitchEntry | RouteEstablishedEntry }) {
  const parts = parseRouteSwitchDetails(entry.details);
  return (
    <div className="mt-1 flex flex-col gap-1">
      {parts.trigger ? (
        <p className="text-caption leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">Trigger:</span> {parts.trigger}
        </p>
      ) : null}
      {parts.checks.length ? (
        <div className="flex flex-col gap-1">
          <p className="text-caption leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">Why {parts.qualifiedName} qualifies:</span>
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {parts.checks.map((check) => (
              <li
                key={check}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 text-caption leading-none text-foreground"
              >
                <Check aria-hidden="true" className="size-3 text-positive" strokeWidth={2.5} />
                {check}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {parts.failure ? <p className="text-caption leading-snug text-negative-text">{parts.failure}</p> : null}
      {parts.notes.map((line, index) => (
        <p key={index} className="text-caption leading-snug text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

function RelativeTime({ at, timeZone }: { at: number; timeZone: MarketTimeZone }) {
  const now = useNow();
  const absolute = format.dateTime(at, timeZone, { seconds: true });
  const relative = format.relativeTime(at, now);
  return (
    <Tooltip content={absolute} side="left">
      <time
        dateTime={format.isoTimestamp(at)}
        aria-label={`${relative}, ${absolute}`}
        className="shrink-0 cursor-default pt-px text-caption whitespace-nowrap text-muted-foreground tabular-nums"
      >
        {relative}
      </time>
    </Tooltip>
  );
}
