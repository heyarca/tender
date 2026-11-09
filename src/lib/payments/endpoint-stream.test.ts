import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createPaidRequestEndpoint } from "./endpoint";
import { createPaymentServer, withX402Payment } from "./server";
import { quoteFromBid } from "./quote";
import { PAYMENT_NETWORK } from "./config";
import { paymentRateLimiter, PaymentRateLimiter } from "./limits";

const key = `0x${"0".repeat(63)}1` as const;
const payer = privateKeyToAccount(key).address;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
let released: ReturnType<typeof deferred<void>>;
beforeEach(() => {
  vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", key);
  const limiter = new PaymentRateLimiter();
  released = deferred<void>();
  vi.spyOn(paymentRateLimiter, "acquire").mockImplementation(() => {
    const release = limiter.acquire();
    if (!release) return null;
    return () => { release(); released.resolve(); };
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const request = () => new Request("https://tender.test/pay", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: '{"market":"btc-usd"}' });
const settlement = { success: true, transaction: `0x${"a".repeat(64)}`, network: PAYMENT_NETWORK, payer };
function setup(settle = vi.fn(async () => settlement)) {
  const facilitator = { getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: PAYMENT_NETWORK }], extensions: [], signers: {} }), verify: vi.fn(async () => ({ isValid: true, payer })), settle };
  const server = createPaymentServer(facilitator);
  const route = withX402Payment((_request, quote) => Response.json({ provider: quote.providerId, latency_ms: 80, data_age_ms: 200 }), () => quoteFromBid("the-zone-bio", 0.7, "Bitcoin"), server);
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
    expect(events[0]).toMatchObject({ providerId: "the-zone-bio", settled_atomic: "1" });
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
  it("honors an explicit refusal of the NDJSON representation", async () => {
    const endpoint = createPaidRequestEndpoint(async () => Response.json({ error: { code: "no_eligible_provider" } }, { status: 409 }));
    const req = request();
    req.headers.set("Accept", "application/json, application/x-ndjson;q=0");
    const response = await endpoint(req);
    expect(response.status).toBe(409);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });
  it("does not settle when cancelled during provider execution", async () => {
    const entered = deferred<Request>();
    const providerResult = deferred<Response>();
    const handler = vi.fn((request: Request) => {
      entered.resolve(request);
      return providerResult.promise;
    });
    const settle = vi.fn(async () => settlement);
    const server = createPaymentServer({ getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: PAYMENT_NETWORK }], extensions: [], signers: {} }), verify: async () => ({ isValid: true, payer }), settle });
    const route = withX402Payment(handler, () => quoteFromBid("the-zone-bio", 0.7, "Bitcoin"), server);
    const endpoint = createPaidRequestEndpoint((req) => route(req));
    const response = await endpoint(request());
    const providerRequest = await entered.promise;
    const aborted = deferred<void>();
    providerRequest.signal.addEventListener("abort", () => aborted.resolve(), { once: true });
    try {
      await response.body!.cancel();
      // Cancellation must reach the actual provider Request before it is released.
      expect(providerRequest.signal.aborted).toBe(true);
      await aborted.promise;
      expect(paymentRateLimiter.acquire()).toBeNull();
    } finally {
      providerResult.resolve(Response.json({ provider: "the-zone-bio", latency_ms: 80, data_age_ms: 200 }));
      await released.promise;
    }
    expect(handler).toHaveBeenCalledOnce();
    expect(settle).not.toHaveBeenCalled();
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
    const settlementStarted = deferred<void>();
    const settlementResult = deferred<typeof settlement>();
    const settle = vi.fn(() => {
      settlementStarted.resolve();
      return settlementResult.promise;
    });
    const { endpoint } = setup(settle);
    const response = await endpoint(request());
    const reader = response.body!.getReader();
    await settlementStarted.promise;
    // These events must be readable while settlement is still unresolved.
    const decoder = new TextDecoder();
    expect(JSON.parse(decoder.decode((await reader.read()).value)).type).toBe("payment-required");
    expect(JSON.parse(decoder.decode((await reader.read()).value)).type).toBe("signed");
    try {
      await reader.cancel();
      expect(paymentRateLimiter.acquire()).toBeNull();
    } finally {
      settlementResult.resolve(settlement);
      await released.promise;
    }
    expect(settle).toHaveBeenCalledOnce();
  });
});
