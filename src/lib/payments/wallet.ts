import { createPublicClient, erc20Abi, formatUnits, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { DEFAULT_RPC_URL, USDC_ADDRESS, USDC_DECIMALS } from "./config";
import { PAYEES } from "./payees";

export function getPayerAccount() {
  const key = process.env.TENDER_DEMO_PAYER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Payer wallet is not configured");
  return privateKeyToAccount(key as `0x${string}`);
}

export const BALANCE_CACHE_MS = 5_000;
export const BALANCE_DEADLINE_MS = 7_500;
const BALANCE_ATTEMPT_TIMEOUT_MS = 3_500;

type Balance = { id: string; address: Address; amountAtomic: string; amountUsd: string };
export interface BalanceSnapshot {
  network: "base-sepolia";
  asset: "USDC";
  tokenAddress: typeof USDC_ADDRESS;
  payer: Balance | null;
  payees: Balance[];
}

async function loadBalances(rpcUrl: string, entries: [string, Address][]): Promise<BalanceSnapshot> {
  const controller = new AbortController();
  const deadlineError = new Error("Base Sepolia balance read deadline exceeded");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { controller.abort(deadlineError); reject(deadlineError); }, BALANCE_DEADLINE_MS);
  });
  const load = async (): Promise<BalanceSnapshot> => {
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl, {
        timeout: BALANCE_ATTEMPT_TIMEOUT_MS,
        retryCount: 0, // Retry the whole batch once below, inside one total deadline.
        fetchOptions: { signal: controller.signal, cache: "no-store" },
      }),
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      controller.signal.throwIfAborted();
      try {
        const amounts = await client.multicall({
          allowFailure: false,
          batchSize: 0, // Exactly one Multicall3 eth_call, never per-provider chunks.
          contracts: entries.map(([, address]) => ({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          } as const)),
        });
        controller.signal.throwIfAborted();
        if (amounts.length !== entries.length) throw new Error("Incomplete balance batch");
        const balances = entries.map(([id, address], index) => {
          const amount = amounts[index];
          if (typeof amount !== "bigint" || amount < BigInt(0)) throw new Error("Invalid USDC balance");
          return { id, address, amountAtomic: amount.toString(), amountUsd: formatUnits(amount, USDC_DECIMALS) };
        });
        return { network: "base-sepolia", asset: "USDC", tokenAddress: USDC_ADDRESS, payer: balances.find((balance) => balance.id === "payer") ?? null, payees: balances.filter((balance) => balance.id !== "payer") };
      } catch (error) {
        if (attempt === 1 || controller.signal.aborted) throw error;
      }
    }
    throw new Error("Unable to read Base Sepolia balances");
  };
  try {
    // This is read-only: abort a stalled batch and reject within the total budget.
    // The aborted task cannot later populate the success cache.
    return await Promise.race([load(), deadline]);
  } finally { clearTimeout(timer); }
}

/** Per-instance success cache and keyed in-flight coalescing; failures are never cached. */
export function createBalanceReader() {
  let cache: { key: string; expiresAt: number; value: BalanceSnapshot } | undefined;
  const inFlight = new Map<string, Promise<BalanceSnapshot>>();
  return function read(): Promise<BalanceSnapshot> {
    const rpcUrl = process.env.TENDER_RPC_URL || DEFAULT_RPC_URL;
    const payer = process.env.TENDER_DEMO_PAYER_PRIVATE_KEY ? getPayerAccount().address : null;
    const key = JSON.stringify([rpcUrl, payer]);
    if (cache?.key === key && Date.now() < cache.expiresAt) return Promise.resolve(cache.value);
    const pending = inFlight.get(key);
    if (pending) return pending;
    const entries: [string, Address][] = [...(payer ? [["payer", payer] as [string, Address]] : []), ...Object.entries(PAYEES)];
    const request = loadBalances(rpcUrl, entries).then((value) => {
      cache = { key, value, expiresAt: Date.now() + BALANCE_CACHE_MS };
      return value;
    }).finally(() => { inFlight.delete(key); });
    inFlight.set(key, request);
    return request;
  };
}

export const readBalances = createBalanceReader();
