import type { LiveMarketId } from "./live";
import type { RoutingPolicy } from "@/lib/tender/types";

/** Default policies for live markets. Bids are 0 until providers set prices, so cost ranking is a tie. */
export const LIVE_DEFAULTS: Record<LiveMarketId, RoutingPolicy> = {
  "btc-usd": { maxPrice: 2, maxP95LatencyMs: 1500, maxDataAgeMs: 10_000, minSuccessRate: 0.8, preference: "lowest-latency", mode: { kind: "auto" } },
  "sf-weather": { maxPrice: 40, maxP95LatencyMs: 2000, maxDataAgeMs: 2 * 3600_000, minSuccessRate: 0.8, preference: "freshest-data", mode: { kind: "auto" } },
};
