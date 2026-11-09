import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentQuote, SettlementAmounts } from "@/lib/payments/types";
const payments = vi.hoisted(() => ({ calls: [] as PaymentQuote[], fail: false }));
vi.mock("node:crypto", () => ({ randomUUID: () => "84d53c30-6de2-4439-b910-67ff8b1fc974" }));
vi.mock("@/lib/payments/server", async () => {
  const { quoteFromBid } = await import("@/lib/payments/quote");
  return { quoteFromBid, withX402Payment: (handler: (r: Request, q: PaymentQuote & SettlementAmounts) => Promise<Response>, quote: (r: Request) => PaymentQuote) => async (request: Request) => {
    if (payments.fail) throw new Error("Facilitator unavailable");
    const q = quote(request);
    payments.calls.push(q);
    if (!request.headers.has("PAYMENT-SIGNATURE")) return Response.json({ error: "payment_required", ...q }, { status: 402 });
    return handler(request, q as PaymentQuote & SettlementAmounts);
  } };
});
import { GET as price, HEAD as priceHead } from "../../app/api/v1/prices/spot/route";
import { GET as weather } from "../../app/api/v1/weather/current/route";
import { handleContract } from "./handlers";
import { clearReferenceCache } from "./reference";

const req = (path: string, paid = true, headers?: HeadersInit) => new Request(`https://tender.example/api/v1/${path}`, { headers: { ...(paid ? { "PAYMENT-SIGNATURE": "test-only" } : {}), ...headers } });
beforeEach(() => {
  payments.calls = []; payments.fail = false; clearReferenceCache();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-09T18:30:05Z"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ bid: "75000", ask: "75002", time: "2026-11-09T18:30:00Z" })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

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
    const response = await price(req("prices/spot"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "payment_unavailable", message: "Payment service unavailable" } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["prices/spot?pair=ETH-USD", "prices/spot?pair=BTC-USD&pair=BTC-USD", "prices/spot?pin=together", "prices/spot?min_success_rate=99.9"])("rejects invalid input %s before payment", async (path) => {
    expect((await price(req(path))).status).toBe(400);
    expect(payments.calls).toHaveLength(0);
  });
  it("does not accept HEAD/POST as paid contract requests", async () => {
    expect(priceHead().status).toBe(405);
    expect((await handleContract(new Request("https://tender.example/api/v1/prices/spot", { method: "POST" }), "btc-usd")).status).toBe(405);
    expect(payments.calls).toHaveLength(0);
  });
});
