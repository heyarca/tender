/**
 * Display formatting. Every function is pure and hydration-safe:
 * numbers use a fixed `en-US` locale and times use an explicit time zone.
 *
 * Import as a namespace: `import { format } from "@/lib/tender"` → `format.price(18)`.
 */
import { timeZoneLabel } from "./time-zone";
export { timeZoneLabel } from "./time-zone";
import { PRICE_UNIT } from "./constants";
import type { MarketTimeZone } from "./types";

const MINUS = "\u2212";

const numberFormats = new Map<string, Intl.NumberFormat>();
function numberFormat(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  let nf = numberFormats.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: true,
    });
    numberFormats.set(key, nf);
  }
  return nf;
}

/** Fixed decimals with thousands separators: `number(75230.754, 2)` → "75,230.75". */
export function number(value: number, decimals = 0): string {
  const text = numberFormat(decimals, decimals).format(Math.abs(value));
  return value < 0 && text !== numberFormat(decimals, decimals).format(0) ? `${MINUS}${text}` : text;
}

/** Integer count: "1,234". */
export function count(value: number): string {
  return number(Math.round(value), 0);
}

/** Bid price (USD per 1M requests), no unit: "$18.00". */
export function price(value: number): string {
  return `$${number(value, 2)}`;
}

/** Price unit suffix: "/M req". */
export const priceUnit = PRICE_UNIT;

/** Bid price with unit: "$18.00 /M req". */
export function priceWithUnit(value: number): string {
  return `${price(value)} ${PRICE_UNIT}`;
}

function trimZeros(text: string, minDecimals: number): string {
  const [int, frac = ""] = text.split(".");
  let f = frac;
  while (f.length > minDecimals && f.endsWith("0")) f = f.slice(0, -1);
  return f.length ? `${int}.${f}` : int;
}

/**
 * Small USD amounts (per-request cost, spend): "$0.000018", "$0.0000007",
 * "$0.0123", "$4.50". Keeps three significant digits below one cent.
 */
export function cost(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : "";
  if (abs === 0) return "$0.00";
  if (abs < 0.01) {
    const decimals = Math.min(12, Math.max(2, Math.ceil(-Math.log10(abs)) + 2));
    return `${sign}$${trimZeros(abs.toFixed(decimals), 2)}`;
  }
  if (abs < 1) return `${sign}$${abs.toFixed(4)}`;
  return `${sign}$${number(abs, 2)}`;
}

/** Per-request cost of a bid: `requestCost(18)` → "$0.000018". */
export function requestCost(bidPrice: number): string {
  return cost(bidPrice / 1e6);
}

/** USD with cents: "$75,230.75". */
export function usd(value: number): string {
  return value < 0 ? `${MINUS}$${number(-value, 2)}` : `$${number(value, 2)}`;
}

/** Signed USD: "+$12.40", "−$3.10", "$0.00". */
export function signedUsd(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return "$0.00";
  return `${rounded > 0 ? "+" : MINUS}$${number(Math.abs(rounded), 2)}`;
}

/** Signed percent from a percent number: `signedPercent(0.0123)` → "+0.01%". */
export function signedPercent(percentValue: number, decimals = 2): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(percentValue * factor) / factor;
  if (rounded === 0) return `${(0).toFixed(decimals)}%`;
  return `${rounded > 0 ? "+" : MINUS}${Math.abs(rounded).toFixed(decimals)}%`;
}

function seconds(ms: number): string {
  // One decimal, trailing ".0" trimmed: 1200 → "1.2 s", 1000 → "1 s", 12_340 → "12.3 s".
  return `${trimZeros((ms / 1000).toFixed(1), 0)} s`;
}

function floorSeconds(ms: number): string {
  // Like `seconds`, but floored at one decimal so an age never displays as the
  // next unit: 59_960 → "59.9 s" (never "60 s").
  return `${trimZeros((Math.floor(ms / 100) / 10).toFixed(1), 0)} s`;
}

/** Latency: "210 ms"; from 1,000 ms "1.2 s". */
export function latency(ms: number): string {
  const rounded = Math.round(ms);
  if (rounded < 1000) return `${rounded} ms`;
  return seconds(ms);
}

/** Data age / duration: "220 ms", "2.4 s", "6 min", "1 h 12 min". */
export function dataAge(ms: number): string {
  const value = Math.max(0, ms);
  if (Math.round(value) < 1000) return `${Math.round(value)} ms`;
  // Floor at unit boundaries: only a full minute/hour shows the larger unit,
  // so 59_960 ms stays "59.9 s" and 3_599_000 ms stays "59 min".
  if (value < 60_000) return floorSeconds(value);
  const minutes = Math.floor(value / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Alias of `dataAge` for generic durations. */
export const duration = dataAge;

/** Ratio as percent: `percent(0.9994)` → "99.94%". */
export function percent(ratio: number, decimals = 2): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

/** Error rate ratio as percent: `errorRate(0.0006)` → "0.06%". */
export function errorRate(ratio: number): string {
  return percent(ratio, 2);
}

/** Temperature, rounded: "61°F". */
export function temperature(fahrenheit: number): string {
  const rounded = Math.round(fahrenheit);
  return `${rounded < 0 ? MINUS : ""}${Math.abs(rounded)}°F`;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** Compass label of a bearing: `compass(278)` → "W". */
export function compass(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS[index];
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
function zonedParts(ms: number, timeZone: string, withDate: boolean): Record<string, string> {
  const key = `${timeZone}:${withDate}`;
  let dtf = dateTimeFormats.get(key);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      ...(withDate ? { month: "short", day: "numeric" } : {}),
    });
    dateTimeFormats.set(key, dtf);
  }
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(ms)) parts[part.type] = part.value;
  return parts;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (value: number, size = 2) => String(value).padStart(size, "0");

function utcParts(ms: number) {
  const day = Math.floor(ms / 86_400_000);
  const rem = ms - day * 86_400_000;
  return {
    hours: Math.floor(rem / 3_600_000),
    minutes: Math.floor((rem % 3_600_000) / 60_000),
    seconds: Math.floor((rem % 60_000) / 1000),
    millis: Math.floor(rem % 1000),
  };
}

export interface TimeOptions {
  /** Include seconds. Default: `false` for PT, `true` for UTC. */
  seconds?: boolean;
  /** Include milliseconds (UTC only). Default: `true` for UTC. */
  milliseconds?: boolean;
  /** Append the zone label ("PT"/"UTC"). Default `true`. */
  zoneLabel?: boolean;
}

/**
 * Clock time in a market time zone.
 * PT: "10:42 AM PT" (`{ seconds: true }` → "10:42:07 AM PT").
 * UTC: "18:04:31.220 UTC".
 */
export function time(ms: number, timeZone: MarketTimeZone, options: TimeOptions = {}): string {
  const label = options.zoneLabel === false ? "" : ` ${timeZoneLabel(timeZone, ms)}`;
  if (timeZone === "UTC") {
    const p = utcParts(ms);
    const withSeconds = options.seconds ?? true;
    const withMillis = withSeconds && (options.milliseconds ?? true);
    let text = `${pad(p.hours)}:${pad(p.minutes)}`;
    if (withSeconds) text += `:${pad(p.seconds)}`;
    if (withMillis) text += `.${pad(p.millis, 3)}`;
    return `${text}${label}`;
  }
  const parts = zonedParts(ms, timeZone, false);
  const hour = String(Number(parts.hour) || 12);
  const withSeconds = options.seconds ?? false;
  const clock = withSeconds ? `${hour}:${parts.minute}:${parts.second}` : `${hour}:${parts.minute}`;
  return `${clock} ${(parts.dayPeriod ?? "").toUpperCase()}${label}`;
}

/** Date and time: "Nov 9, 10:42 AM PT" or "Nov 9, 18:04:31 UTC". */
export function dateTime(ms: number, timeZone: MarketTimeZone, options: TimeOptions = {}): string {
  if (timeZone === "UTC") {
    const day = Math.floor(ms / 86_400_000);
    // Civil date from days since epoch (Howard Hinnant's algorithm).
    const z = day + 719_468;
    const era = Math.floor(z / 146_097);
    const doe = z - era * 146_097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp < 10 ? mp + 3 : mp - 9;
    return `${MONTHS[m - 1]} ${d}, ${time(ms, timeZone, { milliseconds: false, ...options })}`;
  }
  const parts = zonedParts(ms, timeZone, true);
  return `${parts.month} ${parts.day}, ${time(ms, timeZone, options)}`;
}

/** ISO 8601 timestamp in UTC with milliseconds (for JSON views). */
export function isoTimestamp(ms: number): string {
  return new Date(ms).toISOString();
}

/** Relative time from the store clock: "just now", "12 s ago", "3 min ago", "2 h ago", "in 7 s". */
export function relativeTime(at: number, now: number): string {
  const diff = now - at;
  const abs = Math.abs(diff);
  if (abs < 1000) return "just now";
  let text: string;
  if (abs < 60_000) text = `${Math.floor(abs / 1000)} s`;
  else if (abs < 3_600_000) text = `${Math.floor(abs / 60_000)} min`;
  else if (abs < 86_400_000) text = `${Math.floor(abs / 3_600_000)} h`;
  else text = `${Math.floor(abs / 86_400_000)} d`;
  return diff >= 0 ? `${text} ago` : `in ${text}`;
}

/** Whole seconds remaining until `at` (never negative): `countdown(at, now)` → "7 s". */
export function countdown(at: number, now: number): string {
  return `${Math.max(0, Math.ceil((at - now) / 1000))} s`;
}
