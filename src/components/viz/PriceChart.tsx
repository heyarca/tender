"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./ChartTooltip";
import { providerColor } from "./colors";
import { formatClock, formatUsd } from "./format";
import { ProviderGlyph } from "./ProviderGlyph";
import { clamp, extent, monotonePath, nearestIndex, niceAxis, scaleLinear, timeTicks } from "./scale";
import type { PricePoint, VizProviders } from "./types";
import { useAnimatedDomain, type ChartDomain } from "./use-animated-domain";
import { useElementWidth } from "./use-element-width";

export interface PriceChartProps {
  /** Requests in time order (unsorted input is sorted). Seed ~40 points so the chart is never empty. */
  points: readonly PricePoint[];
  /** IANA time zone for axis and tooltip times. Default `UTC`. */
  timeZone?: string;
  /** Suffix for tooltip times, e.g. `UTC` or `PT`. Default: `timeZone`. */
  timeZoneLabel?: string;
  /** Chart height in px. Default 160. */
  height?: number;
  /** Price format for the tooltip. Default `$75,230.75`. */
  formatPrice?: (price: number) => string;
  /** Y-axis tick format. Default whole dollars (`$75,220`), or cents when ticks are closer than $1. */
  formatTick?: (price: number) => string;
  /** Provider identities for tooltips and switch markers. */
  providers?: VizProviders;
  /** Mark where the serving provider changed. Default true. */
  showProviderChanges?: boolean;
  /** Text when there are no successful points yet. */
  emptyLabel?: string;
  ariaLabel?: string;
  className?: string;
}

/** Width used on the server and before the first measurement. */
const DEFAULT_WIDTH = 640;
const MARGIN = { top: 24, right: 14, bottom: 22 };
const TICK_FONT_PX = 11;
/** Approximate advance of an 11px tabular digit in PP Mori. */
const CHAR_PX = 6.6;
const MIN_X_TICK_SPACING = 96;
const MARKER_LABEL_MIN_GAP = 20;

function isOk(point: PricePoint) {
  return point.status !== "failed" && Number.isFinite(point.price);
}

function isSorted(points: readonly PricePoint[]) {
  for (let i = 1; i < points.length; i += 1) if (points[i].t < points[i - 1].t) return false;
  return true;
}

/**
 * BTC/USD line chart: nice y ticks, clock-time x ticks in the market time zone, hover crosshair
 * with tooltip, a pulsing dot on the newest price, and dashed markers where the serving provider
 * changed. Width follows the container (ResizeObserver); the server renders at a default width.
 */
export function PriceChart({
  points: input,
  timeZone = "UTC",
  timeZoneLabel,
  height = 160,
  formatPrice = formatUsd,
  formatTick,
  providers,
  showProviderChanges = true,
  emptyLabel = "No prices yet",
  ariaLabel,
  className,
}: PriceChartProps) {
  const clipId = `price-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [containerRef, width] = useElementWidth<HTMLDivElement>(DEFAULT_WIDTH);
  // Hover is keyed by the hovered point's timestamp, not its index: `points` is a rolling window
  // and every append shifts the indices, which would silently move the crosshair to another point.
  const [hoverT, setHoverT] = useState<number | null>(null);

  const points = isSorted(input) ? input : [...input].sort((a, b) => a.t - b.t);
  const pointTimes = points.map((p) => p.t);
  const okPoints = points.filter(isOk);
  const providerIds = providers ? Object.keys(providers) : [];

  const priceExtent = extent(okPoints.map((p) => p.price));
  const axis = niceAxis(priceExtent?.[0] ?? 0, priceExtent?.[1] ?? 1, 4);
  const tickFormat = formatTick ?? ((v: number) => formatUsd(v, axis.step >= 1 ? 0 : 2));
  const tickLabels = axis.ticks.map(tickFormat);
  const gutter = Math.ceil(Math.max(...tickLabels.map((l) => l.length)) * CHAR_PX) + 12;

  const plot = {
    left: gutter,
    right: Math.max(gutter + 40, width - MARGIN.right),
    top: MARGIN.top,
    bottom: height - MARGIN.bottom,
  };

  const tFirst = points.length ? points[0].t : 0;
  const tLast = points.length ? points[points.length - 1].t : 1;
  const target: ChartDomain = {
    x0: tLast > tFirst ? tFirst : tLast - 1_000,
    x1: tLast,
    y0: axis.domain[0],
    y1: axis.domain[1],
  };
  const { domain: shown, previous } = useAnimatedDomain(target, points, 450);
  const x = scaleLinear([shown.x0, shown.x1], [plot.left, plot.right]);
  const y = scaleLinear([shown.y0, shown.y1], [plot.bottom, plot.top]);

  // Keep the points that are sliding out on the left until the transition ends.
  const leaving = previous && points.length ? previous.filter((p) => p.t < points[0].t) : [];
  const drawn = leaving.length ? [...leaving, ...points] : points;
  const linePoints = drawn.filter(isOk).map((p) => ({ x: x(p.t), y: y(p.price) }));
  const path = monotonePath(linePoints);

  const xTickCount = clamp(Math.floor((plot.right - plot.left) / MIN_X_TICK_SPACING), 2, 6);
  const xTicks = timeTicks(shown.x0, shown.x1, xTickCount);

  // Provider switches: a dashed rule halfway between the last request of one provider and the first of the next.
  const markers: { key: string; x: number; providerId: string }[] = [];
  if (showProviderChanges) {
    for (let i = 1; i < drawn.length; i += 1) {
      const a = drawn[i - 1];
      const b = drawn[i];
      if (a.providerId && b.providerId && a.providerId !== b.providerId) {
        const mx = x((a.t + b.t) / 2);
        if (mx >= plot.left && mx <= plot.right) markers.push({ key: `${b.t}-${b.providerId}`, x: mx, providerId: b.providerId });
      }
    }
  }
  const labelled = new Set<string>();
  let lastLabelX = Infinity;
  for (let i = markers.length - 1; i >= 0; i -= 1) {
    if (lastLabelX - markers[i].x >= MARKER_LABEL_MIN_GAP) {
      labelled.add(markers[i].key);
      lastLabelX = markers[i].x;
    }
  }

  const latest = okPoints.length ? okPoints[okPoints.length - 1] : null;
  const latestPos = latest ? { x: x(latest.t), y: y(latest.price) } : null;
  // Resolve the hovered point by timestamp so hover survives window slides; when the point itself
  // slides out of the window, the crosshair and tooltip hide.
  const hoverIndex = hoverT === null ? -1 : nearestIndex(pointTimes, hoverT);
  const hovered = hoverIndex >= 0 && points[hoverIndex].t === hoverT ? points[hoverIndex] : null;

  const providerOf = (id: string | undefined) => (id && providers ? providers[id] : undefined);
  const zoneLabel = timeZoneLabel ?? timeZone;

  function locate(clientX: number, rect: DOMRect) {
    if (!points.length) return;
    const px = clientX - rect.left;
    const t = shown.x0 + ((px - plot.left) / (plot.right - plot.left)) * (shown.x1 - shown.x0);
    setHoverT(pointTimes[nearestIndex(pointTimes, t)]);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    locate(event.clientX, event.currentTarget.getBoundingClientRect());
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!points.length) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      setHoverT((t) => {
        const index = t === null ? points.length - 1 : clamp(nearestIndex(pointTimes, t) + step, 0, points.length - 1);
        return pointTimes[index];
      });
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setHoverT(event.key === "Home" ? pointTimes[0] : pointTimes[points.length - 1]);
    } else if (event.key === "Escape") {
      setHoverT(null);
    }
  }

  const label =
    ariaLabel ??
    (latest
      ? `Price chart, ${okPoints.length} prices, latest ${formatPrice(latest.price)}`
      : "Price chart, no prices yet");

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full touch-pan-y overflow-hidden rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={`${label}. Use the arrow keys to read prices.`}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHoverT(null)}
      onKeyDown={onKeyDown}
      onBlur={() => setHoverT(null)}
    >
      <svg width={width} height={height} className="absolute top-0 left-0 block" role="img" aria-label={label}>
        <defs>
          <clipPath id={clipId}>
            <rect x={plot.left} y={0} width={plot.right - plot.left + 10} height={height} />
          </clipPath>
        </defs>

        {/* Faint horizontal guides + y labels */}
        <g style={{ fontSize: TICK_FONT_PX }}>
          {axis.ticks.map((tick, i) => {
            const ty = y(tick);
            if (ty < plot.top - 1 || ty > plot.bottom + 1) return null;
            return (
              <g key={tick}>
                <line x1={plot.left} x2={plot.right} y1={ty} y2={ty} strokeWidth={1} style={{ stroke: "var(--border)" }} />
                <text
                  x={plot.left - 8}
                  y={ty}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="tabular-nums"
                  style={{ fill: "var(--muted-foreground)" }}
                >
                  {tickLabels[i]}
                </text>
              </g>
            );
          })}
        </g>

        {/* X labels */}
        <g style={{ fontSize: TICK_FONT_PX }}>
          {xTicks.map((tick) => {
            const tx = x(tick);
            const text = formatClock(tick, timeZone);
            const half = (text.length * CHAR_PX) / 2;
            const anchor = tx - half < plot.left - 4 ? "start" : tx + half > width - 2 ? "end" : "middle";
            return (
              <text
                key={tick}
                x={anchor === "start" ? Math.max(tx, plot.left - 4) : anchor === "end" ? Math.min(tx, width - 2) : tx}
                y={height - 6}
                textAnchor={anchor}
                className="tabular-nums"
                style={{ fill: "var(--muted-foreground)" }}
              >
                {text}
              </text>
            );
          })}
        </g>

        {/* Provider switch markers */}
        {markers.map((m) => (
          <line
            key={m.key}
            x1={m.x}
            x2={m.x}
            y1={plot.top - 4}
            y2={plot.bottom}
            strokeWidth={1}
            strokeDasharray="3 3"
            style={{ stroke: "var(--text-faint)" }}
            data-slot="provider-change"
          />
        ))}

        {/* Failed requests: short red ticks on the baseline */}
        {drawn
          .filter((p) => !isOk(p))
          .map((p) => {
            const fx = x(p.t);
            if (fx < plot.left || fx > plot.right + 1) return null;
            return (
              <line
                key={`failed-${p.t}`}
                x1={fx}
                x2={fx}
                y1={plot.bottom - 4}
                y2={plot.bottom + 3}
                strokeWidth={1.5}
                strokeLinecap="round"
                style={{ stroke: "var(--negative)" }}
                data-slot="failed-request"
              />
            );
          })}

        {/* Price line */}
        <g clipPath={`url(#${clipId})`}>
          <path
            d={path}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: "var(--primary-strong)" }}
          />
          {latestPos && (
            <>
              <circle
                key={latest?.t}
                cx={latestPos.x}
                cy={latestPos.y}
                r={3}
                className="animate-ping motion-reduce:hidden"
                style={{
                  fill: "var(--primary-strong)",
                  opacity: 0.35,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animationDuration: "2s",
                }}
              />
              <circle
                cx={latestPos.x}
                cy={latestPos.y}
                r={3}
                strokeWidth={1.5}
                style={{ fill: "var(--primary-strong)", stroke: "var(--card)" }}
              />
            </>
          )}
        </g>

        {/* Hover crosshair */}
        {hovered && (
          <g pointerEvents="none">
            <line
              x1={x(hovered.t)}
              x2={x(hovered.t)}
              y1={plot.top}
              y2={plot.bottom}
              strokeWidth={1}
              style={{ stroke: "var(--text-faint)" }}
            />
            {isOk(hovered) && (
              <circle
                cx={x(hovered.t)}
                cy={y(hovered.price)}
                r={3.5}
                strokeWidth={1.5}
                style={{ fill: "var(--card)", stroke: "var(--primary-strong)" }}
              />
            )}
          </g>
        )}

        {!okPoints.length && (
          <text
            x={(plot.left + plot.right) / 2}
            y={(plot.top + plot.bottom) / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          >
            {emptyLabel}
          </text>
        )}
      </svg>

      {/* Provider logos above switch markers (HTML so logos stay crisp) */}
      {markers
        .filter((m) => labelled.has(m.key))
        .map((m) => {
          const provider = providerOf(m.providerId);
          return (
            <span
              key={m.key}
              className="pointer-events-none absolute top-1 flex -translate-x-1/2 items-center"
              style={{ left: m.x }}
              title={provider ? `Switched to ${provider.name}` : undefined}
            >
              {provider?.logo ? (
                <ProviderGlyph name={provider.name} logo={provider.logo} size={14} />
              ) : (
                <span className="max-w-20 truncate rounded-sm bg-card px-1 text-[10px] leading-4 text-muted-foreground">
                  {provider?.name ?? m.providerId}
                </span>
              )}
            </span>
          );
        })}

      {hovered && (
        <PriceTooltip
          point={hovered}
          x={x(hovered.t)}
          y={isOk(hovered) ? y(hovered.price) : plot.bottom}
          width={width}
          height={height}
          timeZone={timeZone}
          zoneLabel={zoneLabel}
          formatPrice={formatPrice}
          provider={providerOf(hovered.providerId)}
          fallbackColor={hovered.providerId ? providerColor(hovered.providerId, providerIds) : undefined}
        />
      )}
    </div>
  );
}

/** Estimated tooltip size, used to flip it to the left of the cursor near the right edge. */
const TOOLTIP_WIDTH = 200;
const TOOLTIP_HEIGHT = 74;

function PriceTooltip({
  point,
  x,
  y,
  width,
  height,
  timeZone,
  zoneLabel,
  formatPrice,
  provider,
  fallbackColor,
}: {
  point: PricePoint;
  x: number;
  y: number;
  width: number;
  height: number;
  timeZone: string;
  zoneLabel: string;
  formatPrice: (price: number) => string;
  provider?: { name: string; logo?: string; color?: string };
  fallbackColor?: string;
}) {
  const left = x + 12 + TOOLTIP_WIDTH > width ? x - 12 - TOOLTIP_WIDTH : x + 12;
  const top = clamp(y - TOOLTIP_HEIGHT / 2, 0, Math.max(0, height - TOOLTIP_HEIGHT));
  const failed = !isOk(point);
  return (
    <ChartTooltip left={Math.max(0, left)} top={top} className="w-max max-w-60">
      <div className="text-muted-foreground tabular-nums">
        {formatClock(point.t, timeZone, { milliseconds: true })} {zoneLabel}
      </div>
      <div
        className={cn(
          "mt-0.5 text-body leading-5 font-medium tabular-nums",
          failed ? "text-negative-text" : "text-foreground",
        )}
      >
        {failed ? "Request failed" : formatPrice(point.price)}
      </div>
      {(provider || point.providerId) && (
        <div className="mt-1 flex items-center gap-1.5 text-foreground">
          <ProviderGlyph
            name={provider?.name ?? point.providerId ?? ""}
            logo={provider?.logo}
            color={provider?.color ?? fallbackColor}
            size={14}
          />
          <span className="truncate">{provider?.name ?? point.providerId}</span>
          {point.id && <span className="ml-auto font-mono text-[11px] text-muted-foreground">{point.id}</span>}
        </div>
      )}
    </ChartTooltip>
  );
}
