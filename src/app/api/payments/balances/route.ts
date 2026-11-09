import { connection } from "next/server";
import { balancesRateLimiter } from "@/lib/payments/limits";
import { BALANCE_STALE_MS, readBalances } from "@/lib/payments/wallet";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  await connection();
  try {
    // Cached or coalesced snapshots need no RPC traffic and bypass the rate limit.
    const ready = readBalances.peek();
    if (!ready && !balancesRateLimiter.acquire()) {
      return Response.json({ error: "Balance request limit reached" }, { status: 429, headers: { ...headers, "Retry-After": String(balancesRateLimiter.retryAfterSeconds()) } });
    }
    return Response.json(await (ready ?? readBalances()), { headers });
  } catch {
    // A transient RPC failure serves the last good snapshot as stale instead of a bare 502.
    const last = readBalances.lastGood();
    if (last && Date.now() - last.at <= BALANCE_STALE_MS) {
      return Response.json({ ...last.value, stale: true, as_of: new Date(last.at).toISOString() }, { headers });
    }
    return Response.json({ error: "Unable to read Base Sepolia USDC balances" }, { status: 502, headers });
  }
}
