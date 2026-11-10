import { accountError, accountJson, readJsonObject, requireJson, writeAccount } from "@/lib/ledger/http";
import { paypalErrorResponse } from "@/lib/paypal/http";
import { createTopUpOrder, MAX_TOP_UP_MICROS, MIN_TOP_UP_MICROS, usdToMicros } from "@/lib/paypal/orders";

/** `{ amountUsd }` -> a PayPal order for a credits top-up -> `{ orderId }`. */
export async function POST(request: Request) {
  const unsupported = requireJson(request);
  if (unsupported) return unsupported;
  let amountMicros: number | null;
  try {
    const { amountUsd } = await readJsonObject(request);
    amountMicros = typeof amountUsd === "string" || typeof amountUsd === "number" ? usdToMicros(String(amountUsd)) : null;
  } catch {
    amountMicros = null;
  }
  if (amountMicros === null) return accountError(400, "invalid_amount", "Send amountUsd, for example \"10.00\"");
  if (amountMicros < MIN_TOP_UP_MICROS || amountMicros > MAX_TOP_UP_MICROS) {
    return accountError(400, "invalid_amount", "Top-ups are $1.00 to $100.00");
  }
  const account = await writeAccount(request);
  if (account instanceof Response) return account;
  try {
    const { orderId } = await createTopUpOrder({ accountId: account.accountId, amountMicros, actor: "user" });
    return accountJson({ orderId }, 201, account.setCookie);
  } catch (error) {
    return paypalErrorResponse(error);
  }
}
