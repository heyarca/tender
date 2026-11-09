import { createPublicClient, erc20Abi, http, parseEventLogs } from "viem";
import { baseSepolia } from "viem/chains";
import { DEFAULT_RPC_URL, EXPLORER_URL, USDC_ADDRESS } from "../../src/lib/payments/config";

const hash = process.argv[2];
if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Usage: bun scripts/payments/inspect.ts <txHash>");
const client = createPublicClient({ chain: baseSepolia, transport: http(process.env.TENDER_RPC_URL || DEFAULT_RPC_URL, { timeout: 10_000, retryCount: 0 }) });
const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
const logs = receipt.logs.filter((log) => log.address.toLowerCase() === USDC_ADDRESS.toLowerCase());
const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs }).map((log) => ({ from: log.args.from, to: log.args.to, amountAtomic: log.args.value.toString() }));
console.log(JSON.stringify({ hash, network: "base-sepolia", status: receipt.status, blockNumber: receipt.blockNumber.toString(), transfers, explorerUrl: `${EXPLORER_URL}/tx/${hash}` }, null, 2));
