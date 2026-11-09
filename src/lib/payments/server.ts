import { HTTPFacilitatorClient, type FacilitatorClient, type RouteConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_FACILITATOR_URL, PAYMENT_NETWORK, USDC_ADDRESS } from "./config";
import { validateQuote } from "./quote";
import type { PaymentQuote, SettlementAmounts, ValidatedPaymentQuote } from "./types";

export function createPaymentServer(facilitator?: FacilitatorClient): x402ResourceServer {
  return new x402ResourceServer(facilitator ?? new HTTPFacilitatorClient({
    url: process.env.TENDER_FACILITATOR_URL || DEFAULT_FACILITATOR_URL,
    timeoutMs: 20_000,
  })).register(PAYMENT_NETWORK, new ExactEvmScheme());
}

let server: x402ResourceServer | undefined;

export function paymentRouteConfig(quote: ValidatedPaymentQuote): RouteConfig {
  const amounts = {
    price_usd: quote.price_usd,
    settled_usd: quote.settled_usd,
    settled_atomic: quote.settled_atomic,
    ...(quote.settlement_note ? { settlement_note: quote.settlement_note } : {}),
  };
  return {
    accepts: {
      scheme: "exact",
      network: PAYMENT_NETWORK,
      payTo: quote.payTo,
      price: {
        asset: USDC_ADDRESS,
        amount: quote.settled_atomic,
        extra: { name: "USDC", version: "2", ...amounts, providerId: quote.providerId },
      },
      maxTimeoutSeconds: 60,
    },
    description: `${quote.description}. Bid $${quote.price_usd}; settlement $${quote.settled_usd} USDC (${quote.settled_atomic} atomic).${quote.settlement_note ? ` ${quote.settlement_note}.` : ""}`,
    mimeType: "application/json",
    unpaidResponseBody: async () => ({
      contentType: "application/json",
      body: { error: "payment_required", providerId: quote.providerId, payTo: quote.payTo, ...amounts },
    }),
  };
}

/** One quote per invocation, shared by the challenge, verification, handler and settlement. */
export function withX402Payment<T extends PaymentQuote>(
  handler: (request: Request, quote: T & SettlementAmounts) => Response | Promise<Response>,
  quote: (request: Request) => T | Promise<T>,
  paymentServer?: x402ResourceServer,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const selected = validateQuote(await quote(request));
    const resourceServer = paymentServer ?? (server ??= createPaymentServer());
    const paidHandler = withX402(async () => {
      const response = await handler(request, selected);
      return new NextResponse(response.body, { status: response.status, headers: response.headers });
    }, paymentRouteConfig(selected), resourceServer);
    // Next 16 Cache Components wraps Request in a proxy. Passing that proxy to
    // the native Request constructor fails its private-field brand check.
    const sdkRequest = new NextRequest(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: await request.clone().arrayBuffer() }),
    });
    const response = await paidHandler(sdkRequest);
    response.headers.set("Tender-Provider", selected.providerId);
    response.headers.set("Tender-Price-USD", String(selected.price_usd));
    response.headers.set("Tender-Settled-Atomic", selected.settled_atomic);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Tender-Provider, Tender-Price-USD, Tender-Settled-Atomic");
    return response;
  };
}

export { quoteFromBid } from "./quote";
export type { PaymentQuote, SettlementAmounts, ValidatedPaymentQuote } from "./types";
