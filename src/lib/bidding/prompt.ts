/**
 * Prompt for one bidding round. The model acts as every provider's pricing agent.
 */
import { format, PREFERENCE_LABELS, type RoutingPolicy } from "@/lib/tender";
import type { BidLimits } from "./types";

export const BIDDING_SYSTEM_PROMPT = `You run the pricing agents for the providers in one Tender market.
Tender is an API marketplace. For every request, providers bid a price per 1M requests, and Tender routes the
request to the best provider that meets the buyer's routing policy. Each provider's agent wants the most
revenue (bid x requests won). Winning traffic matters more than a few cents of margin, but a provider that
already wins can raise its bid while it stays ahead.

How routing works:
- A provider qualifies only if it passes every policy check: available, success rate >= min, bid <= max price,
  P95 latency <= max P95, data age <= max data age.
- Qualified providers are ranked by the preference. Lowest cost: bid, then P95, then data age. Lowest latency:
  P95, then bid, then data age. Freshest data: data age, then bid, then P95. Rank 1 gets the traffic.
- In pinned mode, the pinned provider gets all traffic while it qualifies.

All agents bid at the same time. Each agent sees only the current bids below, not the new bids of the
others. Decide each provider on its own, and cite only current facts in its reason.

Rules for each provider's agent:
1. Bid between the provider's floor and ceiling, in cents.
2. Bids only affect the price check and price ranking. A provider that fails a latency, freshness, reliability
   or availability check cannot win with a lower bid: keep its bid or move it a little, and say why.
3. A provider that fails only the price check may cut to the max price or below if its floor allows. If its
   floor is above the max price, it cannot qualify: keep its bid.
4. A provider that lost recent requests on price may undercut the winner by a small step if its floor allows.
   Do not race to the floor; keep a margin unless the gap demands it.
5. A provider that wins most recent requests may raise its bid, but must stay below the next qualified
   competitor that could take its traffic (lowest cost) and at or below the max price.
6. Under lowest latency or freshest data, price only breaks ties, so price moves should be small.
7. Change a bid only for a clear reason. No change is fine.
8. Reason: one short plain-English sentence, at most 20 words, that starts with "It" and cites one concrete
   fact from the data (recent wins, a competitor's name and bid, a failed check). No ids, no jargon.

Return exactly one entry for every provider.`;

export interface PromptProvider extends BidLimits {
  providerId: string;
  name: string;
  bid: number;
  p95LatencyMs: number;
  dataAgeMs: number;
  successRate: number;
  available: boolean;
  wins: number;
  share: number;
  qualifies: boolean;
  rank: number | null;
  exclusion: string | null;
  active: boolean;
}

export interface PromptInput {
  marketName: string;
  contract: string;
  policy: RoutingPolicy;
  recentRequests: number;
  /** Names of the latest winners, newest first. */
  recentWinners: string[];
  providers: PromptProvider[];
}

const money = (value: number) => format.price(value);

/** The user message: market facts as JSON the model can read. */
export function buildBiddingPrompt(input: PromptInput): string {
  const { policy } = input;
  const pinned = policy.mode.kind === "pinned" ? policy.mode.providerId : null;
  const facts = {
    market: input.marketName,
    contract: input.contract,
    policy: {
      preference: PREFERENCE_LABELS[policy.preference],
      mode: pinned ? `pinned to ${input.providers.find((p) => p.providerId === pinned)?.name ?? pinned}` : "automatic",
      maxPrice: money(policy.maxPrice),
      maxP95: format.latency(policy.maxP95LatencyMs),
      maxDataAge: format.dataAge(policy.maxDataAgeMs),
      minSuccessRate: format.percent(policy.minSuccessRate),
    },
    recentRequests: input.recentRequests,
    latestWinnersNewestFirst: input.recentWinners.slice(0, 10),
    providers: input.providers.map((p) => ({
      providerId: p.providerId,
      name: p.name,
      bid: money(p.bid),
      floor: money(p.floor),
      ceiling: money(p.ceiling),
      registryBid: money(p.base),
      servesTrafficNow: p.active,
      recentWins: p.wins,
      recentShare: format.percent(p.share, 0),
      p95: format.latency(p.p95LatencyMs),
      dataAge: format.dataAge(p.dataAgeMs),
      successRate: format.percent(p.successRate),
      available: p.available,
      qualifies: p.qualifies,
      rank: p.rank,
      failedChecks: p.exclusion,
    })),
  };
  return `Bids are USD per 1M requests. Market state:\n${JSON.stringify(facts, null, 2)}\n\nSet each provider's next bid.`;
}
