import { describe, expect, it } from "vitest";

import { BTC_USD, SF_WEATHER } from "@/lib/tender";

import { clampDisplay, displayOf, engineOf, formatSpecValue, numberFormatOf, roundDisplay, stepDisplay } from "./spec-values";

const sf = SF_WEATHER.policyInputs;
const btc = BTC_USD.policyInputs;

describe("spec values", () => {
  it("converts weather data age between minutes and milliseconds", () => {
    expect(displayOf(sf.maxDataAgeMs, 15 * 60_000)).toBe(15);
    expect(engineOf(sf.maxDataAgeMs, 20)).toBe(20 * 60_000);
  });

  it("keeps BTC data age in milliseconds", () => {
    expect(displayOf(btc.maxDataAgeMs, 1_000)).toBe(1_000);
    expect(engineOf(btc.maxDataAgeMs, 750)).toBe(750);
  });

  it("converts success rate between percent and ratio without float noise", () => {
    expect(displayOf(sf.minSuccessRate, 0.995)).toBe(99.5);
    expect(engineOf(sf.minSuccessRate, 99.9)).toBe(0.999);
  });

  it("clamps to the spec range and rounds to its decimals", () => {
    expect(clampDisplay(sf.maxP95LatencyMs, 5_000)).toBe(2_000);
    expect(clampDisplay(sf.maxP95LatencyMs, 10)).toBe(50);
    expect(roundDisplay(sf.maxPrice, 0.1 + 0.2)).toBe(0.3);
    expect(engineOf(sf.maxP95LatencyMs, 9_999)).toBe(2_000);
    expect(stepDisplay(sf.maxPrice, 99.8, 2)).toBe(100);
  });

  it("formats values with the market prefix and unit", () => {
    expect(formatSpecValue(sf.maxPrice, 40)).toBe("$40.00 /M req");
    expect(formatSpecValue(sf.maxP95LatencyMs, 400)).toBe("400 ms");
    expect(formatSpecValue(sf.maxDataAgeMs, 15 * 60_000)).toBe("15 min");
    expect(formatSpecValue(sf.minSuccessRate, 0.995)).toBe("99.50%");
    expect(formatSpecValue(btc.maxDataAgeMs, 1_000)).toBe("1,000 ms");
    expect(formatSpecValue(btc.maxPrice, 2)).toBe("$2.00 /M req");
  });

  it("formats inputs with exactly the spec decimals", () => {
    expect(numberFormatOf(sf.minSuccessRate)).toEqual({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(numberFormatOf(sf.maxDataAgeMs)).toEqual({ minimumFractionDigits: 0, maximumFractionDigits: 0 });
  });
});
