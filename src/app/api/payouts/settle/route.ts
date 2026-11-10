import { settlePayouts } from "@/lib/paypal/payouts";

const headers = { "Cache-Control": "private, no-store" };
/** At most one settle per this interval on one server. */
const SETTLE_INTERVAL_MS = 30_000;

let lastSettleAt = 0;
let settling = false;

/** Pays unpaid provider earnings in one PayPal Payouts batch and returns the batch. */
export async function POST() {
  const waitMs = lastSettleAt + SETTLE_INTERVAL_MS - Date.now();
  if (settling || waitMs > 0) {
    const retryAfter = Math.max(1, Math.ceil(waitMs / 1000));
    return Response.json(
      { error: { code: "settle_too_soon", message: `A payout was just sent. Try again in ${retryAfter} s.` } },
      { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } },
    );
  }
  settling = true;
  try {
    const result = await settlePayouts();
    if (result.status === "nothing_to_pay") {
      return Response.json(
        { error: { code: "nothing_to_pay", message: "Nothing to pay. No connected provider has $0.01 or more in unpaid earnings." } },
        { status: 409, headers },
      );
    }
    lastSettleAt = Date.now();
    if (result.status === "rejected") {
      return Response.json(
        { error: { code: "paypal_rejected", message: `PayPal rejected the payout: ${result.message}. The earnings stay unpaid.` }, batch: result.batch },
        { status: 502, headers },
      );
    }
    return Response.json({ batch: result.batch }, { status: 201, headers });
  } catch {
    return Response.json({ error: { code: "settle_failed", message: "The payout could not be sent. Try again." } }, { status: 500, headers });
  } finally {
    settling = false;
  }
}
