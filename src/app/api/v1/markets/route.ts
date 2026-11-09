import { listMarkets } from "@/lib/server/markets";
import { json } from "@/lib/server/http";
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.
export function GET() { return json({ markets: listMarkets() }); }
