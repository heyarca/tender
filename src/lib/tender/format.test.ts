import { describe, expect, it } from "vitest";
import * as format from "./format";

const T = Date.UTC(2026, 10, 9, 18, 4, 31, 220);

describe("format", () => {
  it("formats prices and costs", () => {
    expect(format.price(18)).toBe("$18.00");
    expect(format.priceWithUnit(0.7)).toBe("$0.70 /M req");
    expect(format.requestCost(18)).toBe("$0.000018");
    expect(format.requestCost(0.7)).toBe("$0.0000007");
    expect(format.cost(0)).toBe("$0.00");
    expect(format.cost(4.5)).toBe("$4.50");
    expect(format.usd(75_230.75)).toBe("$75,230.75");
    expect(format.signedUsd(12.4)).toBe("+$12.40");
    expect(format.signedUsd(-3.1)).toBe("\u2212$3.10");
  });

  it("formats latency and data age", () => {
    expect(format.latency(210)).toBe("210 ms");
    expect(format.latency(1_200)).toBe("1.2 s");
    expect(format.latency(1_000)).toBe("1 s");
    expect(format.dataAge(220)).toBe("220 ms");
    expect(format.dataAge(2_400)).toBe("2.4 s");
    expect(format.dataAge(360_000)).toBe("6 min");
    expect(format.dataAge(72 * 60_000)).toBe("1 h 12 min");
    expect(format.dataAge(60 * 60_000)).toBe("1 h");
  });

  it("covers the boundary windows inside a minute and an hour", () => {
    // [59_950, 60_000) ms: still sub-minute, never "1 min".
    expect(format.dataAge(59_940)).toBe("59.9 s");
    expect(format.dataAge(59_999)).toBe("59.9 s");
    // [3_585_000, 3_600_000) ms: still 59 min, never "1 h".
    expect(format.dataAge(3_590_000)).toBe("59 min");
    expect(format.dataAge(3_599_999)).toBe("59 min");
  });

  it("floors data age at unit boundaries", () => {
    expect(format.dataAge(59_960)).toBe("59.9 s"); // sub-minute, never "1 min" or "1 h"
    expect(format.dataAge(3_584_000)).toBe("59 min"); // 59.73 min, never "1 h"
    expect(format.dataAge(3_599_000)).toBe("59 min"); // 59.98 min
    expect(format.dataAge(3_600_000)).toBe("1 h"); // exactly 60 min
    expect(format.dataAge(60_000)).toBe("1 min"); // exactly 60 s
  });

  it("formats percents, temperature, and compass", () => {
    expect(format.percent(0.9994)).toBe("99.94%");
    expect(format.errorRate(0.0006)).toBe("0.06%");
    expect(format.temperature(61.4)).toBe("61°F");
    expect(format.compass(278)).toBe("W");
    expect(format.count(1234)).toBe("1,234");
  });

  it("formats times with an explicit time zone", () => {
    expect(format.time(T, "America/Los_Angeles")).toBe("10:04 AM PST");
    expect(format.time(T, "America/Los_Angeles", { seconds: true })).toBe("10:04:31 AM PST");
    expect(format.time(T, "UTC")).toBe("18:04:31.220 UTC");
    expect(format.time(T, "UTC", { milliseconds: false })).toBe("18:04:31 UTC");
    expect(format.dateTime(T, "UTC")).toBe("Nov 9, 18:04:31 UTC");
    expect(format.dateTime(T, "America/Los_Angeles")).toBe("Nov 9, 10:04 AM PST");
    expect(format.isoTimestamp(T)).toBe("2026-11-09T18:04:31.220Z");
  });

  it("formats relative times and countdowns from the store clock", () => {
    expect(format.relativeTime(T - 12_000, T)).toBe("12 s ago");
    expect(format.relativeTime(T - 500, T)).toBe("just now");
    expect(format.relativeTime(T - 3 * 60_000, T)).toBe("3 min ago");
    expect(format.relativeTime(T + 7_000, T)).toBe("in 7 s");
    expect(format.countdown(T + 6_200, T)).toBe("7 s");
    expect(format.countdown(T - 1_000, T)).toBe("0 s");
  });
});
