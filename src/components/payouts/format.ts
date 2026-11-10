/** Money and time formatting for payouts. Integer math on micro-USD (1 USD = 1_000_000). */

const MICROS_PER_USD = 1_000_000;

function split(micros: number): { sign: string; whole: string; fraction: string } {
  const abs = Math.abs(micros);
  const whole = Math.floor(abs / MICROS_PER_USD).toLocaleString("en-US");
  return { sign: micros < 0 ? "-" : "", whole, fraction: String(abs % MICROS_PER_USD).padStart(6, "0") };
}

/** `$12.34`: payouts are whole cents. */
export function formatCents(micros: number): string {
  const { sign, whole, fraction } = split(micros);
  return `${sign}$${whole}.${fraction.slice(0, 2)}`;
}

/** `$0.000018`: earnings keep micro-USD precision. */
export function formatMicros(micros: number): string {
  const { sign, whole, fraction } = split(micros);
  return `${sign}$${whole}.${fraction}`;
}

const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

/** `Nov 10, 3:04:05 PM` in the viewer's time zone. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
