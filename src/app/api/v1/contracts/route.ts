import { listContracts } from "@/lib/server/markets";
import { preflight, json, methodNotAllowed } from "@/lib/server/http";
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.
export function GET() { return json(listContracts()); }
const notAllowed = () => methodNotAllowed();
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = preflight;
