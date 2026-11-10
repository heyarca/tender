import { format } from "@/lib/tender";

const MICROS_PER_USD = 1_000_000;

/** Micro-USD as dollars: whole cents keep two decimals ("$5.00"), smaller amounts keep every digit ("$0.000018"). */
export function dollars(micros: number): string {
  const sign = micros < 0 ? "\u2212" : "";
  const abs = Math.abs(Math.round(micros));
  const fraction = String(abs % MICROS_PER_USD).padStart(6, "0");
  const decimals = fraction.endsWith("0000") ? fraction.slice(0, 2) : fraction.replace(/0+$/, "");
  return `${sign}$${format.count(Math.floor(abs / MICROS_PER_USD))}.${decimals}`;
}

export const usdToMicros = (usd: number): number => Math.round(usd * MICROS_PER_USD);
