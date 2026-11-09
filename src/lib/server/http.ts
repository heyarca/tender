export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const output = new Headers(headers);
  output.set("Cache-Control", "private, no-store");
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
/** Shared 405 for the methods the v1 routes deliberately do not implement. */
export function methodNotAllowed(message = "Use GET for this resource"): Response {
  return json({ error: { code: "method_not_allowed", message } }, 405, { Allow: "GET" });
}
/** Bodyless variant for HEAD, whose responses must not carry a payload. */
export function methodNotAllowedHead(): Response {
  return new Response(null, { status: 405, headers: { Allow: "GET", "Cache-Control": "private, no-store" } });
}
