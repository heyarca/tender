export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const output = new Headers(headers);
  output.set("Cache-Control", "private, no-store");
  output.set("Access-Control-Allow-Origin", "*");
  return Response.json(body, { status, headers: output });
}
export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    // RFC 9110 15.5.5: a 405 must name the methods the resource accepts.
    const headers: [string, string][] = error.code === "method_not_allowed" ? [["Allow", "GET"]] : [];
    return json({ error: { code: error.code, message: error.message } }, error.status, headers.length > 0 ? headers : undefined);
  }
  throw error;
}
/** Request headers cross-origin browser clients may send to the v1 API. */
const CORS_ALLOW_HEADERS = "PAYMENT-SIGNATURE, X-PAYMENT, Content-Type, Tender-Max-Price, Tender-Max-P95-Ms, Tender-Max-Data-Age-Ms, Tender-Min-Success-Rate, Tender-Preference, Tender-Pin";

/** Decided CORS posture: the public v1 API is callable cross-origin without credentials. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: {
    Allow: "GET, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Max-Age": "600",
    "Cache-Control": "private, no-store",
  } });
}

/** Shared 405 for the methods the v1 routes deliberately do not implement. */
export function methodNotAllowed(message = "Use GET for this resource"): Response {
  return json({ error: { code: "method_not_allowed", message } }, 405, { Allow: "GET" });
}
/** Bodyless variant for HEAD, whose responses must not carry a payload. */
export function methodNotAllowedHead(): Response {
  return new Response(null, { status: 405, headers: { Allow: "GET", "Cache-Control": "private, no-store", "Access-Control-Allow-Origin": "*" } });
}
