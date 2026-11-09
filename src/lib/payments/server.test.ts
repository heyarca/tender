import { describe, expect, it, vi } from "vitest";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import type { FacilitatorClient } from "@x402/core/server";
import type { PaymentPayload } from "@x402/core/types";
import { createPaymentServer, withX402Payment } from "./server";
import { quoteFromBid } from "./quote";
import { PAYMENT_NETWORK } from "./config";

export function testFacilitator() {
  return {
    getSupported: vi.fn(async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: PAYMENT_NETWORK }], extensions: [], signers: {} })),
    verify: vi.fn(async () => ({ isValid: true, payer: "0x0000000000000000000000000000000000000001" })),
    settle: vi.fn(async () => ({ success: true, transaction: `0x${"a".repeat(64)}`, network: PAYMENT_NETWORK, payer: "0x0000000000000000000000000000000000000001" })),
  } satisfies FacilitatorClient;
}

async function paidRequest(route: (request: Request) => Promise<Response>) {
  const challenge = await route(new Request("https://tender.test/api/contract"));
  const required = decodePaymentRequiredHeader(challenge.headers.get("PAYMENT-REQUIRED")!);
  const payload: PaymentPayload = { x402Version: 2, accepted: required.accepts[0], payload: {} };
  return route(new Request("https://tender.test/api/contract", { headers: { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) } }));
}

describe("x402 route wrapper", () => {
  it("returns a real SDK v2 402 with exact and rounded amounts, without serving data", async () => {
    const handler = vi.fn(() => Response.json({ protected: true }));
    const quote = vi.fn(() => quoteFromBid("the-zone-bio", 0.7, "Tender Bitcoin price"));
    const route = withX402Payment(handler, quote, createPaymentServer(testFacilitator()));
    const response = await route(new Request("https://tender.test/any-path"));
    expect(response.status).toBe(402);
    expect(handler).not.toHaveBeenCalled();
    expect(quote).toHaveBeenCalledTimes(1);
    expect(response.headers.get("Tender-Provider")).toBe("the-zone-bio");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const challenge = decodePaymentRequiredHeader(response.headers.get("PAYMENT-REQUIRED")!);
    expect(challenge).toMatchObject({ x402Version: 2, accepts: [{ scheme: "exact", network: PAYMENT_NETWORK, amount: "1", extra: { price_usd: 0.0000007, settled_atomic: "1", settled_usd: 0.000001 } }] });
    expect(challenge.resource.description).toContain("Rounded up");
    expect(await response.json()).toMatchObject({ error: "payment_required", price_usd: 0.0000007, settled_atomic: "1" });
  });
  it("settles only successful responses and passes the same enriched selection", async () => {
    const facilitator = testFacilitator();
    const quote = vi.fn(() => ({ ...quoteFromBid("together", 18, "Weather"), context: { selected: "together" } }));
    const handler = vi.fn((_req: Request, selected: ReturnType<typeof quote>) => Response.json(selected));
    const response = await paidRequest(withX402Payment(handler, quote, createPaymentServer(facilitator)));
    expect(response.status).toBe(200);
    expect(response.headers.get("PAYMENT-RESPONSE")).toBeTruthy();
    expect(facilitator.settle).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ context: { selected: "together" }, settled_atomic: "18" });
    expect(quote).toHaveBeenCalledTimes(2); // one call for each HTTP request
    expect(handler).toHaveBeenCalledOnce();
  });
  it("does not settle failed provider responses", async () => {
    const facilitator = testFacilitator();
    const response = await paidRequest(withX402Payment(() => Response.json({ error: "unavailable" }, { status: 503 }), () => quoteFromBid("together", 18, "Weather"), createPaymentServer(facilitator)));
    expect(response.status).toBe(503);
    expect(facilitator.verify).toHaveBeenCalledOnce();
    expect(facilitator.settle).not.toHaveBeenCalled();
  });
  it("fails closed on invalid payments", async () => {
    const facilitator = testFacilitator();
    facilitator.verify.mockResolvedValue({ isValid: false, payer: "" });
    const handler = vi.fn(() => Response.json({ protected: true }));
    const response = await paidRequest(withX402Payment(handler, () => quoteFromBid("together", 18, "Weather"), createPaymentServer(facilitator)));
    expect(response.status).toBe(402);
    expect(handler).not.toHaveBeenCalled();
    expect(facilitator.settle).not.toHaveBeenCalled();
  });
});
