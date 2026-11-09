import { contractUrl, parsePaidRequestInput, PaidRequestError, performPaidRequest } from "./buyer";
import { paymentRateLimiter, PaymentSafetyError } from "./limits";
import { getPayerAccount } from "./wallet";
import type { PaymentMarket, PaidRequestEvent, PaidRequestProgress } from "./types";
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
    const failureEvent = (error: unknown): Extract<PaidRequestEvent, { type: "error" }> => {
      if (error instanceof PaymentSafetyError) return { type: "error", error: error.message, status: 422 };
      if (error instanceof PaidRequestError) return { type: "error", error: error.message, details: error.details, status: error.status };
      return { type: "error", error: "Payment request failed. Check balances before trying again.", status: 502 };
    };
    const execute = async (signal: AbortSignal, onProgress?: (event: PaidRequestProgress) => void) => {
      const url = contractUrl("https://tender.internal", input);
      const transport: typeof fetch = async (target, init) => {
        const contractRequest = new Request(target, init);
        contractRequest.signal.throwIfAborted();
        if (contractRequest.url !== url.href || contractRequest.method !== "GET") throw new Error("Unexpected payment target");
        return handleContract(contractRequest, input.market, { conditions: input.conditions });
      };
      return performPaidRequest(url, transport, signal, onProgress);
    };
    const acceptsStream = request.headers.get("Accept")?.split(",").some((part) => {
      const [mediaType, ...parameters] = part.trim().split(";");
      const qualityParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith("q="));
      const quality = qualityParameter ? Number(qualityParameter.split("=")[1]) : 1;
      return mediaType.trim().toLowerCase() === "application/x-ndjson" && Number.isFinite(quality) && quality > 0 && quality <= 1;
    });
    if (acceptsStream) {
      const cancelled = new AbortController();
      const signal = AbortSignal.any([request.signal, cancelled.signal]);
      const encoder = new TextEncoder();
      let closed = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = (event: PaidRequestEvent) => {
            if (closed) return;
            try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { closed = true; }
          };
          void execute(signal, emit).then((result) => emit({ type: "result", result })).catch((error: unknown) => emit(failureEvent(error))).finally(() => {
            // A disconnected client must not unlock a still-running settlement.
            release();
            if (!closed) { closed = true; controller.close(); }
          });
        },
        cancel() { closed = true; cancelled.abort(); },
      });
      return new Response(stream, { headers: { ...headers, "Content-Type": "application/x-ndjson", "X-Content-Type-Options": "nosniff" } });
    }
    try {
      return Response.json(await execute(request.signal), { headers });
    } catch (error) {
      const { status, error: message, details } = failureEvent(error);
      return Response.json({ error: message, ...(details === undefined ? {} : { details }) }, { status, headers });
    } finally { release(); }
  };
}
