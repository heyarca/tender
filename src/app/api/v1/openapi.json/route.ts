import { openapiDocument } from "@/lib/server/openapi";
export const runtime = "nodejs";
export function GET() { return Response.json(openapiDocument); }
