import { handleContract } from "@/lib/server/handlers";
export const runtime = "nodejs";
export function GET(request: Request) { return handleContract(request, "sf-weather"); }
export function HEAD() { return new Response(null, { status: 405, headers: { Allow: "GET", "Cache-Control": "private, no-store" } }); }
