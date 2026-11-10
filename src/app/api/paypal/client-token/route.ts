import { getClientToken, paypalSdkUrl } from "@/lib/paypal/client";
import { paypalErrorResponse } from "@/lib/paypal/http";
import { accountJson } from "@/lib/ledger/http";

/** Browser-safe JS SDK v6 client token and the SDK script URL. */
export async function POST() {
  try {
    const { clientToken, expiresIn } = await getClientToken();
    return accountJson({ clientToken, expiresIn, sdkUrl: paypalSdkUrl() });
  } catch (error) {
    return paypalErrorResponse(error);
  }
}
