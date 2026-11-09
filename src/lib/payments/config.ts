/** Tender only accepts USDC on Base Sepolia. Never register a mainnet wildcard. */
export const PAYMENT_NETWORK = "eip155:84532" as const;
export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
export const USDC_DECIMALS = 6;
export const DEFAULT_FACILITATOR_URL = "https://facilitator.payai.network";
export const DEFAULT_RPC_URL = "https://sepolia.base.org";
export const EXPLORER_URL = "https://sepolia.basescan.org";
export const MAX_PAYMENT_ATOMIC = BigInt(100); // $0.000100 per request.
