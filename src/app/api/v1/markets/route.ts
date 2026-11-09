import { listMarkets } from "@/lib/server/markets";
import { json } from "@/lib/server/http";
export const runtime = "nodejs";
export function GET() { return json({ markets: listMarkets() }); }
