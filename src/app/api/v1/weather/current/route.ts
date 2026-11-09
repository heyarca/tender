import { handleContract, marketForContract } from "@/lib/server/handlers";
import { errorResponse, ApiError } from "@/lib/server/http";
import { preflight, methodNotAllowed, methodNotAllowedHead } from "@/lib/server/http";
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.
export function GET(request: Request) {
  const values = new URL(request.url).searchParams.getAll("location");
  if (values.length > 1) return errorResponse(new ApiError(400, "unsupported_input", "Send one location value"));
  const marketId = marketForContract("weather", values[0] ?? null);
  if (!marketId) return errorResponse(new ApiError(400, "unsupported_input", `Unsupported location: ${values[0]}. See /api/v1/markets for the supported values.`));
  return handleContract(request, marketId);
}
const notAllowed = () => methodNotAllowed("Use GET for this contract");
export const HEAD = methodNotAllowedHead;
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = preflight;
