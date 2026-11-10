/**
 * Provider bidding agents: shared types and constants (client and server safe).
 *
 * Each provider in a market has a bidding agent. One model call per round reprices every
 * provider's bid from load (recent wins) and competition, inside the provider's floor and ceiling.
 */
import type { MarketId, ProviderId, RoutingPreference } from "@/lib/tender";

/** Model for every bidding round (Vercel AI Gateway id). Change it here only. */
export const BIDDING_MODEL = "openai/gpt-5-mini";

/** Minimum time between rounds for one market, per server instance. */
export const ROUND_MIN_INTERVAL_MS = 15_000;

/** Time between automatic rounds while the market's auto-run is on. */
export const AUTO_ROUND_INTERVAL_MS = 45_000;

/** Recent requests the client reports (newest first). */
export const RECENT_REQUEST_LIMIT = 20;

/** Provider state the client sends for one round. */
export interface BiddingProviderInput {
  providerId: ProviderId;
  /** Current bid, USD per 1M requests. */
  bid: number;
  p95LatencyMs: number;
  dataAgeMs: number;
  /** 0..1 */
  errorRate: number;
  available: boolean;
  /** Served requests won in the recent window. */
  wins: number;
}

/** Routing policy the client sends (the mode is optional). */
export interface BiddingPolicyInput {
  maxPrice: number;
  maxP95LatencyMs: number;
  maxDataAgeMs: number;
  minSuccessRate: number;
  preference: RoutingPreference;
  mode?: { kind: "auto" } | { kind: "pinned"; providerId: ProviderId };
}

/** Body of `POST /api/bidding/round`. */
export interface BiddingRoundInput {
  marketId: MarketId;
  policy?: BiddingPolicyInput;
  providers?: BiddingProviderInput[];
  /** Provider that serves requests now. */
  activeProviderId?: ProviderId | null;
  /** Served requests in the recent window. */
  recentRequests?: number;
  /** Winners of the most recent served requests, newest first. */
  recentWinners?: ProviderId[];
}

/** Price limits of one provider's agent. */
export interface BidLimits {
  /** Registry bid. */
  base: number;
  /** Lowest bid the agent may set. */
  floor: number;
  /** Highest bid the agent may set. */
  ceiling: number;
}

/** One provider's bid after a round. */
export interface ProviderBid extends BidLimits {
  providerId: ProviderId;
  name: string;
  /** Bid before the round. */
  previousBid: number;
  /** Bid after the round (clamped to [floor, ceiling], 2 decimals). */
  bid: number;
  /** One short sentence from the model (`null` when the model left the provider out). */
  reason: string | null;
  changed: boolean;
}

/** Response of `POST /api/bidding/round`. */
export interface BiddingRoundResult {
  marketId: MarketId;
  bids: ProviderBid[];
  model: string;
  latencyMs: number;
  /** Server time of the round (ms). */
  at: number;
}

/** Error body of `POST /api/bidding/round`. */
export interface BiddingRoundError {
  error: { code: "invalid_request" | "rate_limited" | "model_error" | "not_configured"; message: string };
  /** Seconds until the next round is allowed (rate limit only). */
  retryAfterSeconds?: number;
}
