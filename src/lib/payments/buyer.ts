import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { PREFERENCES } from "@/lib/tender";
import { isMarketId, MARKETS } from "@/lib/tender/fixtures";
import { parsePaymentConditions } from "./conditions";
import type { PaymentRequirements } from "@x402/core/types";
import { EXPLORER_URL, PAYMENT_NETWORK, USDC_ADDRESS } from "./config";
import { assertSafePayment } from "./limits";
import { settlementAmounts } from "./quote";
import { getPayerAccount } from "./wallet";
import type { PaidRequestInput, PaidRequestResult, PaidResponsePayload, PaymentPolicy, PaidRequestProgress } from "./types";

export function parsePaidRequestInput(value: unknown): PaidRequestInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["market", "policy", "conditions"].includes(key))) throw new Error("Unknown request field");
  if (!isMarketId(body.market)) throw new Error("Unknown market");
  const conditions = parsePaymentConditions(body.market, body.conditions);
  if (body.policy === undefined) return { market: body.market, ...(conditions ? { conditions } : {}) };
  if (!body.policy || typeof body.policy !== "object" || Array.isArray(body.policy)) throw new Error("Invalid routing policy");
  const policy = body.policy as Record<string, unknown>;
  const numericKeys = ["maxPrice", "maxP95LatencyMs", "maxDataAgeMs", "minSuccessRate"];
  if (Object.keys(policy).some((key) => ![...numericKeys, "preference", "mode"].includes(key))) throw new Error("Unknown policy field");
  for (const key of numericKeys) {
    const value = policy[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (key === "minSuccessRate" && value > 1))) throw new Error(`Invalid policy ${key}`);
  }
  if (policy.preference !== undefined && !(PREFERENCES as readonly string[]).includes(String(policy.preference))) throw new Error("Invalid policy preference");
  if (policy.mode !== undefined) {
    const mode = policy.mode as Record<string, unknown>;
    if (!mode || typeof mode !== "object" || Array.isArray(mode) || !["auto", "pinned"].includes(String(mode.kind)) || Object.keys(mode).some((key) => !["kind", "providerId"].includes(key)) || (mode.kind === "pinned" && (typeof mode.providerId !== "string" || !/^[a-z-]{1,40}$/.test(mode.providerId)))) throw new Error("Invalid routing mode");
  }
  return { market: body.market, policy: policy as PaymentPolicy, ...(conditions ? { conditions } : {}) };
}

/** Caller controls the base URL, never derive it from an incoming Host header. */
export function contractUrl(baseUrl: string, input: PaidRequestInput): URL {
  const url = new URL(MARKETS[input.market].units.dataAge === "min" ? "/api/v1/weather/current" : "/api/v1/prices/spot", baseUrl);
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
export async function performPaidRequest(url: URL, transport: typeof fetch = fetch, callerSignal?: AbortSignal, onProgress?: (event: PaidRequestProgress) => void): Promise<PaidRequestResult> {
  const deadline = AbortSignal.timeout(75_000);
  const signal = callerSignal ? AbortSignal.any([deadline, callerSignal]) : deadline;
  signal.throwIfAborted();
  const account = getPayerAccount();
  let selected: PaymentRequirements | undefined;
  const client = x402Client.fromConfig({
    schemes: [{ network: PAYMENT_NETWORK, client: new ExactEvmScheme(account) }],
    spendControls: { maxAmountPerPayment: "$0.000100", allowedAssets: [{ network: PAYMENT_NETWORK, asset: USDC_ADDRESS, maxAmountPerPayment: "100" }] },
  }).onBeforePaymentCreation(async ({ selectedRequirements }) => {
    signal.throwIfAborted();
    assertSafePayment(selectedRequirements);
    const exact = selectedRequirements.extra.price_usd;
    if (typeof exact !== "number" || settlementAmounts(exact).settled_atomic !== selectedRequirements.amount) throw new Error("Invalid settlement quote");
    selected = selectedRequirements;
  });
  let challengeEmitted = false;
  let signedEmitted = false;
  const checkedTransport: typeof fetch = async (input, init) => {
    signal.throwIfAborted();
    const requestHeaders = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!signedEmitted && requestHeaders.has("PAYMENT-SIGNATURE")) {
      signedEmitted = true;
      onProgress?.({ type: "signed" });
    }
    // Keep the authoritative deadline/cancellation signal across SDK Request
    // clones instead of relying on their weakly retained abort followers.
    const result = await transport(input, { ...init, signal });
    const requiredHeader = result.headers.get("PAYMENT-REQUIRED");
    if (result.status === 402 && requiredHeader) {
      const required = decodePaymentRequiredHeader(requiredHeader);
      if (required.accepts.length === 1) {
        const requirement = required.accepts[0];
        assertSafePayment(requirement);
        if (!challengeEmitted) {
          challengeEmitted = true;
          onProgress?.({ type: "payment-required", providerId: String(requirement.extra.providerId), payTo: requirement.payTo, settled_atomic: requirement.amount });
        }
      }
    }
    return result;
  };
  const paidFetch = wrapFetchWithPayment(checkedTransport, client);
  const response = await paidFetch(url, { headers: { Accept: "application/json" }, redirect: "error", cache: "no-store", signal });
  let body: unknown;
  try { body = await response.json(); } catch {
    throw new PaidRequestError("Payment service returned an unreadable response. Check balances before trying again.", response.ok ? 502 : response.status);
  }
  const header = response.headers.get("PAYMENT-RESPONSE");
  if (!response.ok) {
    const failed = header ? decodePaymentResponseHeader(header) : undefined;
    throw new PaidRequestError("Paid request did not complete; inspect the response before trying again", response.status, {
      response: body,
      ...(failed ? { settlement: { success: failed.success, errorReason: failed.errorReason, txHash: failed.transaction, network: failed.network } } : {}),
    });
  }
  if (!header || !selected) throw new PaidRequestError("No settlement receipt returned", 502);
  const settlement = decodePaymentResponseHeader(header);
  if (!settlement.success || settlement.network !== PAYMENT_NETWORK || !/^0x[0-9a-fA-F]{64}$/.test(settlement.transaction) || settlement.payer?.toLowerCase() !== account.address.toLowerCase()) throw new PaidRequestError("Invalid settlement receipt", 502);
  const providerId = String(selected.extra.providerId);
  if (response.headers.get("Tender-Provider") !== providerId) throw new PaidRequestError("Provider changed during payment", 502);
  if (settlement.amount !== undefined && settlement.amount !== selected.amount) throw new PaidRequestError("Settlement amount differs from quote", 502);
  const amounts = settlementAmounts(Number(selected.extra.price_usd));
  const payload = body as PaidResponsePayload;
  if (!payload || typeof payload !== "object" || payload.provider !== providerId || typeof payload.latency_ms !== "number" || typeof payload.data_age_ms !== "number") throw new PaidRequestError("Invalid paid response payload", 502, { txHash: settlement.transaction });
  const provider = Object.values(MARKETS).flatMap((market) => market.providers).find((provider) => provider.id === providerId);
  return {
    response: payload,
    receipt: {
      ...amounts,
      txHash: settlement.transaction,
      amountUsd: amounts.settled_usd,
      amountAtomic: selected.amount,
      asset: "USDC", payer: account.address, payTo: selected.payTo, providerId,
      providerName: provider?.name ?? providerId, latency_ms: payload.latency_ms, data_age_ms: payload.data_age_ms,
      network: "base-sepolia", explorerUrl: `${EXPLORER_URL}/tx/${settlement.transaction}`,
    },
  };
}
