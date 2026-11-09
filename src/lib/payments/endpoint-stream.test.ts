import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createPaidRequestEndpoint } from "./endpoint";
import { createPaymentServer, withX402Payment } from "./server";
import { quoteFromBid } from "./quote";
import { PAYMENT_NETWORK } from "./config";
import { paymentRateLimiter } from "./limits";

const key = `0x${"0".repeat(63)}1` as const;
const payer = privateKeyToAccount(key).address;
beforeEach(() => vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", key));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const request = () => new Request("https://tender.test/pay", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: '{"market":"btc-usd"}' });
const settlement = { success: true, transaction: `0x${"a".repeat(64)}`, network: PAYMENT_NETWORK, payer };
function setup(settle = vi.fn(async () => settlement)) {
  const facilitator = { getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: PAYMENT_NETWORK }], extensions: [], signers: {} }), verify: vi.fn(async () => ({ isValid: true, payer })), settle };
  const server = createPaymentServer(facilitator);
  const route = withX402Payment((_request, quote) => Response.json({ provider: quote.providerId, latency_ms: 80, data_age_ms: 200 }), () => quoteFromBid("parasail", 0.7, "Bitcoin"), server);
  return { endpoint: createPaidRequestEndpoint((request) => route(request)), facilitator };
}
describe("payment event stream", () => {
  it("streams a genuine challenge then signed retry then settled result", async () => {
    const { endpoint, facilitator } = setup();
    const response = await endpoint(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/x-ndjson");
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(events.map((event) => event.type)).toEqual(["payment-required", "signed", "result"]);
    expect(events[0]).toMatchObject({ providerId: "parasail", settled_atomic: "1" });
    expect(events[2].result.receipt.txHash).toBe(settlement.transaction);
    expect(facilitator.verify).toHaveBeenCalledOnce();
    expect(facilitator.settle).toHaveBeenCalledOnce();
  });
  it("streams routing failures with their original status and details", async () => {
    const endpoint = createPaidRequestEndpoint(async () => Response.json({ error: { code: "no_eligible_provider" } }, { status: 409 }));
    const response = await endpoint(request());
    const event = JSON.parse((await response.text()).trim());
    expect(event).toMatchObject({ type: "error", status: 409, details: { response: { error: { code: "no_eligible_provider" } } } });
  });
  it("leaves pre-stream rejection statuses and Retry-After intact", async () => {
    vi.spyOn(paymentRateLimiter, "acquire").mockReturnValue(null);
    const { endpoint } = setup();
    const response = await endpoint(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });
  it("does not release the payer lock when a stream is cancelled during settlement", async () => {
    let finish!: (value: typeof settlement) => void;
    const settle = vi.fn(() => new Promise<typeof settlement>((resolve) => { finish = resolve; }));
    const { endpoint } = setup(settle);
    const response = await endpoint(request());
    const reader = response.body!.getReader();
    await vi.waitFor(() => expect(settle).toHaveBeenCalledOnce());
    await reader.cancel();
    expect(paymentRateLimiter.acquire()).toBeNull();
    finish(settlement);
    await vi.waitFor(() => { const release = paymentRateLimiter.acquire(); expect(release).not.toBeNull(); release!(); });
  });
});
