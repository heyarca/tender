import { paymentRateLimiter, PaymentRateLimiter } from "./limits";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createPaidRequestEndpoint } from "./endpoint";
import { createPaymentServer, withX402Payment } from "./server";
import { quoteFromBid } from "./quote";
import { PAYMENT_NETWORK, USDC_ADDRESS } from "./config";
import { PAYEES } from "./payees";
import { encodePaymentRequiredHeader } from "@x402/core/http";

// Publicly known test-only key. Never use for funded wallets.
const key = `0x${"0".repeat(63)}1` as const;
const payer = privateKeyToAccount(key).address;
beforeEach(() => {
  const limiter = new PaymentRateLimiter();
  vi.spyOn(paymentRateLimiter, "acquire").mockImplementation(() => limiter.acquire());
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("paid endpoint", () => {
  it("executes the actual x402 signed retry locally without trusting Host", async () => {
    vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", key);
    const facilitator = {
      getSupported: vi.fn(async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: PAYMENT_NETWORK }], extensions: [], signers: {} })),
      verify: vi.fn(async () => ({ isValid: true, payer })),
      settle: vi.fn(async () => ({ success: true, transaction: `0x${"a".repeat(64)}`, network: PAYMENT_NETWORK, payer })),
    };
    const route = withX402Payment((_request, quote) => Response.json({ provider: quote.providerId, latency_ms: 80, data_age_ms: 200 }), () => quoteFromBid("the-zone-bio", 0.7, "Bitcoin"), createPaymentServer(facilitator));
    const dispatch = vi.fn<(request: Request, market: string, options?: { conditions?: unknown }) => Promise<Response>>((request) => route(request));
    const endpoint = createPaidRequestEndpoint(dispatch);
    const response = await endpoint(new Request("https://evil.test/api/payments/demo-request", { method: "POST", headers: { "Content-Type": "application/json", Host: "evil.test" }, body: JSON.stringify({ market: "btc-usd", conditions: { "the-zone-bio": { bidPrice: 0.7 } } }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ response: { provider: "the-zone-bio" }, receipt: { txHash: `0x${"a".repeat(64)}`, payer, providerId: "the-zone-bio", price_usd: 0.0000007, settled_atomic: "1", amountAtomic: "1", network: "base-sepolia" } });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls.every(([, , options]) => options?.conditions && JSON.stringify(options.conditions) === JSON.stringify({ "the-zone-bio": { bidPrice: 0.7 } }))).toBe(true);
    expect(dispatch.mock.calls.every(([request]) => new URL(request.url).origin === "https://tender.internal")).toBe(true);
    expect(dispatch.mock.calls[1][0].headers.get("PAYMENT-SIGNATURE")).toBeTruthy();
    expect(facilitator.verify).toHaveBeenCalledOnce();
    expect(facilitator.settle).toHaveBeenCalledOnce();
    expect(facilitator.getSupported).toHaveBeenCalledOnce();
  });
  it("rejects bids above the spend cap with a clear error before signing", async () => {
    vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", key);
    const verify = vi.fn();
    const settle = vi.fn();
    const server = createPaymentServer({ getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: PAYMENT_NETWORK }], extensions: [], signers: {} }), verify, settle });
    const handler = vi.fn(() => Response.json({}));
    const route = withX402Payment(handler, () => quoteFromBid("together", 101, "Weather"), server);
    const dispatch = vi.fn((request: Request) => route(request));
    const endpoint = createPaidRequestEndpoint(dispatch);
    const response = await endpoint(new Request("https://tender.test/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"market":"sf-weather"}' }));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("100 atomic");
    expect(dispatch).toHaveBeenCalledOnce();
    expect(verify).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
  it("rejects invalid input, content types, and oversized bodies before dispatch", async () => {
    const dispatch = vi.fn();
    const endpoint = createPaidRequestEndpoint(dispatch);
    for (const [body, type, status] of [["{}", "text/plain", 415], ["{}", "application/json", 400], ["x".repeat(8193), "application/json", 400]] as const) {
      const response = await endpoint(new Request("https://tender.test/api/payments/demo-request", { method: "POST", headers: { "Content-Type": type }, body }));
      expect(response.status).toBe(status);
    }
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("never dispatches or signs after an already-aborted payment deadline", async () => {
    vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", key);
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    const dispatch = vi.fn();
    const endpoint = createPaidRequestEndpoint(dispatch);
    const response = await endpoint(new Request("https://tender.test/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"market":"btc-usd"}' }));
    expect(response.status).toBe(502);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("answers 422, not 502, when a 402 challenge names an unknown provider", async () => {
    vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", key);
    const requirements = { scheme: "exact", network: PAYMENT_NETWORK, asset: USDC_ADDRESS, amount: "1", payTo: PAYEES.together, maxTimeoutSeconds: 60, extra: { providerId: "nosuch" } };
    const challenge = encodePaymentRequiredHeader({ x402Version: 2, resource: { url: "https://tender.internal/api/v1/prices/spot" }, accepts: [requirements] });
    const dispatch = vi.fn(async () => new Response("payment required", { status: 402, headers: { "PAYMENT-REQUIRED": challenge } }));
    const endpoint = createPaidRequestEndpoint(dispatch);
    const response = await endpoint(new Request("https://tender.test/api/payments/demo-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"market":"btc-usd"}' }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Untrusted payment recipient" });
    expect(dispatch).toHaveBeenCalledOnce();
  });
  it("returns 503 when payer is absent", async () => {
    vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", "");
    const endpoint = createPaidRequestEndpoint(vi.fn());
    const response = await endpoint(new Request("https://tender.test/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"market":"btc-usd"}' }));
    expect(response.status).toBe(503);
  });
});
