import { handleWebhookRequest } from "@/lib/paypal/webhooks";

/** PayPal webhook events: top-up captures and payouts. */
export async function POST(request: Request) {
  return handleWebhookRequest(request);
}
