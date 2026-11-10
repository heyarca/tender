import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { creditTopUp, getAccount, type Actor } from "@/lib/ledger";
import { ensureAccount, toNumber } from "@/lib/ledger/accounts";
import { PayPalError, paypalFetch } from "./client";

const MICROS_PER_CENT = 10_000;
/** Smallest and largest top-up per order. */
export const MIN_TOP_UP_MICROS = 1_000_000;
export const MAX_TOP_UP_MICROS = 100_000_000;

/** `"10.00"` -> 10_000_000 micro-USD, with integer math. Null for anything but a plain amount with up to two decimals. */
export function usdToMicros(value: string): number | null {
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return (Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"))) * MICROS_PER_CENT;
}

/** 10_000_000 micro-USD -> `"10.00"`. The amount must be whole cents. */
export function microsToUsd(micros: number): string {
  if (!Number.isSafeInteger(micros) || micros < 0 || micros % MICROS_PER_CENT !== 0) throw new Error("Amount must be whole cents");
  const cents = micros / MICROS_PER_CENT;
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

interface PayPalLink { href: string; rel: string; method?: string }
interface PayPalAmount { currency_code: string; value: string }
interface PayPalCapture { id: string; status: string; amount?: PayPalAmount; custom_id?: string }
interface PayPalOrder {
  id: string;
  status: string;
  links?: PayPalLink[];
  purchase_units?: { custom_id?: string; payments?: { captures?: PayPalCapture[] } }[];
}

/**
 * Creates an Orders v2 order (`intent: CAPTURE`, `custom_id` = account id) for a credits
 * top-up and records it. `returnUrl` sends a buyer who approves through `approveUrl` back to
 * Tender; the browser checkout does not need it.
 */
export async function createTopUpOrder(input: {
  accountId: string;
  amountMicros: number;
  actor: "user" | "agent";
  returnUrl?: string;
  cancelUrl?: string;
}): Promise<{ orderId: string; approveUrl: string }> {
  const { accountId, amountMicros, actor } = input;
  if (!Number.isSafeInteger(amountMicros) || amountMicros < MIN_TOP_UP_MICROS || amountMicros > MAX_TOP_UP_MICROS || amountMicros % MICROS_PER_CENT !== 0) {
    throw new PayPalError("Top-ups are $1.00 to $100.00 in whole cents", 400);
  }
  const order = await paypalFetch<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    requestId: `topup-${randomUUID()}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: "credits",
        custom_id: accountId,
        description: "Tender credits",
        amount: { currency_code: "USD", value: microsToUsd(amountMicros) },
      }],
      payment_source: { paypal: { experience_context: {
        brand_name: "Tender",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        ...(input.returnUrl ? { return_url: input.returnUrl, cancel_url: input.cancelUrl ?? input.returnUrl } : {}),
      } } },
    },
  });
  await ensureAccount(accountId);
  await sql.query(
    "insert into paypal_orders (id, account_id, amount_micros, status, actor) values ($1, $2, $3, 'CREATED', $4) on conflict (id) do nothing",
    [order.id, accountId, amountMicros, actor],
  );
  const approve = order.links?.find((link) => link.rel === "approve" || link.rel === "payer-action");
  return { orderId: order.id, approveUrl: approve?.href ?? "" };
}

interface StoredOrder { accountId: string; amountMicros: number; status: string; captureId: string | null; actor: Actor }

export async function getStoredOrder(orderId: string): Promise<StoredOrder | null> {
  const rows = (await sql.query("select account_id, amount_micros, status, capture_id, actor from paypal_orders where id = $1", [orderId])) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  return {
    accountId: String(row.account_id),
    amountMicros: toNumber(row.amount_micros),
    status: String(row.status),
    captureId: row.capture_id ? String(row.capture_id) : null,
    actor: String(row.actor) as Actor,
  };
}

/**
 * Credits a completed PayPal capture of a stored order, once per capture id. The account and
 * amount come from our order row; the capture must match them.
 */
export async function creditCapture(orderId: string, capture: { id: string; status: string; amount?: PayPalAmount; custom_id?: string }): Promise<{ credited: boolean; balanceMicros: number } | null> {
  const order = await getStoredOrder(orderId);
  if (!order || capture.status !== "COMPLETED") return null;
  const captured = capture.amount?.currency_code === "USD" ? usdToMicros(capture.amount.value) : null;
  if (captured !== order.amountMicros || (capture.custom_id && capture.custom_id !== order.accountId)) {
    throw new PayPalError("Captured amount does not match the order", 409);
  }
  return creditTopUp({ accountId: order.accountId, amountMicros: order.amountMicros, orderId, captureId: capture.id, actor: order.actor });
}

const firstCapture = (order: PayPalOrder) => order.purchase_units?.[0]?.payments?.captures?.[0];
const alreadyCaptured = (error: unknown) =>
  error instanceof PayPalError && error.status === 422 && JSON.stringify(error.details ?? "").includes("ORDER_ALREADY_CAPTURED");

/**
 * Captures an approved top-up order of this account and credits it right away when the
 * capture is COMPLETED (the webhook is the backup). Safe to call again: a captured order
 * returns its status and the current balance.
 */
export async function captureTopUpOrder(input: { orderId: string; accountId: string }): Promise<{ status: string; balanceMicros: number }> {
  const order = await getStoredOrder(input.orderId);
  if (!order || order.accountId !== input.accountId) throw new PayPalError("Order not found", 404);
  const balance = async () => (await getAccount(input.accountId))?.balanceMicros ?? 0;
  if (order.status === "COMPLETED") return { status: "COMPLETED", balanceMicros: await balance() };

  let result: PayPalOrder;
  try {
    result = await paypalFetch<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`, {
      method: "POST",
      body: {},
      requestId: `capture-${input.orderId}`,
    });
  } catch (error) {
    if (!alreadyCaptured(error)) throw error;
    result = await paypalFetch<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(input.orderId)}`);
  }
  const capture = firstCapture(result);
  if (!capture) throw new PayPalError("PayPal returned no capture", 502, undefined, { status: result.status });
  if (capture.status === "COMPLETED") {
    const credit = await creditCapture(input.orderId, capture);
    return { status: "COMPLETED", balanceMicros: credit?.balanceMicros ?? (await balance()) };
  }
  if (capture.status === "DECLINED" || capture.status === "FAILED") {
    await sql.query("update paypal_orders set status = 'FAILED', updated_at = now() where id = $1 and status <> 'COMPLETED'", [input.orderId]);
  }
  return { status: capture.status, balanceMicros: await balance() };
}
