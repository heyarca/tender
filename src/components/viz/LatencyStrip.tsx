"use client";

import { useState, type PointerEvent } from "react";
import { timeZoneLabel as zoneAt } from "@/lib/tender/time-zone";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./ChartTooltip";
import { providerColor } from "./colors";
import { formatClock, formatLatency } from "./format";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { latencyScaleMax } from "./scale";
import type { TimelineRequest, VizProviders } from "./types";

export interface LatencyStripProps {
  /** Recent requests, oldest first. The newest are drawn on the right; older ones fade out on the left. */
  requests: readonly TimelineRequest[];
  /** Provider identities for colors, tooltips, and the legend. */
  providers?: VizProviders;
  /** Provider ids in fixture order, for stable colors. Default: the keys of `providers`. */
  providerIds?: readonly string[];
  /** Policy latency limit (ms), drawn as a dashed line. */
  limitMs?: number | null;
  /** Label at the limit line. Default `400 ms`; `false` hides it. */
  limitLabel?: string | false;
  /** Fixed top of the latency scale in ms. Default fits the requests and the limit. */
  domainMaxMs?: number;
  /** Strip height in px. Default 48. */
  height?: number;
  /** Most requests to draw. Default 50. */
  maxRequests?: number;
  /** Bar width in px. Default 6. */
  barWidth?: number;
  /** Time zone for tooltip times. Default `UTC`. */
  timeZone?: string;
  /** Tooltip time suffix (`UTC`, `PT`). Default: `timeZone`. */
  timeZoneLabel?: string;
  /** Milliseconds in tooltip times. Default true. */
  showMilliseconds?: boolean;
  /** Provider legend under the strip. Default false. */
  showLegend?: boolean;
  ariaLabel?: string;
  className?: string;
}

const GAP = 2;
const LIMIT_LABEL_HEIGHT = 12;

/** Top of the limit label: just above the dashed line, or just below it when the line is near the top. */
function limitLabelTop(height: number, limitBottom: number) {
  const lineTop = height - limitBottom;
  const above = lineTop - LIMIT_LABEL_HEIGHT - 1;
  return above >= 0 ? above : lineTop + 2;
}

/**
 * Recent requests as thin bars: height is latency, color is the serving provider, failed and
 * rejected requests are red. A dashed rule marks where the serving provider changed, so it is clear
 * at a glance that the next request used the new provider.
 */
export function LatencyStrip({
  requests,
  providers,
  providerIds,
  limitMs = null,
  limitLabel,
  domainMaxMs,
  height = 48,
  maxRequests = 50,
  barWidth = 6,
  timeZone = "UTC",
  timeZoneLabel,
  showMilliseconds = true,
  showLegend = false,
  ariaLabel,
  className,
}: LatencyStripProps) {
  const [hover, setHover] = useState<{ id: string; left: number; align: TooltipAlign } | null>(null);
  const visible = requests.slice(-maxRequests);
  const ids = providerIds ?? (providers ? Object.keys(providers) : []);
  const max = domainMaxMs ?? latencyScaleMax(visible, limitMs);
  const plotHeight = height - 2;
  const hasLimit = limitMs !== null && Number.isFinite(limitMs) && limitMs <= max;
  const limitBottom = hasLimit ? (limitMs / max) * plotHeight : 0;

  const colorOf = (id: string | null) =>
    id ? (providers?.[id]?.color ?? providerColor(id, ids)) : "var(--text-faint)";

  const hovered = hover ? visible.find((r) => r.id === hover.id) : undefined;

  function enter(event: PointerEvent<HTMLDivElement>, id: string) {
    const wrapper = event.currentTarget.closest("[data-latency-strip]");
    if (!wrapper) return;
    const column = event.currentTarget.getBoundingClientRect();
    const box = wrapper.getBoundingClientRect();
    const center = column.left - box.left + column.width / 2;
    const align: TooltipAlign = center < 110 ? "start" : center > box.width - 110 ? "end" : "center";
    setHover({ id, left: align === "start" ? 0 : align === "end" ? box.width : center, align });
  }

  const served = visible.filter((r) => r.status === "ok");
  const failures = visible.length - served.length;
  const last = visible[visible.length - 1];
  const summary =
    ariaLabel ??
    (visible.length === 0
      ? "No requests yet"
      : `Last ${visible.length} requests: ${served.length} served, ${failures} failed or rejected. Latest ${
          last.status === "rejected"
            ? "rejected"
            : `${providers?.[last.providerId ?? ""]?.name ?? last.providerId ?? "unknown"} ${
                last.latencyMs !== null ? formatLatency(last.latencyMs) : ""
              }`.trim()
        }.`);

  const legend: string[] = [];
  for (const r of visible) if (r.providerId && !legend.includes(r.providerId)) legend.push(r.providerId);

  // A dashed rule goes before the first request of each new serving provider.
  const switchedAt = new Set<string>();
  let previousProvider: string | null = null;
  for (const r of visible) {
    if (r.status === "rejected" || !r.providerId) continue;
    if (previousProvider !== null && r.providerId !== previousProvider) switchedAt.add(r.id);
    previousProvider = r.providerId;
  }

  return (
    <div className={cn("relative", className)} data-latency-strip="">
      <div
        role="img"
        aria-label={summary}
        className="relative flex items-end justify-end overflow-hidden mask-l-from-90%"
        style={{ height, gap: GAP }}
        onPointerLeave={() => setHover(null)}
      >
        {hasLimit && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{ bottom: limitBottom, borderColor: "var(--text-faint)" }}
            data-slot="latency-limit"
          />
        )}
        {visible.map((r) => {
          const switched = switchedAt.has(r.id);
          const latency = r.latencyMs !== null && Number.isFinite(r.latencyMs) ? r.latencyMs : null;
          const barHeight =
            r.status === "rejected"
              ? 4
              : latency === null
                ? plotHeight * 0.4
                : Math.max(2, Math.min(plotHeight, (latency / max) * plotHeight));
          const color = r.status === "ok" ? colorOf(r.providerId) : "var(--negative)";
          const dimmed = hover !== null && hover.id !== r.id;
          return (
            <div key={r.id} className="contents">
              {switched && (
                <div
                  aria-hidden="true"
                  className="h-full w-0 shrink-0 border-l border-dashed"
                  style={{ borderColor: "var(--text-faint)" }}
                  data-slot="provider-change"
                />
              )}
              <div
                aria-hidden="true"
                className="flex h-full shrink-0 items-end"
                style={{ width: barWidth }}
                onPointerEnter={(event) => enter(event, r.id)}
                data-status={r.status}
              >
                <div
                  className={cn(
                    "w-full origin-bottom rounded-t-[1px] transition-[height,opacity,scale] duration-fast ease-smooth-out starting:scale-y-0 motion-reduce:transition-none",
                    r.status === "rejected" && "border border-b-0",
                    dimmed && "opacity-40",
                  )}
                  style={
                    r.status === "rejected"
                      ? { height: barHeight, borderColor: "var(--negative)" }
                      : { height: barHeight, background: color }
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {hasLimit && limitLabel !== false && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 rounded-sm bg-card/90 pr-1 text-[10px] leading-3 text-faint tabular-nums"
          style={{ top: limitLabelTop(height, limitBottom) }}
        >
          {limitLabel ?? formatLatency(limitMs)}
        </span>
      )}

      {hovered && hover && (
        <LatencyTooltip
          request={hovered}
          left={hover.left}
          align={hover.align}
          top={height + 6}
          provider={hovered.providerId ? providers?.[hovered.providerId] : undefined}
          color={hovered.providerId ? colorOf(hovered.providerId) : undefined}
          timeZone={timeZone}
          zoneLabel={timeZoneLabel ?? zoneAt(timeZone, hovered.t)}
          showMilliseconds={showMilliseconds}
        />
      )}

      {showLegend && legend.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          {legend.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: colorOf(id) }} />
              {providers?.[id]?.name ?? id}
            </span>
          ))}
          {failures > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-negative" />
              Failed or rejected
            </span>
          )}
        </div>
      )}
    </div>
  );
}

type TooltipAlign = "start" | "center" | "end";

const ALIGN_CLASS: Record<TooltipAlign, string> = {
  start: "",
  center: "-translate-x-1/2",
  end: "-translate-x-full",
};

function LatencyTooltip({
  request,
  left,
  align,
  top,
  provider,
  color,
  timeZone,
  zoneLabel,
  showMilliseconds,
}: {
  request: TimelineRequest;
  left: number;
  align: TooltipAlign;
  top: number;
  provider?: { name: string; logo?: string };
  /** Chart color of the serving provider, for the letter fallback tile. */
  color?: string;
  timeZone: string;
  zoneLabel: string;
  showMilliseconds: boolean;
}) {
  return (
    <ChartTooltip left={left} top={top} className={cn("w-max max-w-64", ALIGN_CLASS[align])}>
      <div className="flex items-center justify-between gap-3 text-muted-foreground tabular-nums">
        <span className="font-mono text-[11px]">{request.id}</span>
        <span>
          {formatClock(request.t, timeZone, { milliseconds: showMilliseconds })} {zoneLabel}
        </span>
      </div>
      {request.status === "rejected" ? (
        <div className="mt-1 text-warning-text">No eligible provider — request not sent</div>
      ) : (
        <div className="mt-1 flex items-center gap-1.5 text-foreground">
          <ProviderLogo
            src={provider?.logo}
            name={provider?.name ?? request.providerId ?? ""}
            size={14}
            fallbackColor={color}
          />
          <span className="truncate">{provider?.name ?? request.providerId}</span>
          <span
            className={cn(
              "ml-auto pl-3 tabular-nums",
              request.status === "failed" ? "text-negative-text" : "text-foreground",
            )}
          >
            {request.status === "failed" ? "Failed" : ""}
            {request.status === "failed" && request.latencyMs !== null ? " · " : ""}
            {request.latencyMs !== null ? formatLatency(request.latencyMs) : ""}
          </span>
        </div>
      )}
    </ChartTooltip>
  );
}
