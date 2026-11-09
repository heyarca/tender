import { handleContractPath } from "@/lib/server/handlers";
import { preflight, methodNotAllowed, methodNotAllowedHead } from "@/lib/server/http";
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.

/** Every registry contract: `/api/v1/{namespace}/{action}`, e.g. `/api/v1/weather/current?location=seoul`. */
export async function GET(request: Request, context: { params: Promise<{ namespace: string; action: string }> }) {
  const { namespace, action } = await context.params;
  return handleContractPath(request, namespace, action);
}
const notAllowed = () => methodNotAllowed("Use GET for this contract");
export const HEAD = methodNotAllowedHead;
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = preflight;
