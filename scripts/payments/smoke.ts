import { contractUrl, performPaidRequest } from "../../src/lib/payments/buyer";
import { paymentTransportHeaders } from "../../src/lib/payments/transport";

const base = process.argv[2];
const market = process.argv[3] || "sf-weather";
if (!base || !["sf-weather", "btc-usd"].includes(market)) throw new Error("Usage: bun scripts/payments/smoke.ts <baseUrl> [sf-weather|btc-usd]");
const transport: typeof fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const headers = paymentTransportHeaders(url, init?.headers ?? (input instanceof Request ? input.headers : undefined), process.env.VERCEL_AUTOMATION_BYPASS_SECRET, process.env.TENDER_PREVIEW_URL);
  return fetch(input, { ...init, headers });
};
const result = await performPaidRequest(contractUrl(base, { market: market as "sf-weather" | "btc-usd" }), transport);
console.log(JSON.stringify(result, null, 2));
