import { contractUrl, performPaidRequest } from "../../src/lib/payments/buyer";

const base = process.argv[2];
const market = process.argv[3] || "sf-weather";
if (!base || !["sf-weather", "btc-usd"].includes(market)) throw new Error("Usage: bun scripts/payments/smoke.ts <baseUrl> [sf-weather|btc-usd]");
const transport: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers.set("x-vercel-protection-bypass", process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
  return fetch(input, { ...init, headers });
};
const result = await performPaidRequest(contractUrl(base, { market: market as "sf-weather" | "btc-usd" }), transport);
console.log(JSON.stringify(result, null, 2));
