import { accountError } from "@/lib/ledger/http";
import { PayPalError } from "./client";

/** First `issue` of a PayPal error body (for example `INSTRUMENT_DECLINED`). */
export function paypalIssue(error: PayPalError): string | undefined {
  const details = Array.isArray(error.details) ? error.details : (error.details as { details?: unknown } | undefined)?.details;
  const issue = Array.isArray(details) ? (details[0] as { issue?: unknown } | undefined)?.issue : undefined;
  return typeof issue === "string" ? issue : undefined;
}

/** JSON error for a failed PayPal call. PayPal 4xx keep their status; anything else is 502. */
export function paypalErrorResponse(error: unknown): Response {
  if (!(error instanceof PayPalError)) {
    console.error("PayPal route error", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    return accountError(502, "paypal_error", "PayPal is not responding. Try again.");
  }
  if (error.status === 503) return accountError(503, "paypal_unavailable", "PayPal checkout is not available right now");
  const status = error.status >= 400 && error.status < 500 ? error.status : 502;
  const issue = paypalIssue(error);
  const body = { error: { code: issue ? issue.toLowerCase() : "paypal_error", message: error.message, ...(issue ? { issue } : {}), ...(error.debugId ? { debug_id: error.debugId } : {}) } };
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
