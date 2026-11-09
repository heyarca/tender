import { describe, expect, it } from "vitest";
import { PREFERENCES as ENGINE_PREFERENCES } from "@/lib/tender";
import { PREFERENCES, readPolicyOverrides } from "./policy";

const req = (query = "", headers?: HeadersInit) => new Request(`https://tender.example/api/v1/prices/spot${query}`, { headers });
describe("policy wire inputs", () => {
  it("sources its preference list from the engine", () => {
    expect(PREFERENCES).toBe(ENGINE_PREFERENCES);
    expect([...PREFERENCES]).toContain("lowest-cost");
  });
  it("leaves defaults to the shared engine", () => { expect(readPolicyOverrides(req())).toEqual({}); });
  it("reads numeric limits, preference, and pin", () => {
    expect(readPolicyOverrides(req("?max_price=0.7&max_p95_ms=150&max_data_age_ms=1000&min_success_rate=0.999&preference=freshest-data&pin=parasail"))).toEqual({ maxPrice: 0.7, maxP95LatencyMs: 150, maxDataAgeMs: 1000, minSuccessRate: 0.999, preference: "freshest-data", mode: { kind: "pinned", providerId: "parasail" } });
  });
  it("prefers a query parameter over its header, including zero", () => {
    expect(readPolicyOverrides(req("?max_price=0", { "Tender-Max-Price": "5", "Tender-Preference": "lowest-latency" }))).toEqual({ maxPrice: 0, preference: "lowest-latency" });
  });
  it.each(["?max_price=", "?max_price=-1", "?max_price=NaN", "?max_price=Infinity", "?max_price=0xff", "?min_success_rate=99.9", "?max_p95_ms=1&max_p95_ms=2", "?preference=fastest", "?pin=", "?max_price=1e999"])("rejects malformed input %s", (query) => {
    expect(() => readPolicyOverrides(req(query))).toThrow();
  });
});
