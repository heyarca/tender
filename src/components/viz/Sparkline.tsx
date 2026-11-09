"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TONE_COLORS } from "./colors";
import { detectAppendShift, monotonePath, resolveDomain, scaleLinear, type Point } from "./scale";
import { useAnimatedDomain, type ChartDomain } from "./use-animated-domain";

export type SparklineTone = "active" | "neutral" | "muted" | "warning" | "negative";

export interface SparklineProps {
  /** Samples, oldest first. Non-finite values leave a gap. */
  values: readonly number[];
  /** Width in px. Default 88. */
  width?: number;
  /** Height in px. Default 24. */
  height?: number;
  /** Line color: active (olive), neutral, muted, warning, or negative. Default neutral. */
  tone?: SparklineTone;
  /** Policy limit drawn as a dashed line. A limit far outside the data shows as a small edge marker. */
  limit?: number | null;
  /** Fixed value domain `[min, max]`. By default the domain fits the data (and a nearby limit). */
  domain?: readonly [number, number];
  /** Keep zero inside the domain. */
  includeZero?: boolean;
  /** Smallest span as a fraction of the values' magnitude, so steady noise looks calm. Default 0.25. */
  minSpanRatio?: number;
  /** Dot on the newest sample. Default true. */
  showLastPoint?: boolean;
  /** Stroke width in px. Default 1.5. */
  strokeWidth?: number;
  /** Accessible description. Without it the sparkline is decorative (`aria-hidden`). */
  ariaLabel?: string;
  className?: string;
}

interface Series {
  values: readonly number[];
  /** Virtual index of `values[0]`, so a rolling window can slide instead of morphing. */
  offset: number;
  /** False when this series replaced unrelated data (no slide, nothing to keep on screen). */
  continuous: boolean;
}

function sameValues(a: readonly number[], b: readonly number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false;
  return true;
}

const DOT_RADIUS = 2;

/**
 * Tiny trend line in the OpenRouter style: 1.5px monotone curve, no axes, optional dashed policy
 * limit and an end dot. New samples slide in from the right.
 */
export function Sparkline({
  values,
  width = 88,
  height = 24,
  tone = "neutral",
  limit = null,
  domain,
  includeZero = false,
  minSpanRatio,
  showLastPoint = true,
  strokeWidth = 1.5,
  ariaLabel,
  className,
}: SparklineProps) {
  const [series, setSeries] = useState<Series>({ values, offset: 0, continuous: false });
  let current = series;
  if (series.values !== values && !sameValues(series.values, values)) {
    const shift = detectAppendShift(series.values, values);
    current = {
      values,
      offset: series.offset + series.values.length - values.length + (shift ?? 0),
      continuous: shift !== null && shift > 0,
    };
    setSeries(current);
  }

  const n = current.values.length;
  const resolved = resolveDomain(current.values, { domain, limit, includeZero, minSpanRatio });
  const target: ChartDomain = {
    x0: n > 1 ? current.offset : current.offset - 1,
    x1: current.offset + Math.max(n - 1, 0),
    y0: resolved.domain[0],
    y1: resolved.domain[1],
  };
  const { domain: shown, previous } = useAnimatedDomain<Series>(target, current, 300);

  const color = TONE_COLORS[tone];
  const inset = showLastPoint ? DOT_RADIUS + 1 : strokeWidth;
  const x = scaleLinear([shown.x0, shown.x1], [strokeWidth / 2, width - inset]);
  const y = scaleLinear([shown.y0, shown.y1], [height - inset, inset]);

  // While sliding, keep drawing the samples that are leaving on the left.
  const indexed: Array<[number, number]> = [];
  if (previous && current.continuous) {
    previous.values.forEach((v, i) => {
      const index = previous.offset + i;
      if (index < current.offset) indexed.push([index, v]);
    });
  }
  current.values.forEach((v, i) => indexed.push([current.offset + i, v]));

  const segments: Point[][] = [];
  let run: Point[] = [];
  for (const [index, v] of indexed) {
    if (Number.isFinite(v)) run.push({ x: x(index), y: y(v) });
    else if (run.length) {
      segments.push(run);
      run = [];
    }
  }
  if (run.length) segments.push(run);

  const lastValue = n ? current.values[n - 1] : NaN;
  const lastPoint = Number.isFinite(lastValue) ? { x: x(current.offset + n - 1), y: y(lastValue) } : null;
  const limitY = resolved.limit === "inside" && limit !== null ? y(limit) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block shrink-0 overflow-hidden", className)}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      data-tone={tone}
    >
      {limitY !== null && (
        <line
          x1={0}
          x2={width}
          y1={limitY}
          y2={limitY}
          strokeWidth={1}
          strokeDasharray="2 2"
          style={{ stroke: "var(--text-faint)" }}
          data-slot="sparkline-limit"
        />
      )}
      {resolved.limit === "above" && <LimitEdgeMarker edge="top" height={height} />}
      {resolved.limit === "below" && <LimitEdgeMarker edge="bottom" height={height} />}
      {segments.map((points, i) =>
        points.length === 1 ? (
          <circle key={i} cx={points[0].x} cy={points[0].y} r={strokeWidth / 2} style={{ fill: color }} />
        ) : (
          <path
            key={i}
            d={monotonePath(points)}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-[stroke] duration-quick"
            style={{ stroke: color }}
          />
        ),
      )}
      {showLastPoint && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={DOT_RADIUS}
          className="transition-[fill] duration-quick"
          style={{ fill: color }}
        />
      )}
    </svg>
  );
}

/** A tiny caret at the left edge: the limit exists but lies beyond the visible range. */
function LimitEdgeMarker({ edge, height }: { edge: "top" | "bottom"; height: number }) {
  const d = edge === "top" ? "M0.5,4.5 L3,1 L5.5,4.5 Z" : `M0.5,${height - 4.5} L3,${height - 1} L5.5,${height - 4.5} Z`;
  return <path d={d} data-slot="sparkline-limit-edge" style={{ fill: "var(--text-faint)" }} />;
}
