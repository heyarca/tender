import { accountError, accountJson, readAccount, requireJson } from "@/lib/ledger/http";
import { paypalErrorResponse } from "@/lib/paypal/http";
import { captureTopUpOrder } from "@/lib/paypal/orders";

/** Captures an approved top-up order and credits it when PayPal completes the capture. */
export async function POST(request: Request, context: RouteContext<"/api/paypal/orders/[id]/capture">) {
  const unsupported = requireJson(request);
  if (unsupported) return unsupported;
  const { id } = await context.params;
  if (!/^[A-Z0-9]{5,40}$/.test(id)) return accountError(404, "order_not_found", "Order not found");
  const account = await readAccount(request);
  if (account instanceof Response) return account;
  if (!account) return accountError(404, "order_not_found", "Order not found");
  try {
    return accountJson(await captureTopUpOrder({ orderId: id, accountId: account.accountId }));
  } catch (error) {
    return paypalErrorResponse(error);
  }
}
