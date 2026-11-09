import { describe, expect, it } from "vitest";
import { parsePaidRequestInput } from "./buyer";

describe("paid provider conditions", () => {
  it("accepts console condition patches and clamps using engine ranges", () => {
    const input = parsePaidRequestInput({ market: "sf-weather", conditions: { together: { bidPrice: 45, available: false, errorRate: 9 } } });
    expect(input.conditions?.together).toMatchObject({ bidPrice: 45, available: false });
    expect(input.conditions?.together?.errorRate).toBeLessThanOrEqual(1);
  });
  it.each([
    { "the-zone-bio": { bidPrice: 1 } }, { unknown: {} }, { together: [] },
    { together: { bidPrice: "45" } }, { together: { available: "false" } },
    { together: { url: "https://evil.test" } }, { together: { bidPrice: Infinity } },
    Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`provider-${index}`, {}])),
  ])("rejects unknown providers and malformed patches %j", (conditions) => {
    expect(() => parsePaidRequestInput({ market: "sf-weather", conditions })).toThrow();
  });
});
