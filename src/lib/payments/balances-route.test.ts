import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/payments/balances/route";
import { readBalances } from "./wallet";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("./wallet", () => ({ readBalances: vi.fn() }));
afterEach(() => vi.resetAllMocks());
describe("balances endpoint", () => {
  it("returns honest 502 on failed reads, never fabricated zero balances", async () => {
    vi.mocked(readBalances).mockRejectedValue(new Error("RPC failed"));
    const response = await GET();
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Unable to read Base Sepolia USDC balances" });
  });
});
