import { describe, expect, it } from "vitest";
import { CHART_COLORS, providerColor, providerColorMap, successTone } from "./colors";

const IDS = ["fernline", "kitefin", "cinderlane", "saltmarsh", "slatework", "mossgate", "owlbridge", "kelpwave"];

describe("providerColor", () => {
  it("follows the fixture order", () => {
    expect(providerColor("fernline", IDS)).toBe("var(--chart-1)");
    expect(providerColor("kelpwave", IDS)).toBe("var(--chart-8)");
  });

  it("wraps after eight providers", () => {
    const ids = [...IDS, "ninth"];
    expect(providerColor("ninth", ids)).toBe("var(--chart-1)");
  });

  it("gives unknown ids a stable hashed color", () => {
    const a = providerColor("unknown-provider");
    expect(CHART_COLORS).toContain(a);
    expect(providerColor("unknown-provider", IDS)).toBe(a);
  });

  it("builds a full map", () => {
    const map = providerColorMap(IDS);
    expect(Object.keys(map)).toEqual(IDS);
    expect(new Set(Object.values(map)).size).toBe(8);
  });
});

describe("successTone", () => {
  it("is positive at or above the minimum", () => {
    expect(successTone(0.9995, 0.995)).toBe("positive");
    expect(successTone(0.995, 0.995)).toBe("positive");
  });

  it("is a warning within twice the error budget, negative below", () => {
    expect(successTone(0.992, 0.995)).toBe("warning");
    expect(successTone(0.99, 0.995)).toBe("warning");
    expect(successTone(0.9899, 0.995)).toBe("negative");
    expect(successTone(0.9915, 0.999)).toBe("negative");
  });

  it("honors an explicit critical bound and empty values", () => {
    expect(successTone(0.97, 0.995, 0.95)).toBe("warning");
    expect(successTone(null, 0.995)).toBe("empty");
    expect(successTone(Number.NaN, 0.995)).toBe("empty");
  });
});
