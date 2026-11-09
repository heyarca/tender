export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const output = new Headers(headers);
  output.set("Cache-Control", "private, no-store");
  return Response.json(body, { status, headers: output });
}
export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message } }, error.status);
  throw error;
}
