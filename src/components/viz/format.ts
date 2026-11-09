/**
 * Display formatters for viz and result components. Every formatter that touches time takes an
 * explicit `timeZone`, so server and client output agree. Formatters are cached per option set.
 */

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(key: string, options: Intl.NumberFormatOptions) {
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat("en-US", options);
    numberFormats.set(key, format);
  }
  return format;
}

function dateFormat(key: string, options: Intl.DateTimeFormatOptions) {
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", options);
    dateFormats.set(key, format);
  }
  return format;
}

/** `$75,230.75` (always `decimals` fraction digits). */
export function formatUsd(value: number, decimals = 2): string {
  return numberFormat(`usd:${decimals}`, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** `1,018` / `9.4` with a fixed number of fraction digits. */
export function formatNumber(value: number, decimals = 0): string {
  return numberFormat(`num:${decimals}`, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Request latency: `84 ms`, `1.2 s` from 1,000 ms. */
export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms)) return "–";
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  return `${formatNumber(ms / 1_000, 1)} s`;
}

/** Data age: `220 ms`, `2.4 s`, `6 min`, `1 h 12 min`. */
export function formatAge(ms: number): string {
  if (!Number.isFinite(ms)) return "–";
  const abs = Math.max(0, ms);
  if (abs < 1_000) return `${Math.round(abs)} ms`;
  if (abs < 60_000) return `${formatNumber(abs / 1_000, 1)} s`;
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Fraction (0..1) as a percentage: `99.94%`. */
export function formatPercent(fraction: number, decimals = 2): string {
  if (!Number.isFinite(fraction)) return "–";
  return `${formatNumber(fraction * 100, decimals)}%`;
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

const COMPASS_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

/** 16-point compass direction for a bearing in degrees: 278° → `W`. */
export function compassDirection(degrees: number): string {
  if (!Number.isFinite(degrees)) return "";
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS_16[Math.round(normalized / 22.5) % 16];
}
