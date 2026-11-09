import { handleContract } from "@/lib/server/handlers";
import { preflight, methodNotAllowed, methodNotAllowedHead } from "@/lib/server/http";
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.
export function GET(request: Request) { return handleContract(request, "sz-mlcc"); }
const notAllowed = () => methodNotAllowed("Use GET for this contract");
export const HEAD = methodNotAllowedHead;
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = preflight;
