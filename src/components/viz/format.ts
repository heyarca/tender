/**
 * Display formatters for viz and result components. Duration, number, USD, percent, and compass
 * formatting is delegated to the shared engine formatters (`@/lib/tender/format`) so the output
 * never drifts; only the viz-specific clock formatters live here (arbitrary IANA zones plus
 * fractional seconds, which `format.time`'s PT/UTC branches do not cover). Every formatter that
 * touches time takes an explicit `timeZone`, so server and client output agree.
 */
import * as format from "@/lib/tender/format";

const MINUS = "\u2212";

/**
 * `$75,230.75`, or any fixed number of fraction digits (axis ticks use whole dollars or cents).
 * Delegates to `format.number`; identical to `format.usd` at two decimals, with the U+2212 minus.
 */
export function formatUsd(value: number, decimals = 2): string {
  const abs = format.number(Math.abs(value), decimals);
  return value < 0 ? `${MINUS}$${abs}` : `$${abs}`;
}

/** `1,018` / `9.4` with a fixed number of fraction digits. Shared engine implementation. */
export const formatNumber = format.number;

/** Request latency: `84 ms`, `1.2 s`. Shared engine implementation; non-finite input renders as `–`. */
export function formatLatency(ms: number): string {
  return Number.isFinite(ms) ? format.latency(ms) : "–";
}

/** Data age: `220 ms`, `2.4 s`, `6 min`, `1 h 12 min`. Shared engine implementation. */
export function formatAge(ms: number): string {
  return Number.isFinite(ms) ? format.dataAge(ms) : "–";
}

/** Fraction (0..1) as a percentage: `99.94%`. Shared engine implementation. */
export function formatPercent(fraction: number, decimals = 2): string {
  return Number.isFinite(fraction) ? format.percent(fraction, decimals) : "–";
}

/** One `Intl.DateTimeFormat` per option set for the clock formatters below. */
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", options);
    dateFormats.set(key, f);
  }
  return f;
}

export interface ClockOptions {
  /** Append milliseconds (`18:04:31.220`). */
  milliseconds?: boolean;
  /** Include seconds. Default true. */
  seconds?: boolean;
}

/** 24-hour clock time in a time zone: `18:04:31`, `18:04:31.220`, or `18:04`. */
export function formatClock(t: number, timeZone: string, options: ClockOptions = {}): string {
  const { milliseconds = false, seconds = true } = options;
  const key = `clock:${timeZone}:${seconds ? 1 : 0}:${milliseconds ? 1 : 0}`;
  const parts: Intl.DateTimeFormatOptions = {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  if (seconds || milliseconds) parts.second = "2-digit";
  if (milliseconds) parts.fractionalSecondDigits = 3;
  return dateFormat(key, parts).format(t);
}

/** 12-hour time of day in a time zone: `10:24 AM`. */
export function formatTimeOfDay(t: number, timeZone: string): string {
  return dateFormat(`tod:${timeZone}`, { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(t);
}

/** 16-point compass direction for a bearing in degrees: 278° → `W`. Shared engine implementation. */
export function compassDirection(degrees: number): string {
  return Number.isFinite(degrees) ? format.compass(degrees) : "";
}
