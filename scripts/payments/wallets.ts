import { appendFileSync, existsSync, readFileSync, chmodSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { PAYEES } from "../../src/lib/payments/payees";

const file = ".env.local";
const content = existsSync(file) ? readFileSync(file, "utf8") : "";
const stored = content.match(/^TENDER_DEMO_PAYER_PRIVATE_KEY=(?:["']?)(0x[0-9a-fA-F]{64})/m)?.[1];
const key = stored || process.env.TENDER_DEMO_PAYER_PRIVATE_KEY || generatePrivateKey();
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Invalid TENDER_DEMO_PAYER_PRIVATE_KEY");
if (!stored) {
  if (/^TENDER_DEMO_PAYER_PRIVATE_KEY=/m.test(content)) throw new Error("Existing payer entry is invalid; repair it without rotating the wallet");
  appendFileSync(file, `\nTENDER_DEMO_PAYER_PRIVATE_KEY=${key}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
}
console.log("Base Sepolia payer:", privateKeyToAccount(key as `0x${string}`).address);
console.log("Fund USDC at https://faucet.circle.com (Base Sepolia). Private key stays in .env.local.");
console.table(PAYEES);
