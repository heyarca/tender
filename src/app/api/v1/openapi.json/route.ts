import { openapiDocument } from "@/lib/server/openapi";
import { json, methodNotAllowed } from "@/lib/server/http";
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.
export function GET() { return json(openapiDocument); }
const notAllowed = () => methodNotAllowed();
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
