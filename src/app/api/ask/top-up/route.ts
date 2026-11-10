import { dollars } from "@/lib/agent/money";
import { accountIdFromCookie } from "@/lib/ledger";
import { accountError, accountJson, readJsonObject, requireJson } from "@/lib/ledger/http";
import { PayPalError } from "@/lib/paypal/client";
import { captureTopUpOrder } from "@/lib/paypal/orders";

/** `POST /api/ask/top-up` `{ orderId }`: captures an approved Ask Tender top-up. Safe to repeat. */
export async function POST(request: Request) {
  const notJson = requireJson(request);
  if (notJson) return notJson;
  const accountId = accountIdFromCookie(request);
  const body = await readJsonObject(request).catch(() => ({}) as Record<string, unknown>);
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!accountId || !orderId) return accountError(400, "invalid_order", "Send the order id");
  try {
    const { status, balanceMicros } = await captureTopUpOrder({ orderId, accountId });
    return accountJson({ status, balance: dollars(balanceMicros) });
  } catch (error) {
    if (!(error instanceof PayPalError)) throw error;
    const notApproved = JSON.stringify(error.details ?? "").includes("ORDER_NOT_APPROVED");
    return notApproved
      ? accountError(409, "not_approved", "Approve the payment in PayPal first")
      : accountError(error.status >= 500 ? 502 : error.status, "paypal_error", error.message);
  }
}

/**
 * PayPal sends the buyer here after the approve page (`?token=<order id>`). Captures the order, then
 * closes the PayPal window, or goes back to the markets when it was opened as a full page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  const accountId = accountIdFromCookie(request);
  if (orderId && accountId && !url.searchParams.has("cancel")) {
    try {
      await captureTopUpOrder({ orderId, accountId });
    } catch (error) {
      // The panel captures again and shows the result.
      console.error("Ask Tender top-up capture failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    }
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Tender</title><script>if (window.opener) window.close(); else location.replace("/markets");</script>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
