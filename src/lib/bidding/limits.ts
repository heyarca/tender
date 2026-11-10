import type { BidLimits } from "./types";

/** Round to cents. */
export const roundCents = (value: number) => Math.round(value * 100) / 100;

/** Default limits of a provider's agent: floor 70% of the registry bid (at least $0.01), ceiling 150%. */
export function bidLimits(base: number): BidLimits {
  return { base, floor: Math.max(0.01, roundCents(base * 0.7)), ceiling: roundCents(base * 1.5) };
}

/** Clamp a bid to its limits and round to cents. */
export function clampBid(bid: number, limits: Pick<BidLimits, "floor" | "ceiling">): number {
  return roundCents(Math.min(limits.ceiling, Math.max(limits.floor, bid)));
}
