import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicClient, erc20Abi, http } from "viem";
import { baseSepolia } from "viem/chains";
import { BALANCE_CACHE_MS, BALANCE_DEADLINE_MS, createBalanceReader } from "./wallet";
import { PAYEES } from "./payees";
import { USDC_ADDRESS } from "./config";

const { multicall } = vi.hoisted(() => ({ multicall: vi.fn() }));
vi.mock("viem", async (original) => ({ ...await original<typeof import("viem")>(), createPublicClient: vi.fn(() => ({ multicall })), http: vi.fn(() => ({})) }));
const amounts = () => Array.from({ length: Object.keys(PAYEES).length + 1 }, (_, index) => BigInt(index * 1_000_000));
beforeEach(() => {
  vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", `0x${"0".repeat(63)}1`);
  vi.stubEnv("TENDER_RPC_URL", "https://rpc.tender.test");
  vi.clearAllMocks();
  multicall.mockReset().mockResolvedValue(amounts());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("USDC balance batch", () => {
  it("uses one non-chunked Multicall3 call for the payer and all payees", async () => {
    const result = await createBalanceReader()();
    expect(createPublicClient).toHaveBeenCalledWith(expect.objectContaining({ chain: baseSepolia }));
    expect(baseSepolia.contracts.multicall3.address.toLowerCase()).toBe("0xca11bde05977b3631167028862be2a173976ca11");
    expect(http).toHaveBeenCalledWith("https://rpc.tender.test", expect.objectContaining({ timeout: 3500, retryCount: 0, fetchOptions: { signal: expect.any(AbortSignal), cache: "no-store" } }));
    expect(multicall).toHaveBeenCalledOnce();
    const batch = multicall.mock.calls[0][0];
    expect(batch).toMatchObject({ allowFailure: false, batchSize: 0 });
    expect(batch.contracts).toHaveLength(Object.keys(PAYEES).length + 1);
    expect(batch.contracts.every((contract: { address: string; abi: unknown; functionName: string }) => contract.address === USDC_ADDRESS && contract.abi === erc20Abi && contract.functionName === "balanceOf")).toBe(true);
    expect(batch.contracts.slice(1).map((contract: { args: string[] }) => contract.args[0])).toEqual(Object.values(PAYEES));
    expect(result.payer?.amountAtomic).toBe("0");
    expect(result.payees[0]).toMatchObject({ id: "together", amountAtomic: "1000000", amountUsd: "1" });
  });
  it("supports an unconfigured payer without omitting payees", async () => {
    vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", "");
    multicall.mockResolvedValue(amounts().slice(1));
    const result = await createBalanceReader()();
    expect(result.payer).toBeNull();
    expect(result.payees).toHaveLength(Object.keys(PAYEES).length);
    expect(multicall.mock.calls[0][0].contracts).toHaveLength(Object.keys(PAYEES).length);
  });
  it("retries the complete batch exactly once and does not cache failures", async () => {
    const read = createBalanceReader();
    multicall.mockRejectedValueOnce(new Error("RPC unavailable")).mockResolvedValueOnce(amounts());
    await expect(read()).resolves.toHaveProperty("payees");
    expect(multicall).toHaveBeenCalledTimes(2);
    const fresh = createBalanceReader();
    multicall.mockRejectedValue(new Error("RPC unavailable"));
    await expect(fresh()).rejects.toThrow("RPC unavailable");
    expect(multicall).toHaveBeenCalledTimes(4);
    multicall.mockResolvedValue(amounts());
    await expect(fresh()).resolves.toHaveProperty("payees");
    expect(multicall).toHaveBeenCalledTimes(5);
  });
  it("coalesces concurrent reads and expires success after five seconds", async () => {
    vi.useFakeTimers();
    let finish!: (value: bigint[]) => void;
    multicall.mockImplementationOnce(() => new Promise<bigint[]>((resolve) => { finish = resolve; }));
    const read = createBalanceReader();
    const a = read();
    const b = read();
    expect(a).toBe(b);
    expect(multicall).toHaveBeenCalledOnce();
    finish(amounts());
    expect(await a).toBe(await b);
    await vi.advanceTimersByTimeAsync(BALANCE_CACHE_MS - 1);
    await read();
    expect(multicall).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await read();
    expect(multicall).toHaveBeenCalledTimes(2);
  });
  it("does not reuse a cache entry after RPC identity changes", async () => {
    const read = createBalanceReader();
    await read();
    vi.stubEnv("TENDER_RPC_URL", "https://other.tender.test");
    await read();
    expect(multicall).toHaveBeenCalledTimes(2);
  });
  it("keeps a single total deadline across the retry", async () => {
    vi.useFakeTimers();
    multicall.mockImplementationOnce(() => new Promise((_resolve, reject) => { setTimeout(() => reject(new Error("attempt timeout")), 3500); }))
      .mockImplementationOnce(() => new Promise(() => {}));
    const pending = createBalanceReader()();
    const failure = expect(pending).rejects.toThrow("deadline exceeded");
    await vi.advanceTimersByTimeAsync(3500);
    expect(multicall).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(BALANCE_DEADLINE_MS - 3500);
    await failure;
    expect(multicall).toHaveBeenCalledTimes(2);
  });
  it("peek serves the in-flight read and the fresh cache without new RPC traffic", async () => {
    const read = createBalanceReader();
    expect(read.peek()).toBeUndefined();
    const pending = read();
    expect(read.peek()).toBe(pending);
    const first = await pending;
    expect(await read.peek()).toBe(first);
    expect(multicall).toHaveBeenCalledOnce();
  });
  it("keeps the last good snapshot across cache expiry and failures for stale fallback", async () => {
    vi.useFakeTimers();
    const read = createBalanceReader();
    expect(read.lastGood()).toBeUndefined();
    const first = await read();
    expect(read.lastGood()).toEqual({ at: Date.now(), value: first });
    expect(multicall).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(BALANCE_CACHE_MS + 1);
    multicall.mockRejectedValue(new Error("RPC down"));
    await expect(read()).rejects.toThrow("RPC down");
    expect(multicall).toHaveBeenCalledTimes(3);
    expect(read.lastGood()?.value).toBe(first);
    vi.stubEnv("TENDER_RPC_URL", "https://other.tender.test");
    expect(read.lastGood()).toBeUndefined();
  });
  it("aborts at 7.5 seconds total, even if an attempt does not settle", async () => {
    vi.useFakeTimers();
    multicall.mockImplementation(() => new Promise(() => {}));
    const read = createBalanceReader();
    const pending = read();
    const failure = expect(pending).rejects.toThrow("deadline exceeded");
    const signal = vi.mocked(http).mock.calls[0][1]?.fetchOptions?.signal;
    await vi.advanceTimersByTimeAsync(BALANCE_DEADLINE_MS);
    await failure;
    expect(signal?.aborted).toBe(true);
    expect(multicall).toHaveBeenCalledOnce();
    multicall.mockResolvedValue(amounts());
    await expect(read()).resolves.toHaveProperty("payees");
    expect(multicall).toHaveBeenCalledTimes(2);
  });
});
