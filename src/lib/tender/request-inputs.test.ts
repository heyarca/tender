import { describe, expect, it } from "vitest";
import { getDefaultPolicy } from "./markets";
import { defaultRequestInputs, parseRequestInputs, requestInputFields } from "./request-inputs";
import { creditsRequestUrl } from "@/components/credits/credits-request";
import { contractUrl, parsePaidRequestInput } from "@/lib/payments/buyer";

const cases = [
  ["translate-en-ko", "text", "Where is the station?"],
  ["chat-general", "prompt", "Explain routing"],
  ["address-geocode", "query", "1600 Amphitheatre Parkway"],
  ["web-metadata", "url", "https://example.com/?a=1&b=two"],
] as const;

describe("contract request inputs", () => {
  it.each(cases)("sends %s input through credits and USDC", (marketId, key, value) => {
    expect(requestInputFields(marketId).map((field) => field.key)).toContain(key);
    expect(defaultRequestInputs(marketId)[key]).toBeTruthy();
    const params = { [key]: `  ${value}  ` };
    const credits = new URL(creditsRequestUrl(marketId, getDefaultPolicy(marketId), params), "https://tender.test");
    const paid = contractUrl("https://tender.test", parsePaidRequestInput({ market: marketId, params }));
    expect(credits.searchParams.get(key)).toBe(value);
    expect(paid.searchParams.get(key)).toBe(value);
  });

  it("rejects routing/market overrides, blank inputs, and oversized input", () => {
    expect(() => parseRequestInputs("translate-en-ko", { target: "ja" })).toThrow("Unknown request input");
    expect(() => parseRequestInputs("translate-en-ko", { text: " " })).toThrow("Enter");
    const max = requestInputFields("translate-en-ko")[0].maxLength!;
    expect(() => parseRequestInputs("translate-en-ko", { text: "x".repeat(max + 1) })).toThrow("characters");
    expect(parseRequestInputs("translate-en-ko", { text: "😀".repeat(max) }).text).toHaveLength(max * 2);
  });
});
