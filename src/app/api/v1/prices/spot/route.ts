import { handleContract } from "@/lib/server/handlers";
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.
export function GET(request: Request) { return handleContract(request, "btc-usd"); }
export function HEAD() { return new Response(null, { status: 405, headers: { Allow: "GET", "Cache-Control": "private, no-store" } }); }
