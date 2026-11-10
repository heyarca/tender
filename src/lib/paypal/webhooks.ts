import { sql } from "@/lib/db";
import { PayPalError, paypalFetch } from "./client";
import { creditCapture } from "./orders";
import { handlePayoutsWebhook } from "./payouts";
import type { PayPalWebhookEvent } from "./types";

/** Largest webhook body we read. PayPal events are a few kilobytes. */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * Asks PayPal whether the `paypal-*` transmission headers sign this event for our webhook
 * (`POST /v1/notifications/verify-webhook-signature`). Only `SUCCESS` counts.
 */
export async function verifyWebhookSignature(headers: Headers, event: PayPalWebhookEvent): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new PayPalError("PAYPAL_WEBHOOK_ID is not set", 503);
  const fields = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
  };
  if (Object.values(fields).some((value) => !value)) return false;
  const result = await paypalFetch<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: { ...fields, webhook_id: webhookId, webhook_event: event },
  });
  return result.verification_status === "SUCCESS";
}

/** Order id of a capture resource (`supplementary_data.related_ids.order_id`). */
function captureOrderId(resource: unknown): string | null {
  const id = (resource as { supplementary_data?: { related_ids?: { order_id?: unknown } } } | null)?.supplementary_data?.related_ids?.order_id;
  return typeof id === "string" ? id : null;
}

async function dispatch(event: PayPalWebhookEvent): Promise<void> {
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = captureOrderId(event.resource);
    // Captures of orders Tender did not create are ignored.
    if (orderId) await creditCapture(orderId, event.resource);
    return;
  }
  if (event.event_type.startsWith("PAYMENT.PAYOUTSBATCH.") || event.event_type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    await handlePayoutsWebhook(event);
  }
}

/**
 * `POST /api/paypal/webhook`: verifies the signature, then handles each event id once. The
 * event is stored after its handler succeeds, so a failed handler answers 500 and PayPal
 * delivers it again. Handlers are idempotent, so a concurrent duplicate is harmless.
 */
export async function handleWebhookRequest(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "Payload too large" }, { status: 413, headers });
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(text) as PayPalWebhookEvent;
    if (typeof event?.id !== "string" || typeof event.event_type !== "string") throw new Error("Not a webhook event");
  } catch {
    return Response.json({ error: "Invalid event" }, { status: 400, headers });
  }
  try {
    if (!(await verifyWebhookSignature(request.headers, event))) {
      return Response.json({ error: "Invalid signature" }, { status: 400, headers });
    }
    const seen = (await sql.query("select 1 from webhook_events where id = $1", [event.id])) as unknown[];
    if (seen.length > 0) return Response.json({ received: true, duplicate: true }, { headers });
    await dispatch(event);
    await sql.query(
      "insert into webhook_events (id, event_type, resource_id, payload) values ($1, $2, $3, $4::jsonb) on conflict (id) do nothing",
      [event.id, event.event_type, typeof event.resource?.id === "string" ? event.resource.id : null, text],
    );
    return Response.json({ received: true }, { headers });
  } catch (error) {
    console.error("PayPal webhook error", { eventType: event.event_type, name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : "" });
    const status = error instanceof PayPalError && error.status === 503 ? 503 : 500;
    return Response.json({ error: "Webhook handling failed" }, { status, headers });
  }
}
