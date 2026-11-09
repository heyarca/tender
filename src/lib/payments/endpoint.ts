import { contractUrl, parsePaidRequestInput, PaidRequestError, performPaidRequest } from "./buyer";
import { paymentRateLimiter, PaymentSafetyError } from "./limits";
import { getPayerAccount } from "./wallet";
import type { PaymentMarket } from "./types";
import type { ContractOptions } from "@/lib/server/handlers";

type ContractHandler = (request: Request, market: PaymentMarket, options?: ContractOptions) => Promise<Response>;
const headers = { "Cache-Control": "private, no-store" };

/** The only transport targets are the two local contract handlers. No Host trust or SSRF. */
export function createPaidRequestEndpoint(handleContract: ContractHandler) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return Response.json({ error: "Use POST" }, { status: 405, headers });
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return Response.json({ error: "Send application/json" }, { status: 415, headers });
    }
    let input;
    try {
      // Bound streamed input as well as Content-Length. Never buffer an arbitrary body.
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (!reader) throw new Error("Empty request body");
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 8192) { await reader.cancel(); throw new Error("Request body exceeds 8192 bytes"); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      input = parsePaidRequestInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400, headers });
    }
    try { getPayerAccount(); } catch {
      return Response.json({ error: "Payer wallet is not configured" }, { status: 503, headers });
    }
    const release = paymentRateLimiter.acquire();
    if (!release) return Response.json({ error: "Payment request limit reached" }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    try {
      const url = contractUrl("https://tender.internal", input);
      const transport: typeof fetch = async (target, init) => {
        const contractRequest = new Request(target, init);
        contractRequest.signal.throwIfAborted();
        if (contractRequest.url !== url.href || contractRequest.method !== "GET") throw new Error("Unexpected payment target");
        return handleContract(contractRequest, input.market, { conditions: input.conditions });
      };
      const result = await performPaidRequest(url, transport, request.signal);
      return Response.json(result, { headers });
    } catch (error) {
      if (error instanceof PaymentSafetyError) return Response.json({ error: error.message }, { status: 422, headers });
      if (error instanceof PaidRequestError) return Response.json({ error: error.message, details: error.details }, { status: error.status, headers });
      // Do not expose wallet, signature or transport internals in errors.
      return Response.json({ error: "Payment request failed. Check balances before trying again." }, { status: 502, headers });
    } finally { release(); }
  };
}
