/**
 * PayPal receiver email per provider id. Filled with the PayPal sandbox receiver accounts.
 * Providers without a receiver are not paid; their earnings stay unpaid until one is added.
 */
export const PAYOUT_RECEIVERS: Readonly<Record<string, string>> = {};
