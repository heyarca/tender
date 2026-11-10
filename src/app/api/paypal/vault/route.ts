import { accountIdFromCookie, cookieAccountForWrite, getAutopay, type Autopay } from "@/lib/ledger";
import { accountJson, requireJson } from "@/lib/ledger/http";
import { paypalErrorResponse } from "@/lib/paypal/http";
import { createVaultSetupToken, removeVaultedPayPal } from "@/lib/paypal/vault";

/** Automatic top-ups of the cookie account. The payment token itself never leaves the server. */
function autopayView(autopay: Autopay) {
  return {
    saved: autopay.savedPayPal !== null,
    email: autopay.savedPayPal?.email ?? null,
    weekly_cap_micros: autopay.weeklyCapMicros,
    top_ups_this_week_micros: autopay.topUpsThisWeekMicros,
  };
}

/** `GET /api/paypal/vault`: the saved PayPal, the weekly limit, and this week's automatic top-ups. */
export async function GET(request: Request) {
  const accountId = accountIdFromCookie(request);
  return accountJson(autopayView(accountId ? await getAutopay(accountId) : { savedPayPal: null, weeklyCapMicros: null, topUpsThisWeekMicros: 0 }));
}

/** `POST /api/paypal/vault`: starts saving PayPal for automatic top-ups -> `{ approve_url }` for a PayPal window. */
export async function POST(request: Request) {
  const notJson = requireJson(request);
  if (notJson) return notJson;
  const { accountId, setCookie } = cookieAccountForWrite(request);
  const origin = new URL(request.url).origin;
  try {
    const { approveUrl } = await createVaultSetupToken({
      accountId,
      returnUrl: `${origin}/api/paypal/vault/return`,
      cancelUrl: `${origin}/api/paypal/vault/return?cancel=1`,
    });
    return accountJson({ approve_url: approveUrl }, 201, setCookie);
  } catch (error) {
    return paypalErrorResponse(error);
  }
}

/** `DELETE /api/paypal/vault`: removes the saved PayPal. Ask Tender stops topping up by itself. */
export async function DELETE(request: Request) {
  const accountId = accountIdFromCookie(request);
  try {
    if (accountId) await removeVaultedPayPal(accountId);
    return accountJson(autopayView(accountId ? await getAutopay(accountId) : { savedPayPal: null, weeklyCapMicros: null, topUpsThisWeekMicros: 0 }));
  } catch (error) {
    return paypalErrorResponse(error);
  }
}
