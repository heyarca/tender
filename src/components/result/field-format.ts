import type { FieldSpec } from "@/lib/registry";
import { formatUsd } from "@/components/viz/format";

/**
 * Display formatting for contract output fields (`FieldSpec` in `@/lib/registry`). Pure and
 * hydration-safe: fixed `en-US` locale and an explicit time zone for timestamps.
 */

const MINUS = "\u2212";

const numberFormats = new Map<number, Intl.NumberFormat>();
function numberFormat(maxDecimals: number): Intl.NumberFormat {
  let nf = numberFormats.get(maxDecimals);
  if (!nf) {
    nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: maxDecimals, useGrouping: true });
    numberFormats.set(maxDecimals, nf);
  }
  return nf;
}

/** `41,250,000`, `18.4`, `0.031`, `−122.0841`: grouping, up to four decimals, U+2212 minus. */
export function formatPlainNumber(value: number, maxDecimals = 4): string {
  const text = numberFormat(maxDecimals).format(Math.abs(value));
  return value < 0 && text !== "0" ? `${MINUS}${text}` : text;
}

/** Money: USD with a dollar sign and two decimals (four below one dollar); other units as a number. */
export function formatMoney(value: number, unit?: string): string {
  if (!unit || unit === "USD") return formatUsd(value, Math.abs(value) > 0 && Math.abs(value) < 1 ? 4 : 2);
  return formatPlainNumber(value, 2);
}

/** Units that attach to the number without a space. */
const ATTACHED_UNITS = new Set(["%", "°F", "°C", "/100"]);
export const isAttachedUnit = (unit: string) => ATTACHED_UNITS.has(unit);

/** `in-transit` → `In transit`, `no-match` → `No match`. */
export function humanize(value: string): string {
  const text = value.replace(/[-_]+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** `departure.airport` → `Airport`; `merchant` → `Merchant`; `camelCase` → `Camel case`. */
export function labelFromKey(key: string): string {
  const last = key.split(".").pop() ?? key;
  return humanize(last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase());
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", options);
    dateFormats.set(key, f);
  }
  return f;
}

/** Epoch ms of an ISO string or number, or `null`. */
export function toEpoch(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/** `Nov 9, 18:24 PT` in the market time zone. */
export function formatTimestamp(t: number, timeZone: string, timeZoneLabel?: string): string {
  const text = dateFormat(`ts:${timeZone}`, {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(t);
  return timeZoneLabel ? `${text} ${timeZoneLabel}` : text;
}

/** Calendar date (`2026-11-12` → `Nov 12, 2026`), read in UTC so the day never shifts. */
export function formatDate(t: number): string {
  return dateFormat("date", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(t);
}

/** Short link text: host and path without the protocol (`tender.heyarca.app/audio/sample.mp3`). */
export function shortUrl(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export interface FormatContext {
  timeZone: string;
  timeZoneLabel?: string;
}

/**
 * Scalar value as text (no unit). Lists and objects are rendered by the components; here they
 * fall back to a compact summary.
 */
export function formatScalar(field: Pick<FieldSpec, "type" | "unit">, value: unknown, context: FormatContext): string {
  if (value === null || value === undefined || value === "") return "–";
  switch (field.type) {
    case "money":
      return typeof value === "number" ? formatMoney(value, field.unit) : String(value);
    case "number":
      return typeof value === "number" ? formatPlainNumber(value) : String(value);
    case "integer":
      return typeof value === "number" ? formatPlainNumber(Math.round(value), 0) : String(value);
    case "percent":
      return typeof value === "number" ? formatPlainNumber(value, 2) : String(value);
    case "boolean":
      return value === true ? "Yes" : value === false ? "No" : String(value);
    case "timestamp": {
      const t = toEpoch(value);
      return t === null ? String(value) : formatTimestamp(t, context.timeZone, context.timeZoneLabel);
    }
    case "date": {
      const t = toEpoch(value);
      return t === null ? String(value) : formatDate(t);
    }
    case "enum":
      return typeof value === "string" ? humanize(value) : String(value);
    case "url":
      return typeof value === "string" ? shortUrl(value) : String(value);
    case "list":
      return Array.isArray(value) ? (value.length ? value.map((item) => formatLoose(item)).join(", ") : "None") : String(value);
    case "object":
      return typeof value === "object" ? Object.keys(value as object).length + " fields" : String(value);
    default:
      return typeof value === "number" ? formatPlainNumber(value) : String(value);
  }
}

/** Best-effort text for an untyped value (list items, nested object entries). */
export function formatLoose(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "number") return formatPlainNumber(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatLoose).join(", ");
  return Object.values(value as Record<string, unknown>).map(formatLoose).join(" · ");
}

/** Unit shown after a value, or `undefined` (USD money is already shown with `$`). */
export function displayUnit(field: Pick<FieldSpec, "type" | "unit">): string | undefined {
  if (!field.unit) return undefined;
  if (field.type === "money" && field.unit === "USD") return undefined;
  return field.unit;
}
