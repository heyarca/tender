import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentQuote, SettlementAmounts } from "@/lib/payments/types";
import { getPayee } from "@/lib/payments/payees";
import type { ConditionsPatch } from "@/lib/tender";
const payments = vi.hoisted(() => ({ calls: [] as PaymentQuote[], fail: false, failureResponse: false, settleThrow: false }));
vi.mock("node:crypto", () => ({ randomUUID: () => "84d53c30-6de2-4439-b910-67ff8b1fc974" }));
vi.mock("@/lib/payments/server", async () => {
  const { quoteFromBid } = await import("@/lib/payments/quote");
  // The real wrapper (src/lib/payments/server.ts) stamps these exposed headers on every response.
  function expose(response: Response): Response {
    response.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, Tender-Provider, Tender-Price-USD, Tender-Settled-Atomic");
    return response;
  }
  return { quoteFromBid, withX402Payment: (handler: (r: Request, q: PaymentQuote & SettlementAmounts) => Promise<Response>, quote: (r: Request) => PaymentQuote) => async (request: Request) => {
    if (payments.fail) throw new Error("Facilitator unavailable");
    if (payments.failureResponse) return Response.json({ error: "Internal Server Error" }, { status: 500 });
    const q = quote(request);
    payments.calls.push(q);
    if (!request.headers.has("PAYMENT-SIGNATURE")) return expose(Response.json({ error: "payment_required", ...q }, { status: 402, headers: { "PAYMENT-REQUIRED": "base64-challenge" } }));
    if (payments.settleThrow) {
      // Mirrors the @x402/next settlement catch: the handler already produced a
      // payload, then settlement throws and the SDK returns a bare 402 with no
      // PAYMENT-REQUIRED or PAYMENT-RESPONSE header.
      await handler(request, q as PaymentQuote & SettlementAmounts);
      return expose(Response.json({}, { status: 402 }));
    }
    return expose(await handler(request, q as PaymentQuote & SettlementAmounts));
  } };
});
import { GET as price, HEAD as priceHead } from "../../app/api/v1/prices/spot/route";
import { GET as weather } from "../../app/api/v1/weather/current/route";
import { handleContract } from "./handlers";
import { clearReferenceCache } from "./reference";

const req = (path: string, paid = true, headers?: HeadersInit) => new Request(`https://tender.example/api/v1/${path}`, { headers: { ...(paid ? { "PAYMENT-SIGNATURE": "test-only" } : {}), ...headers } });
beforeEach(() => {
  payments.calls = []; payments.fail = false; payments.failureResponse = false; payments.settleThrow = false; clearReferenceCache();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-09T18:30:05Z"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ bid: "75000", ask: "75002", time: "2026-11-09T18:30:00Z" })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("paid contract handlers", () => {
  it("quotes once and serves the same provider with explicit sub-unit settlement", async () => {
    const response = await price(req("prices/spot?pair=BTC-USD"));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(payments.calls).toHaveLength(1);
    expect(payments.calls[0].providerId).toBe("parasail");
    expect(data).toMatchObject({ provider: "parasail", price_usd: 0.0000007, settled_usd: 0.000001, settled_atomic: "1", settlement_note: "Rounded up to the USDC minimum unit (0.000001)", reference_source: "coinbase", reference_timestamp: "2026-11-09T18:30:00.000Z" });
    expect(response.headers.get("Tender-Provider")).toBe(data.provider);
    expect(data.data_age_ms).toBeGreaterThanOrEqual(176);
    expect(data.data_age_ms).toBeLessThanOrEqual(264);
    expect(Date.now() - Date.parse(data.source_timestamp)).toBe(data.data_age_ms);
    expect(data.price).toBeGreaterThan(74000);
    expect(data).not.toHaveProperty("change_usd");
  });
  it("does not load upstream values before payment", async () => {
    const response = await price(req("prices/spot", false));
    expect(response.status).toBe(402);
    expect(response.headers.get("Tender-Provider")).toBe("parasail");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects no-eligible requests before requesting payment", async () => {
    const response = await price(req("prices/spot?max_price=0", false));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "no_eligible_provider", message: "No eligible provider" } });
    expect(payments.calls).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("applies query overrides before headers", async () => {
    const response = await price(req("prices/spot?preference=freshest-data", true, { "Tender-Preference": "lowest-latency" }));
    expect(response.headers.get("Tender-Provider")).toBe("baseten");
    expect(payments.calls[0].providerId).toBe("baseten");
    expect((await response.json()).settled_atomic).toBe("2");
  });
  it("applies all header policy fields", async () => {
    const response = await price(req("prices/spot", true, { "Tender-Max-Price": "1.5", "Tender-Max-P95-Ms": "50", "Tender-Max-Data-Age-Ms": "100", "Tender-Min-Success-Rate": "0.9999" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Tender-Provider")).toBe("coreweave");
  });
  it("serves a policy-failing pin without switching", async () => {
    const response = await price(req("prices/spot?pin=novita"));
    const data = await response.json();
    expect(data.provider).toBe("novita");
    expect(data.policy_violation).toBe(true);
    expect(data.policy_violations[0]).toContain("310");
    expect(response.headers.get("Tender-Policy-Violation")).toBe("true");
  });
  it("fails an unavailable pinned provider instead of rerouting", async () => {
    const response = await weather(req("weather/current?pin=nebius"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Tender-Provider")).toBe("nebius");
    expect((await response.json()).error.code).toBe("provider_error");
  });
  it("uses fixture input when upstream fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Timeout")));
    const response = await weather(req("weather/current?location=san-francisco"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.provider).toBe("together");
    expect(data.reference_source).toBe("fixture");
    expect(data.location.name).toBe("San Francisco, CA");
    expect(data.temperature_f).toBeGreaterThan(59);
    expect(data.temperature_f).toBeLessThan(63);
    expect(data.settled_atomic).toBe("18");
    expect(data).not.toHaveProperty("settlement_note");
  });
  it("fails closed when the payment service fails", async () => {
    payments.fail = true;
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await price(req("prices/spot"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "payment_unavailable", message: "Payment service unavailable" } });
    expect(logger).toHaveBeenCalledWith("Tender payment service error", { name: "Error", message: "Facilitator unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("normalizes SDK-returned facilitator failures without serving a payload", async () => {
    payments.failureResponse = true;
    const response = await price(req("prices/spot"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "payment_unavailable", message: "Payment service unavailable" } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the unpaid 402 challenge body and PAYMENT-REQUIRED header intact", async () => {
    const response = await price(req("prices/spot", false));
    expect(response.status).toBe(402);
    expect(response.headers.get("PAYMENT-REQUIRED")).toBe("base64-challenge");
    expect(await response.json()).toMatchObject({ error: "payment_required", providerId: "parasail" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the 402 challenge readable from any browser origin", async () => {
    const response = await price(req("prices/spot", false));
    expect(response.status).toBe(402);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const expose = (response.headers.get("Access-Control-Expose-Headers") ?? "").split(", ");
    for (const header of ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE", "Tender-Provider", "Tender-Price-USD", "Tender-Settled-Atomic", "Tender-Route-Reason", "Tender-Policy-Violation"]) {
      expect(expose).toContain(header);
    }
  });
  it("marks paid 200 responses callable cross-origin", async () => {
    const response = await price(req("prices/spot?pair=BTC-USD"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  it("normalizes a bare settlement-failure 402 after a served payload to 503", async () => {
    payments.settleThrow = true;
    const response = await price(req("prices/spot"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "payment_unavailable", message: "Payment service unavailable" } });
    expect(response.headers.get("PAYMENT-REQUIRED")).toBeNull();
    expect(response.headers.get("PAYMENT-RESPONSE")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it.each(["prices/spot?pair=ETH-USD", "prices/spot?pair=BTC-USD&pair=BTC-USD", "prices/spot?pin=together", "prices/spot?min_success_rate=99.9"])("rejects invalid input %s before payment", async (path) => {
    expect((await price(req(path))).status).toBe(400);
    expect(payments.calls).toHaveLength(0);
  });
  it("routes and pays the same replacement when in-process conditions change", async () => {
    const response = await handleContract(req("weather/current"), "sf-weather", { conditions: { together: { bidPrice: 45 } } });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Tender-Provider")).toBe("deepinfra");
    expect(data.provider).toBe("deepinfra");
    expect(data.price_usd).toBe(22 / 1e6);
    expect(payments.calls).toHaveLength(1);
    expect(payments.calls[0]).toMatchObject({ providerId: "deepinfra", payTo: getPayee("deepinfra"), amountUsd: 22 / 1e6 });
    expect(payments.calls[0].payTo).not.toBe(getPayee("together"));
  });
  it("uses changed availability without mutating shared defaults", async () => {
    const changed = await handleContract(req("prices/spot"), "btc-usd", { conditions: { parasail: { available: false } } });
    expect(changed.headers.get("Tender-Provider")).toBe("inference-net");
    const unchanged = await price(req("prices/spot"));
    expect(unchanged.headers.get("Tender-Provider")).toBe("parasail");
  });
  it("sanitizes/clamps conditions while preserving unspecified defaults", async () => {
    const response = await handleContract(req("prices/spot?pin=parasail"), "btc-usd", { conditions: { parasail: { p95LatencyMs: -100, dataAgeMs: -5, errorRate: -1, bidPrice: Number.NaN } } });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.latency_ms).toBeLessThanOrEqual(7);
    expect(data.data_age_ms).toBe(0);
    expect(data.price_usd).toBe(0.7 / 1e6);
    expect(data.policy_violation).toBe(false);
  });
  it("ignores unknown providers and invalid patch containers", async () => {
    const response = await handleContract(req("prices/spot"), "btc-usd", { conditions: { unknown: { bidPrice: 0.1 }, parasail: null as unknown as ConditionsPatch } });
    expect(response.headers.get("Tender-Provider")).toBe("parasail");
  });
  it("clamps a zero bid to the market minimum so every paid request has a positive price", async () => {
    const response = await handleContract(req("prices/spot"), "btc-usd", { conditions: { parasail: { bidPrice: 0 } } });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Tender-Provider")).toBe("parasail");
    expect(data.price_usd).toBe(0.05 / 1e6);
    expect(data.settled_atomic).toBe("1");
  });
  it("never reads condition changes from public query parameters or headers", async () => {
    const encoded = encodeURIComponent(JSON.stringify({ parasail: { available: false, bidPrice: 20 } }));
    const response = await price(req(`prices/spot?conditions=${encoded}&conditions[parasail][available]=false`, true, { "Tender-Conditions": JSON.stringify({ parasail: { available: false } }) }));
    expect(response.headers.get("Tender-Provider")).toBe("parasail");
    expect(payments.calls[0].amountUsd).toBe(0.7 / 1e6);
    expect(payments.calls[0].payTo).toBe(getPayee("parasail"));
  });
  it("does not accept HEAD/POST as paid contract requests", async () => {
    expect(priceHead().status).toBe(405);
    expect(priceHead().headers.get("Allow")).toBe("GET");
    const post = await handleContract(new Request("https://tender.example/api/v1/prices/spot", { method: "POST" }), "btc-usd");
    expect(post.status).toBe(405);
    expect(post.headers.get("Allow")).toBe("GET");
    expect(payments.calls).toHaveLength(0);
  });
});
