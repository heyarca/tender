/** Whole or fractional dollars as integer micro-USD: 5 -> 5_000_000. */
export const usdToMicros = (usd: number): number => Math.round(usd * 1_000_000);
