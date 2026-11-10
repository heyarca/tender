import type { PayPalWebhookEvent } from "./types";

/**
 * Handles `PAYMENT.PAYOUTSBATCH.*` and `PAYMENT.PAYOUTS-ITEM.*` webhook events after the
 * webhook route verified and stored them.
 */
export async function handlePayoutsWebhook(event: PayPalWebhookEvent): Promise<void> {
  // TODO(payouts lane): update payout_batches and payout_items from the event.
  void event;
  return;
}
