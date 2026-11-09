import { writeFileSync, existsSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const ids = ["together", "deepinfra", "fireworks", "digitalocean", "cloudflare", "modal", "mistral", "nebius", "the-zone-bio", "arca-labs", "coreweave", "baseten", "novita", "crusoe", "gmicloud", "wafer"];
const file = "src/lib/payments/payees.ts";
if (existsSync(file)) throw new Error("Payees already exist; never rotate receiving addresses implicitly.");
const entries = ids.map(id => `  "${id}": "${privateKeyToAccount(generatePrivateKey()).address}",`);
writeFileSync(file, `import type { Address } from "viem";

// Base Sepolia receiving addresses. Private keys were discarded at generation.
export const PAYEES = {
${entries.join("\n")}
} as const satisfies Record<string, Address>;

export type ProviderId = keyof typeof PAYEES;

export function getPayee(providerId: string): Address {
  if (!Object.hasOwn(PAYEES, providerId)) throw new Error("Unknown payment provider");
  return PAYEES[providerId as ProviderId];
}
`);
console.log("Created 16 public Base Sepolia payee addresses; no payee keys saved.");
