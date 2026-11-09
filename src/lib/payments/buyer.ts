import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import type { PaymentRequirements } from "@x402/core/types";
import { EXPLORER_URL, PAYMENT_NETWORK, USDC_ADDRESS } from "./config";
import { assertSafePayment } from "./limits";
import { settlementAmounts } from "./quote";
import { getPayerAccount } from "./wallet";
import type { PaidRequestInput, PaidRequestResult, PaymentPolicy } from "./types";

export function parsePaidRequestInput(value: unknown): PaidRequestInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["market", "policy"].includes(key))) throw new Error("Unknown request field");
  if (body.market !== "sf-weather" && body.market !== "btc-usd") throw new Error("Unknown market");
  if (body.policy === undefined) return { market: body.market };
  if (!body.policy || typeof body.policy !== "object" || Array.isArray(body.policy)) throw new Error("Invalid routing policy");
  const policy = body.policy as Record<string, unknown>;
  const numericKeys = ["maxPrice", "maxP95LatencyMs", "maxDataAgeMs", "minSuccessRate"];
  if (Object.keys(policy).some((key) => ![...numericKeys, "preference", "mode"].includes(key))) throw new Error("Unknown policy field");
  for (const key of numericKeys) {
    const value = policy[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (key === "minSuccessRate" && value > 1))) throw new Error(`Invalid policy ${key}`);
  }
  if (policy.preference !== undefined && !["lowest-cost", "lowest-latency", "freshest-data"].includes(String(policy.preference))) throw new Error("Invalid policy preference");
  if (policy.mode !== undefined) {
    const mode = policy.mode as Record<string, unknown>;
    if (!mode || typeof mode !== "object" || Array.isArray(mode) || !["auto", "pinned"].includes(String(mode.kind)) || Object.keys(mode).some((key) => !["kind", "providerId"].includes(key)) || (mode.kind === "pinned" && (typeof mode.providerId !== "string" || !/^[a-z-]{1,40}$/.test(mode.providerId)))) throw new Error("Invalid routing mode");
  }
  return { market: body.market, policy: policy as PaymentPolicy };
}

/** Caller controls the base URL, never derive it from an incoming Host header. */
export function contractUrl(baseUrl: string, input: PaidRequestInput): URL {
  const url = new URL(input.market === "sf-weather" ? "/api/v1/weather/current" : "/api/v1/prices/spot", baseUrl);
  const names = { maxPrice: "max_price", maxP95LatencyMs: "max_p95_ms", maxDataAgeMs: "max_data_age_ms", minSuccessRate: "min_success_rate", preference: "preference" } as const;
  for (const [key, name] of Object.entries(names)) {
    const value = input.policy?.[key as keyof typeof names];
    if (value !== undefined) url.searchParams.set(name, String(value));
  }
  if (input.policy?.mode?.kind === "pinned") url.searchParams.set("pin", input.policy.mode.providerId);
  return url;
}

export class PaidRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly details?: unknown) { super(message); }
}

/** Runs the actual x402 challenge/sign/retry flow using HTTP or a local route transport. No automatic re-payment. */
export async function performPaidRequest(url: URL, transport: typeof fetch = fetch): Promise<PaidRequestResult> {
  const account = getPayerAccount();
  let selected: PaymentRequirements | undefined;
  const client = x402Client.fromConfig({
    schemes: [{ network: PAYMENT_NETWORK, client: new ExactEvmScheme(account) }],
    spendControls: { maxAmountPerPayment: "$0.000100", allowedAssets: [{ network: PAYMENT_NETWORK, asset: USDC_ADDRESS, maxAmountPerPayment: "100" }] },
  }).onBeforePaymentCreation(async ({ selectedRequirements }) => {
    assertSafePayment(selectedRequirements);
    const exact = selectedRequirements.extra.price_usd;
    if (typeof exact !== "number" || settlementAmounts(exact).settled_atomic !== selectedRequirements.amount) throw new Error("Invalid settlement quote");
    selected = selectedRequirements;
  });
  const paidFetch = wrapFetchWithPayment(transport, client);
  const response = await paidFetch(url, { headers: { Accept: "application/json" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(75_000) });
  const body: unknown = await response.json();
  if (!response.ok) throw new PaidRequestError("Paid request did not complete; inspect the response before trying again", response.status, body);
  const header = response.headers.get("PAYMENT-RESPONSE");
  if (!header || !selected) throw new PaidRequestError("No settlement receipt returned", 502);
  const settlement = decodePaymentResponseHeader(header);
  if (!settlement.success || settlement.network !== PAYMENT_NETWORK || !/^0x[0-9a-fA-F]{64}$/.test(settlement.transaction) || settlement.payer?.toLowerCase() !== account.address.toLowerCase()) throw new PaidRequestError("Invalid settlement receipt", 502);
  const providerId = String(selected.extra.providerId);
  if (response.headers.get("Tender-Provider") !== providerId) throw new PaidRequestError("Provider changed during payment", 502);
  if (settlement.amount !== undefined && settlement.amount !== selected.amount) throw new PaidRequestError("Settlement amount differs from quote", 502);
  const amounts = settlementAmounts(Number(selected.extra.price_usd));
  return {
    response: body,
    receipt: {
      ...amounts,
      txHash: settlement.transaction,
      amountUsd: amounts.settled_usd,
      amountAtomic: selected.amount,
      asset: "USDC", payer: account.address, payTo: selected.payTo, providerId,
      network: "base-sepolia", explorerUrl: `${EXPLORER_URL}/tx/${settlement.transaction}`,
    },
  };
}
