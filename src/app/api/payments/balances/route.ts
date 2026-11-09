import { connection } from "next/server";
import { balancesRateLimiter } from "@/lib/payments/limits";
import { readBalances } from "@/lib/payments/wallet";

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
    return Response.json({ error: "Unable to read Base Sepolia USDC balances" }, { status: 502, headers });
  }
}
