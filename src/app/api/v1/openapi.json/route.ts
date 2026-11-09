import { openapiDocument } from "@/lib/server/openapi";
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.
export function GET() { return Response.json(openapiDocument); }
