import { describe, expect, it } from "vitest";
import { tokenizeJson } from "./JsonView";

const join = (value: unknown, indent?: number) =>
  tokenizeJson(value, indent)
    .map((t) => t.text)
    .join("");

describe("tokenizeJson", () => {
  it("reproduces JSON.stringify exactly", () => {
    const payload = {
      location: { name: "San Francisco, CA", lat: 37.7749, lon: -122.4194 },
      temperatureF: 61,
      condition: "overcast",
      cached: false,
      alerts: [],
      tags: ["a", 1, null],
      empty: {},
      note: null,
      skipped: undefined,
    };
    expect(join(payload)).toBe(JSON.stringify(payload, null, 2));
    expect(join(payload, 4)).toBe(JSON.stringify(payload, null, 4));
    expect(join([undefined, 1])).toBe(JSON.stringify([undefined, 1], null, 2));
  });

  it("types tokens for coloring", () => {
    const tokens = tokenizeJson({ price: 75230.75, pair: "BTC/USD", ok: true });
    const types = Object.fromEntries(tokens.filter((t) => t.type !== "space").map((t) => [t.text, t.type]));
    expect(types['"price"']).toBe("key");
    expect(types["75230.75"]).toBe("number");
    expect(types['"BTC/USD"']).toBe("string");
    expect(types.true).toBe("boolean");
  });

  it("serializes dates and non-finite numbers like JSON", () => {
    const value = { at: new Date(Date.UTC(2026, 10, 9, 18, 30)), bad: Number.NaN };
    expect(join(value)).toBe(JSON.stringify(value, null, 2));
  });
});
