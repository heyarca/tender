import { marketDetail, parseMarketId } from "@/lib/server/markets";
import { preflight, errorResponse, json, methodNotAllowed } from "@/lib/server/http";
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.
export async function GET(request: Request, context: { params: Promise<{ market: string }> }) {
  try { return json(marketDetail(request, parseMarketId((await context.params).market))); }
  catch (error) { return errorResponse(error); }
}
const notAllowed = () => methodNotAllowed();
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = preflight;
