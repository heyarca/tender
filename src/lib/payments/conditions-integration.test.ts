import { paymentRateLimiter, PaymentRateLimiter } from "./limits";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createPaidRequestEndpoint } from "./endpoint";
import { handleContract } from "@/lib/server/handlers";
import { PAYEES } from "./payees";

vi.mock("node:crypto", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:crypto")>(),
  randomUUID: () => "00000000-0000-4000-8000-000000000001",
}));

vi.mock("@/lib/payments/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./server")>();
  const payer = privateKeyToAccount(`0x${"0".repeat(63)}1`).address;
  const server = actual.createPaymentServer({
    getSupported: async () => ({ kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:84532" }], extensions: [], signers: {} }),
    verify: async () => ({ isValid: true, payer }),
    settle: async () => ({ success: true, transaction: `0x${"b".repeat(64)}`, network: "eip155:84532", payer }),
  });
  return { ...actual, withX402Payment: (...args: Parameters<typeof actual.withX402Payment>) => actual.withX402Payment(args[0], args[1], server) };
});
vi.mock("@/lib/server/reference", () => ({
  getWeatherReference: async () => ({ source: "open-meteo", timestamp: "2026-11-09T03:00:00Z", value: { temperature_f: 61, feels_like_f: 60, condition: "Overcast", humidity_percent: 86, wind_mph: 9, wind_direction_degrees: 278, pressure_hpa: 1018, visibility_mi: 9.4, dew_point_f: 57, cloud_cover_percent: 100 } }),
}));
beforeEach(() => {
  const limiter = new PaymentRateLimiter();
  vi.spyOn(paymentRateLimiter, "acquire").mockImplementation(() => limiter.acquire());
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("console state through paid contract", () => {
  it("raising Together's bid routes the challenge, paid result, and receipt to DeepInfra", async () => {
    vi.stubEnv("TENDER_DEMO_PAYER_PRIVATE_KEY", `0x${"0".repeat(63)}1`);
    const endpoint = createPaidRequestEndpoint(handleContract);
    const response = await endpoint(new Request("https://tender.test/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market: "sf-weather", conditions: { together: { bidPrice: 45 } } }) }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.response).toMatchObject({ provider: "deepinfra", price_usd: 0.000022, settled_atomic: "22" });
    expect(result.receipt).toMatchObject({ providerId: "deepinfra", providerName: "DeepInfra", payTo: PAYEES.deepinfra, settled_atomic: "22", amountAtomic: "22" });
    expect(result.receipt.latency_ms).toBe(result.response.latency_ms);
    expect(result.receipt.data_age_ms).toBe(result.response.data_age_ms);
  });
});
