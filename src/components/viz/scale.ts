/**
 * Pure geometry helpers shared by the viz components (no React, no DOM).
 * Everything here is deterministic so server and client renders match.
 */

import type { TimelineRequest } from "./types";

export type Point = { x: number; y: number };
export type Range = readonly [number, number];

/** Linear map from a domain onto a range. A zero-width domain maps to the middle of the range. */
export function scaleLinear(domain: Range, range: Range): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0 || !Number.isFinite(span)) {
    const mid = (r0 + r1) / 2;
    return () => mid;
  }
  const k = (r1 - r0) / span;
  return (value: number) => r0 + (value - d0) * k;
}

/** Min and max of the finite values, or null when there are none. */
export function extent(values: readonly number[]): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo === Infinity ? null : [lo, hi];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function decimalsFor(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  let decimals = 0;
  while (decimals < 10 && Math.abs(Math.round(step * 10 ** decimals) - step * 10 ** decimals) > 1e-9) {
    decimals += 1;
  }
  return decimals;
}

export interface NiceAxis {
  /** Tick values, evenly spaced, covering the data. */
  ticks: number[];
  /** Distance between ticks. */
  step: number;
  /** `[first tick, last tick]` — use it as the chart domain so the line never leaves the plot. */
  domain: [number, number];
}

/**
 * Picks the smallest "nice" step (1, 2, 2.5, 5 × 10ⁿ) whose ticks cover `[min, max]`
 * with at most `maxTicks` ticks. Returns ticks rounded to the step's precision.
 */
export function niceAxis(min: number, max: number, maxTicks = 4): NiceAxis {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : lo + 1;
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi - lo < 1e-12) {
    const pad = Math.abs(lo) * 0.001 || 1;
    lo -= pad;
    hi += pad;
  }
  const limit = Math.max(2, Math.floor(maxTicks));
  const mantissas = [1, 2, 2.5, 5];
  let exponent = Math.floor(Math.log10((hi - lo) / limit)) - 1;
  for (let guard = 0; guard < 40; guard += 1, exponent += 1) {
    for (const m of mantissas) {
      const step = m * 10 ** exponent;
      const first = Math.floor(lo / step + 1e-9) * step;
      const last = Math.ceil(hi / step - 1e-9) * step;
      const count = Math.round((last - first) / step) + 1;
      if (count <= limit) {
        const decimals = decimalsFor(step);
        const ticks = Array.from({ length: count }, (_, i) => Number((first + i * step).toFixed(decimals)));
        return { ticks, step, domain: [ticks[0], ticks[ticks.length - 1]] };
      }
    }
  }
  return { ticks: [lo, hi], step: hi - lo, domain: [lo, hi] };
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** Candidate time-axis steps, from one second to one day. */
export const TIME_STEPS_MS: readonly number[] = [
  SECOND,
  2 * SECOND,
  5 * SECOND,
  10 * SECOND,
  15 * SECOND,
  30 * SECOND,
  MINUTE,
  2 * MINUTE,
  5 * MINUTE,
  10 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  24 * HOUR,
];

/**
 * Round timestamps (multiples of a step from `TIME_STEPS_MS`) inside `[t0, t1]`,
 * using the smallest step that yields at most `maxTicks` ticks.
 */
export function timeTicks(t0: number, t1: number, maxTicks = 4): number[] {
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0 || maxTicks < 1) return [];
  for (const step of TIME_STEPS_MS) {
    const first = Math.ceil(t0 / step) * step;
    const count = first > t1 ? 0 : Math.floor((t1 - first) / step) + 1;
    if (count <= maxTicks) {
      return Array.from({ length: count }, (_, i) => first + i * step);
    }
  }
  return [];
}

export type LimitPlacement = "inside" | "above" | "below";

export interface ResolvedDomain {
  domain: [number, number];
  /** Where the limit falls relative to the resolved domain, or null when there is no limit. */
  limit: LimitPlacement | null;
}

export interface ResolveDomainOptions {
  /** Fixed domain. When set, it is used as is and an out-of-range limit is reported, not included. */
  domain?: Range;
  /** Policy limit to show as a dashed line. */
  limit?: number | null;
  /** Always include zero (useful for latency or price bars). */
  includeZero?: boolean;
  /** Padding added on each side, as a fraction of the data span. Default 0.12. */
  padding?: number;
  /**
   * Smallest data span, as a fraction of the data's magnitude. Keeps small noise around a steady
   * value calm instead of filling the whole height. Default 0.25 (a 210 ms series spans ≥ 52 ms).
   */
  minSpanRatio?: number;
  /**
   * How far the domain may stretch to include an out-of-range limit, as a multiple of the padded
   * data span. Beyond this the data would flatten into a line, so the limit is reported as
   * `above`/`below` instead. Default 2.5.
   */
  maxStretch?: number;
}

/**
 * Resolves the vertical domain of a small chart. The data always stays readable: the domain
 * stretches to show a nearby limit line, and a far-away limit is reported as above/below so the
 * caller can draw an edge marker instead.
 */
export function resolveDomain(values: readonly number[], options: ResolveDomainOptions = {}): ResolvedDomain {
  const { limit = null, includeZero = false, padding = 0.12, minSpanRatio = 0.25, maxStretch = 2.5 } = options;
  const hasLimit = limit !== null && Number.isFinite(limit);

  if (options.domain) {
    const [lo, hi] = options.domain[0] <= options.domain[1] ? options.domain : [options.domain[1], options.domain[0]];
    return {
      domain: [lo, hi],
      limit: !hasLimit ? null : limit < lo ? "below" : limit > hi ? "above" : "inside",
    };
  }

  const ext = extent(values);
  let lo: number;
  let hi: number;
  if (!ext) {
    lo = hasLimit ? Math.min(0, limit) : 0;
    hi = hasLimit ? Math.max(limit * 1.25, 1) : 1;
  } else {
    [lo, hi] = ext;
    const pad = (hi - lo) * padding;
    lo -= pad;
    hi += pad;
    const magnitude = Math.max(Math.abs(ext[0]), Math.abs(ext[1]));
    const minSpan = magnitude * minSpanRatio || 1;
    if (hi - lo < minSpan) {
      const mid = (ext[0] + ext[1]) / 2;
      lo = mid - minSpan / 2;
      hi = mid + minSpan / 2;
    }
  }
  if (includeZero) {
    if (lo > 0 && ext && ext[0] >= 0) lo = 0;
    if (hi < 0 && ext && ext[1] <= 0) hi = 0;
  }

  if (!hasLimit) return { domain: [lo, hi], limit: null };
  if (limit >= lo && limit <= hi) return { domain: [lo, hi], limit: "inside" };

  const span = hi - lo;
  const edgePad = span * 0.08;
  if (limit > hi) {
    if (limit - lo <= span * maxStretch) return { domain: [lo, limit + edgePad], limit: "inside" };
    return { domain: [lo, hi], limit: "above" };
  }
  if (hi - limit <= span * maxStretch) return { domain: [limit - edgePad, hi], limit: "inside" };
  return { domain: [lo, hi], limit: "below" };
}

/** Straight segments through the points (`M … L …`). */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${round2(p.x)},${round2(p.y)}`).join("");
}

function sign(n: number) {
  return n < 0 ? -1 : 1;
}

/**
 * Smooth monotone cubic curve through points sorted by x (Fritsch–Carlson, the same curve as
 * d3's `curveMonotoneX`). It never overshoots the data, so peaks and limit crossings stay honest.
 */
export function monotonePath(points: readonly Point[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n < 3) return linePath(points);

  const tangents = new Array<number>(n).fill(0);
  const secant = (i: number) => {
    const h = points[i + 1].x - points[i].x;
    return h === 0 ? 0 : (points[i + 1].y - points[i].y) / h;
  };
  for (let i = 1; i < n - 1; i += 1) {
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const s0 = secant(i - 1);
    const s1 = secant(i);
    const p = h0 + h1 === 0 ? 0 : (s0 * h1 + s1 * h0) / (h0 + h1);
    tangents[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  const h0 = points[1].x - points[0].x;
  tangents[0] = h0 ? (3 * secant(0) - tangents[1]) / 2 : tangents[1];
  const hn = points[n - 1].x - points[n - 2].x;
  tangents[n - 1] = hn ? (3 * secant(n - 2) - tangents[n - 2]) / 2 : tangents[n - 2];

  let d = `M${round2(points[0].x)},${round2(points[0].y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = (b.x - a.x) / 3;
    d +=
      `C${round2(a.x + dx)},${round2(a.y + dx * tangents[i])}` +
      `,${round2(b.x - dx)},${round2(b.y - dx * tangents[i + 1])}` +
      `,${round2(b.x)},${round2(b.y)}`;
  }
  return d;
}

/**
 * How many samples were appended when `next` is `prev` slid forward (a rolling window).
 * Returns 0 for identical series and null when the series are unrelated.
 */
export function detectAppendShift(prev: readonly number[], next: readonly number[], maxShift = 6): number | null {
  const m = prev.length;
  const n = next.length;
  if (m === 0 || n === 0) return null;
  for (let k = 0; k <= maxShift; k += 1) {
    const overlap = n - k;
    if (overlap < 2 || overlap > m) continue;
    let same = true;
    for (let i = 0; i < overlap; i += 1) {
      if (!Object.is(next[i], prev[m - overlap + i])) {
        same = false;
        break;
      }
    }
    if (same) return k;
  }
  return null;
}

/** Index of the item whose key is nearest to `target` in an ascending array (binary search). */
export function nearestIndex(sorted: readonly number[], target: number): number {
  if (sorted.length === 0) return -1;
  let lo = 0;
  let hi = sorted.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= target) lo = mid;
    else hi = mid;
  }
  return Math.abs(sorted[lo] - target) <= Math.abs(sorted[hi] - target) ? lo : hi;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Top of the latency-strip scale: fits the slowest request and the limit with a little headroom. */
export function latencyScaleMax(requests: readonly TimelineRequest[], limitMs?: number | null): number {
  let max = 0;
  for (const r of requests) if (r.latencyMs !== null && Number.isFinite(r.latencyMs)) max = Math.max(max, r.latencyMs);
  const limit = limitMs !== null && limitMs !== undefined && Number.isFinite(limitMs) ? limitMs : 0;
  return Math.max(max * 1.08, limit * 1.25, 1);
}
