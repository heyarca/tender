import { format, fromDisplayValue, toDisplayValue, type NumericInputSpec } from "@/lib/tender";

/** Round a display value to the spec's decimals (avoids float noise like 0.30000000000000004). */
export function roundDisplay(spec: NumericInputSpec, display: number): number {
  const factor = 10 ** spec.decimals;
  return Math.round(display * factor) / factor;
}

/** Clamp a display value to the spec range, then round it to the spec's decimals. */
export function clampDisplay(spec: NumericInputSpec, display: number): number {
  return roundDisplay(spec, Math.min(spec.max, Math.max(spec.min, display)));
}

/** Engine value → display value, rounded for the input ("900000 ms" → 15 for a minutes spec). */
export function displayOf(spec: NumericInputSpec, value: number): number {
  return roundDisplay(spec, toDisplayValue(spec, value));
}

/** Display value → engine value, clamped to the spec range first. */
export function engineOf(spec: NumericInputSpec, display: number): number {
  return fromDisplayValue(spec, clampDisplay(spec, display));
}

/** `Intl.NumberFormat` options that show exactly the spec's decimals. */
export function numberFormatOf(spec: NumericInputSpec): Intl.NumberFormatOptions {
  return { minimumFractionDigits: spec.decimals, maximumFractionDigits: spec.decimals };
}

/**
 * Engine value with the spec's prefix and unit: "$40.00 /M req", "400 ms",
 * "15 min", "1,000 ms", "99.50%".
 */
export function formatSpecValue(spec: NumericInputSpec, value: number): string {
  const text = `${spec.prefix ?? ""}${format.number(displayOf(spec, value), spec.decimals)}`;
  return spec.unit === "%" ? `${text}%` : `${text} ${spec.unit}`;
}

/** Step a value by `steps` spec steps (display units), clamped to the range. */
export function stepDisplay(spec: NumericInputSpec, display: number, steps: number): number {
  return clampDisplay(spec, display + spec.step * steps);
}
