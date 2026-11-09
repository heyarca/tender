import { marketDetail, parseMarketId } from "@/lib/server/markets";
import { errorResponse, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ market: string }> }) {
  try { return json(marketDetail(request, parseMarketId((await context.params).market))); }
  catch (error) { return errorResponse(error); }
}
