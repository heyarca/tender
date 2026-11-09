import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/payments/balances/route";
import { BalancesRateLimiter, balancesRateLimiter } from "./limits";
import type { BalanceSnapshot } from "./wallet";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
const { read, peek } = vi.hoisted(() => ({ read: vi.fn(), peek: vi.fn() }));
vi.mock("./wallet", () => ({ readBalances: Object.assign(read, { peek }) }));

const snapshot: BalanceSnapshot = {
  network: "base-sepolia",
  asset: "USDC",
  tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payer: null,
  payees: [{ id: "together", address: "0xE2A9aA9271235E39394865e6e9b3d614e98F5f5D", amountAtomic: "18", amountUsd: "0.000018" }],
};

let fresh: BalancesRateLimiter;
beforeEach(() => {
  fresh = new BalancesRateLimiter();
  vi.spyOn(balancesRateLimiter, "acquire").mockImplementation((now?: number) => fresh.acquire(now));
  vi.spyOn(balancesRateLimiter, "retryAfterSeconds").mockImplementation((now?: number) => fresh.retryAfterSeconds(now));
});
afterEach(() => vi.restoreAllMocks());

describe("balances endpoint", () => {
  it("returns honest 502 on failed reads, never fabricated zero balances", async () => {
    peek.mockReturnValue(undefined);
    read.mockRejectedValue(new Error("RPC failed"));
    const response = await GET();
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Unable to read Base Sepolia USDC balances" });
  });
  it("rejects misses beyond 30 per minute with 429 and Retry-After", async () => {
    peek.mockReturnValue(undefined);
    read.mockResolvedValue(snapshot);
    for (let index = 0; index < 30; index++) expect((await GET()).status).toBe(200);
    expect(read).toHaveBeenCalledTimes(30);
    const limited = await GET();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(await limited.json()).toEqual({ error: "Balance request limit reached" });
    expect(read).toHaveBeenCalledTimes(30);
  });
  it("serves cached or coalesced snapshots without consuming the rate limit", async () => {
    peek.mockReturnValue(Promise.resolve(snapshot));
    read.mockResolvedValue(snapshot);
    for (let index = 0; index < 40; index++) expect((await GET()).status).toBe(200);
    expect(read).not.toHaveBeenCalled();
    expect(vi.mocked(balancesRateLimiter.acquire)).not.toHaveBeenCalled();
  });
});
