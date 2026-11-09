import { describe, expect, it } from "vitest";
import { compassDirection, formatAge, formatClock, formatLatency, formatPercent, formatTimeOfDay, formatUsd } from "./format";

const T = Date.UTC(2026, 10, 9, 18, 4, 31, 220);

describe("formatters", () => {
  it("formats prices", () => {
    expect(formatUsd(75_230.75)).toBe("$75,230.75");
    expect(formatUsd(75_230, 0)).toBe("$75,230");
  });

  it("formats latency", () => {
    expect(formatLatency(84.4)).toBe("84 ms");
    expect(formatLatency(1_240)).toBe("1.2 s");
    expect(formatLatency(Number.NaN)).toBe("–");
  });

  it("formats data age", () => {
    expect(formatAge(220)).toBe("220 ms");
    expect(formatAge(2_400)).toBe("2.4 s");
    expect(formatAge(6 * 60_000)).toBe("6 min");
    expect(formatAge(72 * 60_000)).toBe("1 h 12 min");
    expect(formatAge(120 * 60_000)).toBe("2 h");
    expect(formatAge(-5)).toBe("0 ms");
  });

  it("formats percentages", () => {
    expect(formatPercent(0.9994)).toBe("99.94%");
  });

  it("formats clock times in the given time zone", () => {
    expect(formatClock(T, "UTC")).toBe("18:04:31");
    expect(formatClock(T, "UTC", { milliseconds: true })).toBe("18:04:31.220");
    expect(formatClock(T, "UTC", { seconds: false })).toBe("18:04");
    expect(formatClock(T, "America/Los_Angeles")).toBe("10:04:31");
    expect(formatTimeOfDay(T, "America/Los_Angeles")).toBe("10:04 AM");
  });

  it("maps bearings to compass points", () => {
    expect(compassDirection(278)).toBe("W");
    expect(compassDirection(0)).toBe("N");
    expect(compassDirection(359)).toBe("N");
    expect(compassDirection(-90)).toBe("W");
    expect(compassDirection(200)).toBe("SSW");
  });
});
