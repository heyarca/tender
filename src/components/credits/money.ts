const MINUS = "\u2212";

/**
 * Micro-USD as dollars with every significant micro-dollar: 10_000_000 -> "$10.00",
 * 9_999_982 -> "$9.999982", 18 -> "$0.000018". Integer math only.
 */
export function formatMicros(micros: number, options: { signed?: boolean } = {}): string {
  const abs = Math.abs(Math.trunc(micros));
  const dollars = Math.floor(abs / 1_000_000);
  const fraction = String(abs % 1_000_000).padStart(6, "0").replace(/0+$/, "").padEnd(2, "0");
  const sign = micros < 0 ? MINUS : options.signed && micros > 0 ? "+" : "";
  return `${sign}$${dollars.toLocaleString("en-US")}.${fraction}`;
}

/** Top-up amounts offered as buttons, in micro-USD. */
export const TOP_UP_OPTIONS = [5_000_000, 10_000_000, 20_000_000] as const;

/** 10_000_000 -> "10.00" (the PayPal order amount). */
export function microsToAmount(micros: number): string {
  const cents = Math.round(micros / 10_000);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
