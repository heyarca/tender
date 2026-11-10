/**
 * Server-side bidding round: one model call reprices every provider's bid.
 * Bids are clamped to [floor, ceiling] and rounded to cents here, whatever the model returns.
 */
import { generateText, Output } from "ai";
import {
  evaluateMarket,
  isMarketId,
  MARKETS,
  sanitizePolicy,
  successRateOf,
  type ProviderConditions,
  type RankableProvider,
} from "@/lib/tender";
import { bidLimits, clampBid } from "./limits";
import { BIDDING_SYSTEM_PROMPT, buildBiddingPrompt, type PromptProvider } from "./prompt";
import { modelOutputSchema } from "./schema";
import { BIDDING_FALLBACK_MODELS, BIDDING_MODEL, type BiddingRoundInput, type BiddingRoundResult, type ProviderBid } from "./types";

export type BiddingErrorCode = "invalid_request" | "model_error" | "not_configured";

export class BiddingError extends Error {
  constructor(
    readonly code: BiddingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BiddingError";
  }
}

const MAX_REASON_LENGTH = 200;

function cleanReason(text: string): string | null {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return null;
  return line.length > MAX_REASON_LENGTH ? `${line.slice(0, MAX_REASON_LENGTH - 1).trimEnd()}…` : line;
}

export interface RebidOptions {
  model?: string;
  clock?: () => number;
}

/** Run one bidding round for a market. Throws `BiddingError` on bad input or a failed model call. */
export async function rebid(input: BiddingRoundInput, options: RebidOptions = {}): Promise<BiddingRoundResult> {
  const model = options.model ?? BIDDING_MODEL;
  const clock = options.clock ?? Date.now;
  if (!isMarketId(input.marketId)) throw new BiddingError("invalid_request", `Unknown market: ${input.marketId}.`);
  const definition = MARKETS[input.marketId];
  const fixtures = definition.providers;
  const fixtureIds = new Set(fixtures.map((f) => f.id));
  const sent = new Map((input.providers ?? []).map((p) => [p.providerId, p]));
  for (const id of sent.keys()) {
    if (!fixtureIds.has(id)) throw new BiddingError("invalid_request", `Unknown provider in ${definition.shortName}: ${id}.`);
  }
  const policy = sanitizePolicy(definition.id, input.policy) ?? definition.defaultPolicy;

  // Current conditions: the client's state, else the registry defaults.
  const rankable: (RankableProvider & { wins: number })[] = fixtures.map((fixture) => {
    const p = sent.get(fixture.id);
    const conditions: ProviderConditions = p
      ? { bidPrice: p.bid, p95LatencyMs: p.p95LatencyMs, dataAgeMs: p.dataAgeMs, errorRate: p.errorRate, available: p.available }
      : { ...fixture.defaults };
    return { id: fixture.id, name: fixture.name, conditions, wins: p?.wins ?? 0 };
  });
  const evaluation = evaluateMarket(rankable, policy);
  const recentRequests = input.recentRequests ?? rankable.reduce((sum, p) => sum + p.wins, 0);
  const nameOf = (id: string) => fixtures.find((f) => f.id === id)?.name ?? id;
  const activeId =
    policy.mode.kind === "pinned" ? policy.mode.providerId : input.activeProviderId === undefined ? evaluation.recommendedId : input.activeProviderId;

  const providers: PromptProvider[] = rankable.map((p) => {
    const fixture = fixtures.find((f) => f.id === p.id)!;
    const ev = evaluation.byId[p.id];
    return {
      providerId: p.id,
      name: p.name,
      ...bidLimits(fixture.defaults.bidPrice),
      bid: p.conditions.bidPrice,
      p95LatencyMs: p.conditions.p95LatencyMs,
      dataAgeMs: p.conditions.dataAgeMs,
      successRate: p.conditions.available ? successRateOf(p.conditions) : 0,
      available: p.conditions.available,
      wins: p.wins,
      share: recentRequests > 0 ? p.wins / recentRequests : 0,
      qualifies: ev.qualifies,
      rank: ev.rank,
      exclusion: ev.reasons.length ? ev.reasons.map((r) => r.message).join("; ") : null,
      active: p.id === activeId,
    };
  });

  const prompt = buildBiddingPrompt({
    marketName: definition.name,
    contract: definition.contract,
    policy,
    recentRequests,
    recentWinners: (input.recentWinners ?? []).filter((id) => fixtureIds.has(id)).map(nameOf),
    providers,
  });

  const ids = fixtures.map((f) => f.id) as [string, ...string[]];
  const started = clock();
  let output: { bids: { providerId: string; bid: number; reason: string }[] };
  try {
    const result = await generateText({
      model,
      system: BIDDING_SYSTEM_PROMPT,
      prompt,
      output: Output.object({ schema: modelOutputSchema(ids) }),
      reasoning: "low",
      maxRetries: 1,
      timeout: 45_000,
      providerOptions: { gateway: { models: BIDDING_FALLBACK_MODELS } },
    });
    output = result.output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/api key|unauthori[sz]ed|authentication|AI_GATEWAY_API_KEY|OIDC/i.test(message)) {
      throw new BiddingError("not_configured", "The bidding model is not available: the AI Gateway rejected the credentials.");
    }
    throw new BiddingError("model_error", `The bidding model did not return bids: ${message.slice(0, 240)}`);
  }
  const latencyMs = clock() - started;

  const answers = new Map<string, { bid: number; reason: string }>();
  for (const entry of output.bids) {
    if (!answers.has(entry.providerId) && Number.isFinite(entry.bid)) answers.set(entry.providerId, entry);
  }
  if (!answers.size) throw new BiddingError("model_error", "The bidding model returned no bids.");

  const bids: ProviderBid[] = providers.map((p) => {
    const answer = answers.get(p.providerId);
    const limits = { base: p.base, floor: p.floor, ceiling: p.ceiling };
    if (!answer) {
      return { providerId: p.providerId, name: p.name, ...limits, previousBid: p.bid, bid: p.bid, reason: null, changed: false };
    }
    // A kept bid stays as is, even when an operator edit put it outside the agent's limits.
    const bid = Math.abs(answer.bid - p.bid) < 0.005 ? p.bid : clampBid(answer.bid, limits);
    return {
      providerId: p.providerId,
      name: p.name,
      ...limits,
      previousBid: p.bid,
      bid,
      reason: cleanReason(answer.reason),
      changed: bid !== p.bid,
    };
  });

  return { marketId: definition.id, bids, model, latencyMs, at: clock() };
}
