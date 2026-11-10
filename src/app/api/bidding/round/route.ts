import { connection } from "next/server";
import { BiddingError, rebid } from "@/lib/bidding/rebid";
import { biddingRoundInputSchema } from "@/lib/bidding/schema";
import { ROUND_MIN_INTERVAL_MS, type BiddingRoundError } from "@/lib/bidding/types";

const headers = { "Cache-Control": "private, no-store" };

/** Last round start per market (this server instance). */
const lastRoundAt = new Map<string, number>();

function fail(status: number, error: BiddingRoundError["error"], extra: Partial<BiddingRoundError> = {}, init: HeadersInit = {}) {
  return Response.json({ error, ...extra } satisfies BiddingRoundError, { status, headers: { ...headers, ...init } });
}

/** One bidding round: the providers' agents reprice their bids from load and competition. */
export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, { code: "invalid_request", message: "The body must be JSON." });
  }
  const parsed = biddingRoundInputSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "body";
    return fail(400, { code: "invalid_request", message: `Invalid ${path}: ${issue?.message ?? "bad value"}.` });
  }

  const marketId = parsed.data.marketId;
  const now = Date.now();
  const last = lastRoundAt.get(marketId);
  if (last !== undefined && now - last < ROUND_MIN_INTERVAL_MS) {
    const retryAfterSeconds = Math.ceil((ROUND_MIN_INTERVAL_MS - (now - last)) / 1000);
    return fail(
      429,
      { code: "rate_limited", message: `One bidding round every ${ROUND_MIN_INTERVAL_MS / 1000} s. Try again in ${retryAfterSeconds} s.` },
      { retryAfterSeconds },
      { "Retry-After": String(retryAfterSeconds) },
    );
  }
  lastRoundAt.set(marketId, now);

  try {
    return Response.json(await rebid(parsed.data), { headers });
  } catch (error) {
    if (error instanceof BiddingError) {
      // Bad input does not use up the market's round.
      if (error.code === "invalid_request") {
        lastRoundAt.delete(marketId);
        return fail(400, { code: error.code, message: error.message });
      }
      return fail(error.code === "not_configured" ? 503 : 502, { code: error.code, message: error.message });
    }
    throw error;
  }
}
