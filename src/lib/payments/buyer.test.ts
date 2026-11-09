import { describe, expect, it } from "vitest";
import { contractUrl, parsePaidRequestInput } from "./buyer";

describe("paid request input", () => {
  it("uses fixed contract paths and forwards only the routing policy", () => {
    const input = parsePaidRequestInput({ market: "sf-weather", policy: { maxPrice: 40, preference: "lowest-latency", mode: { kind: "pinned", providerId: "fireworks" } } });
    const url = contractUrl("https://tender.test", input);
    expect(url.origin).toBe("https://tender.test");
    expect(url.pathname).toBe("/api/v1/weather/current");
    expect(url.searchParams.get("max_price")).toBe("40");
    expect(url.searchParams.get("preference")).toBe("lowest-latency");
    expect(url.searchParams.get("pin")).toBe("fireworks");
  });
  it.each([null, [], {}, { market: "unknown" }, { market: "btc-usd", url: "https://evil.test" }, { market: "btc-usd", policy: { maxPrice: -1 } }, { market: "btc-usd", policy: { minSuccessRate: 100 } }, { market: "btc-usd", policy: { preference: "free" } }, { market: "btc-usd", policy: { mode: { kind: "pinned" } } }])("rejects invalid input %j", (input) => expect(() => parsePaidRequestInput(input)).toThrow());
});
