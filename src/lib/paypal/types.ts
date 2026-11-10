/** A PayPal webhook event (`POST /api/paypal/webhook` body). */
export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource_type?: string;
  // The resource shape depends on `event_type`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource: any;
  create_time?: string;
}
