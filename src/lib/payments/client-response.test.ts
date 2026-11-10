import { describe, expect, it, vi } from "vitest";
import { PaymentResponseError, readPaidResponse } from "./client-response";

const result = { response: { provider: "fernline", latency_ms: 20, data_age_ms: 10 }, receipt: { txHash: `0x${"a".repeat(64)}`, providerId: "fernline" } };
function stream(chunks: string[]) {
  return new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); } }), { headers: { "Content-Type": "application/x-ndjson" } });
}
describe("payment response parsing", () => {
  it("reads actual ordered progress across arbitrary chunk boundaries", async () => {
    const progress = vi.fn();
    const text = [JSON.stringify({ type: "payment-required", providerId: "fernline", payTo: "0x1", settled_atomic: "18" }), JSON.stringify({ type: "signed" }), JSON.stringify({ type: "result", result })].join("\n") + "\n";
    expect(await readPaidResponse(stream([text.slice(0, 13), text.slice(13, 90), text.slice(90)]), progress)).toEqual(result);
    expect(progress.mock.calls.map(([event]) => event.type)).toEqual(["payment-required", "signed"]);
  });
  it("keeps HTTP status and Retry-After for pre-stream limits", async () => {
    await expect(readPaidResponse(Response.json({ error: "Payment request limit reached" }, { status: 429, headers: { "Retry-After": "60" } }), vi.fn())).rejects.toMatchObject({ failure: { status: 429, retryAfterSeconds: 60, message: "Payment request limit reached" } });
  });
  it("keeps streamed error status and provider details", async () => {
    const details = { response: { error: { code: "no_eligible_provider" } } };
    await expect(readPaidResponse(stream([JSON.stringify({ type: "error", status: 409, error: "No eligible provider", details }) + "\n"]), vi.fn())).rejects.toMatchObject({ failure: { status: 409, details } });
  });
  it("handles non-JSON infrastructure pages without losing their status", async () => {
    await expect(readPaidResponse(new Response("<html>Unavailable</html>", { status: 503 }), vi.fn())).rejects.toMatchObject({ failure: { status: 503, message: "Payment service returned an unreadable response" } });
  });
  it("does not mark an interrupted or malformed stream complete", async () => {
    await expect(readPaidResponse(stream(['{"type":"signed"}\n']), vi.fn())).rejects.toThrow("without a receipt");
    await expect(readPaidResponse(stream(['not-json\n']), vi.fn())).rejects.toBeInstanceOf(PaymentResponseError);
  });
  it("remains compatible with successful JSON replies", async () => {
    expect(await readPaidResponse(Response.json(result), vi.fn())).toEqual(result);
  });
});
