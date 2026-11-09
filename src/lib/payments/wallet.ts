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

export async function readBalances() {
  const client = createPublicClient({ chain: baseSepolia, transport: http(process.env.TENDER_RPC_URL || DEFAULT_RPC_URL, { timeout: 10_000, retryCount: 0 }) });
  let payer: Address | null = null;
  if (process.env.TENDER_DEMO_PAYER_PRIVATE_KEY) payer = getPayerAccount().address;
  const entries: [string, Address][] = [...(payer ? [["payer", payer] as [string, Address]] : []), ...Object.entries(PAYEES)];
  const balances = await Promise.all(entries.map(async ([id, address]) => {
    const amount = await client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address] });
    return { id, address, amountAtomic: amount.toString(), amountUsd: formatUnits(amount, USDC_DECIMALS) };
  }));
  return { network: "base-sepolia" as const, asset: "USDC" as const, tokenAddress: USDC_ADDRESS, payer: balances.find((balance) => balance.id === "payer") ?? null, payees: balances.filter((balance) => balance.id !== "payer") };
}
