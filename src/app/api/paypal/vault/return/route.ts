import { accountIdFromCookie } from "@/lib/ledger";
import { PayPalError } from "@/lib/paypal/client";
import { saveVaultedPayPal } from "@/lib/paypal/vault";

/** `postMessage` type the PayPal window sends to Tender when saving finishes. */
const MESSAGE_TYPE = "tender-paypal-vault";

/**
 * Tells the opener how saving ended and closes the PayPal window. Opened as a full page, it goes
 * to the account page instead.
 */
function finish(error: string | null): Response {
  const message = JSON.stringify({ type: MESSAGE_TYPE, error }).replace(/</g, "\\u003c");
  const script = `if (window.opener) { window.opener.postMessage(${message}, location.origin); window.close(); } else location.replace("/account");`;
  return new Response(`<!doctype html><meta charset="utf-8"><title>Tender</title><script>${script}</script>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

/**
 * PayPal sends the payer here after approving "save PayPal" (`?approval_token_id=<setup token>`).
 * Saves the payment token on the cookie account, then closes the PayPal window.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const setupTokenId = url.searchParams.get("approval_token_id");
  const accountId = accountIdFromCookie(request);
  if (url.searchParams.has("cancel") || !setupTokenId || !accountId) return finish(null);
  try {
    await saveVaultedPayPal({ accountId, setupTokenId });
    return finish(null);
  } catch (error) {
    console.error("Saving PayPal failed", error instanceof PayPalError ? { status: error.status, debugId: error.debugId } : { name: error instanceof Error ? error.name : "UnknownError" });
    if (!(error instanceof PayPalError)) return finish("PayPal did not answer. Try again.");
    return finish(`PayPal was not saved: ${error.message}${error.debugId ? ` (debug id ${error.debugId})` : ""}`);
  }
}
