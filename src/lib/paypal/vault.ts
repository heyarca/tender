import { randomUUID } from "node:crypto";
import {
  attachAutoTopUpOrder,
  AUTO_TOP_UP_MICROS,
  clearVault,
  failAutoTopUp,
  getAccount,
  lowBalanceThreshold,
  reserveAgentTopUp,
  saveVault,
  savedVaultId,
  type AgentTopUpRefusal,
} from "@/lib/ledger";
import { PayPalError, paypalFetch } from "./client";
import { creditCapture, microsToUsd } from "./orders";

/**
 * Saved PayPal for automatic top-ups (PayPal Payment Method Tokens v3, "save PayPal without
 * purchase"): a setup token, the payer approves it in PayPal, then a payment token that Tender
 * stores on the account and charges with Orders v2 while the payer is away.
 */

interface PayPalLink { href: string; rel: string }
interface PayPalWallet { email_address?: string }
interface SetupToken {
  id: string;
  status: string;
  customer?: { merchant_customer_id?: string };
  payment_source?: { paypal?: PayPalWallet };
  links?: PayPalLink[];
}
interface PaymentToken { id: string; payment_source?: { paypal?: PayPalWallet } }
interface PayPalCapture { id: string; status: string; amount?: { currency_code: string; value: string }; custom_id?: string }
interface PayPalOrder { id: string; status: string; purchase_units?: { payments?: { captures?: PayPalCapture[] } }[] }

/** Billing model of the saved PayPal: charged when the balance runs low, amount and timing vary. */
const USAGE_PATTERN = "UNSCHEDULED_PREPAID";

/**
 * `POST /v3/vault/setup-tokens` for the payer's PayPal account. The account id goes in
 * `customer.merchant_customer_id`, so the approved token can be checked against the cookie later.
 */
export async function createVaultSetupToken(input: { accountId: string; returnUrl: string; cancelUrl: string }): Promise<{ approveUrl: string }> {
  const token = await paypalFetch<SetupToken>("/v3/vault/setup-tokens", {
    method: "POST",
    requestId: `vault-setup-${randomUUID()}`,
    body: {
      customer: { merchant_customer_id: input.accountId },
      payment_source: {
        paypal: {
          description: "Automatic top-ups of your Tender credits",
          usage_pattern: USAGE_PATTERN,
          usage_type: "MERCHANT",
          customer_type: "CONSUMER",
          permit_multiple_payment_tokens: false,
          experience_context: {
            brand_name: "Tender",
            shipping_preference: "NO_SHIPPING",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    },
  });
  const approveUrl = token.links?.find((link) => link.rel === "approve")?.href;
  if (!approveUrl) throw new PayPalError("PayPal returned no approve link", 502, undefined, { status: token.status });
  return { approveUrl };
}

/**
 * After the payer approves: checks that the setup token was made for this account and is approved,
 * exchanges it for a payment token (`POST /v3/vault/payment-tokens`, idempotent per setup token),
 * and saves that token on the account. Returns the payer email PayPal shows for it.
 */
export async function saveVaultedPayPal(input: { accountId: string; setupTokenId: string }): Promise<{ email: string | null }> {
  const setup = await paypalFetch<SetupToken>(`/v3/vault/setup-tokens/${encodeURIComponent(input.setupTokenId)}`);
  if (setup.customer?.merchant_customer_id !== input.accountId) throw new PayPalError("This PayPal approval belongs to another account", 403);
  if (setup.status !== "APPROVED" && setup.status !== "VAULTED") throw new PayPalError("Approve saving PayPal first", 409, undefined, { status: setup.status });
  const token = await paypalFetch<PaymentToken>("/v3/vault/payment-tokens", {
    method: "POST",
    requestId: `vault-token-${setup.id}`,
    body: { payment_source: { token: { id: setup.id, type: "SETUP_TOKEN" } } },
  });
  const email = token.payment_source?.paypal?.email_address ?? setup.payment_source?.paypal?.email_address ?? null;
  const replaced = await saveVault(input.accountId, { vaultId: token.id, email });
  if (replaced) await deletePaymentToken(replaced).catch((error: unknown) => logError("Could not delete the replaced PayPal token", error));
  return { email };
}

/** `DELETE /v3/vault/payment-tokens/{id}`. A token PayPal no longer has counts as deleted. */
async function deletePaymentToken(vaultId: string): Promise<void> {
  try {
    await paypalFetch<void>(`/v3/vault/payment-tokens/${encodeURIComponent(vaultId)}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof PayPalError && error.status === 404)) throw error;
  }
}

/** Deletes the saved PayPal at PayPal, then from the account. False when none was saved. */
export async function removeVaultedPayPal(accountId: string): Promise<boolean> {
  const vaultId = await savedVaultId(accountId);
  if (!vaultId) return false;
  await deletePaymentToken(vaultId);
  await clearVault(accountId, vaultId);
  return true;
}

function logError(message: string, error: unknown): void {
  console.error(message, error instanceof PayPalError ? { status: error.status, debugId: error.debugId } : error instanceof Error ? { name: error.name, message: error.message } : {});
}

export type VaultedTopUp =
  | {
      status: "COMPLETED" | "PENDING";
      amountMicros: number;
      orderId: string;
      captureId: string | null;
      balanceMicros: number;
      weeklyCapMicros: number;
      topUpsThisWeekMicros: number;
    }
  | { status: "REFUSED"; reason: AgentTopUpRefusal; weeklyCapMicros: number | null; topUpsThisWeekMicros: number; balanceMicros: number };

const firstCapture = (order: PayPalOrder) => order.purchase_units?.[0]?.payments?.captures?.[0];

/**
 * Charges the saved PayPal with no buyer interaction and credits the capture once. The ledger
 * reserves the top-up first (saved PayPal, approved weekly limit, agent top-ups this week within
 * it); see `reserveAgentTopUp`. The order is created with `payment_source.paypal.vault_id` and a
 * merchant-initiated stored credential, which PayPal captures in the same call (intent CAPTURE).
 * The reservation id is the `PayPal-Request-Id`, so a retried call cannot charge twice.
 */
export async function createVaultedTopUp(input: {
  accountId: string;
  amountMicros: number;
  actor: "agent";
  belowMicros?: number;
}): Promise<VaultedTopUp> {
  const reservation = await reserveAgentTopUp(input.accountId, { amountMicros: input.amountMicros, belowMicros: input.belowMicros });
  if (!reservation.ok) {
    const { reason, weeklyCapMicros, topUpsThisWeekMicros, balanceMicros } = reservation;
    return { status: "REFUSED", reason, weeklyCapMicros, topUpsThisWeekMicros, balanceMicros };
  }
  const { id, amountMicros, vaultId, weeklyCapMicros, topUpsThisWeekMicros } = reservation;
  let order: PayPalOrder;
  try {
    order = await paypalFetch<PayPalOrder>("/v2/checkout/orders", {
      method: "POST",
      requestId: id,
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: "credits",
          custom_id: input.accountId,
          description: "Tender credits, automatic top-up",
          amount: { currency_code: "USD", value: microsToUsd(amountMicros) },
        }],
        payment_source: {
          paypal: {
            vault_id: vaultId,
            stored_credential: { payment_initiator: "MERCHANT", usage: "SUBSEQUENT", usage_pattern: USAGE_PATTERN },
          },
        },
      },
    });
  } catch (error) {
    await failAutoTopUp(id);
    throw error;
  }
  await attachAutoTopUpOrder({ id, accountId: input.accountId, orderId: order.id, amountMicros, actor: input.actor });

  const capture = firstCapture(order);
  if (capture?.status === "COMPLETED") await creditCapture(order.id, capture);
  else if (!capture || capture.status === "DECLINED" || capture.status === "FAILED") {
    await failAutoTopUp(id);
    throw new PayPalError(`PayPal did not pay the automatic top-up (${capture?.status ?? order.status})`, 402, undefined, { order_id: order.id });
  }
  // A PENDING capture is credited by the webhook when PayPal completes it.
  const balanceMicros = (await getAccount(input.accountId))?.balanceMicros ?? 0;
  return {
    status: capture.status === "COMPLETED" ? "COMPLETED" : "PENDING",
    amountMicros,
    orderId: order.id,
    captureId: capture.id,
    balanceMicros,
    weeklyCapMicros,
    topUpsThisWeekMicros,
  };
}

/**
 * The automatic top-up before an agent charge: when the balance is below $1.00 or below the next
 * charge, add $5.00 (or what the weekly limit leaves) from the saved PayPal.
 */
export function topUpBeforeAgentCharge(accountId: string, nextChargeMicros: number): Promise<VaultedTopUp> {
  return createVaultedTopUp({ accountId, amountMicros: AUTO_TOP_UP_MICROS, actor: "agent", belowMicros: lowBalanceThreshold(nextChargeMicros) });
}
