import type { PaidRequestEvent, PaidRequestFailure, PaidRequestProgress, PaidRequestResult } from "./types";

export class PaymentResponseError extends Error {
  constructor(public readonly failure: PaidRequestFailure) { super(failure.message); }
}
function retryAfter(headers: Headers): number | undefined {
  const value = Number(headers.get("Retry-After"));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
function fail(status: number, message: string, details?: unknown, retryAfterSeconds?: number): never {
  throw new PaymentResponseError({ status, message, ...(details !== undefined ? { details } : {}), ...(retryAfterSeconds ? { retryAfterSeconds } : {}) });
}
function isResult(value: unknown): value is PaidRequestResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<PaidRequestResult>;
  return !!result.response && !!result.receipt && typeof result.receipt.txHash === "string" && typeof result.receipt.providerId === "string";
}

/** Consume either the legacy JSON reply or an opt-in stream. Never invent completion at EOF. */
export async function readPaidResponse(response: Response, onProgress: (event: PaidRequestProgress) => void): Promise<PaidRequestResult> {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
    let body: unknown;
    try { body = await response.json(); } catch { fail(response.status, "Payment service returned an unreadable response", undefined, retryAfter(response.headers)); }
    if (!response.ok) {
      const error = body && typeof body === "object" ? body as { error?: unknown; details?: unknown } : {};
      fail(response.status, typeof error.error === "string" ? error.error : "Payment request failed", error.details, retryAfter(response.headers));
    }
    if (!isResult(body)) fail(response.status, "Payment service returned an invalid receipt");
    return body;
  }
  if (!response.body) fail(response.status, "Payment stream is missing");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal: PaidRequestResult | undefined;
  const line = (text: string) => {
    if (!text.trim()) return;
    let event: PaidRequestEvent;
    try { event = JSON.parse(text) as PaidRequestEvent; } catch { fail(response.status, "Payment stream contains an invalid event"); }
    if (!event || typeof event !== "object") fail(response.status, "Payment stream contains an invalid event");
    if (event.type === "payment-required" || event.type === "signed") onProgress(event);
    else if (event.type === "result") {
      if (!isResult(event.result)) fail(response.status, "Payment stream returned an invalid receipt");
      terminal = event.result;
    } else if (event.type === "error") {
      fail(typeof event.status === "number" ? event.status : 502, typeof event.error === "string" ? event.error : "Payment request failed", event.details, event.retryAfterSeconds);
    } else fail(response.status, "Payment stream contains an unknown event");
  };
  try {
    while (!terminal) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 1_048_576) fail(response.status, "Payment stream event is too large");
      let newline: number;
      while (!terminal && (newline = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
      if (done) {
        if (!terminal) line(buffer);
        break;
      }
    }
    if (!terminal) fail(response.status, "Payment stream ended without a receipt. Check balances before trying again.");
    return terminal;
  } finally {
    // A terminal receipt is already settled; cancellation only stops further response reading.
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
