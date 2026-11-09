import { describe, expect, it } from "vitest";
import {
  detectAppendShift,
  extent,
  latencyScaleMax,
  linePath,
  monotonePath,
  nearestIndex,
  niceAxis,
  resolveDomain,
  scaleLinear,
  timeTicks,
} from "./scale";

describe("scaleLinear", () => {
  it("maps a domain onto a range, including inverted ranges", () => {
    const y = scaleLinear([0, 100], [160, 0]);
    expect(y(0)).toBe(160);
    expect(y(100)).toBe(0);
    expect(y(25)).toBe(120);
  });

  it("maps a zero-width domain to the middle of the range", () => {
    expect(scaleLinear([5, 5], [0, 40])(5)).toBe(20);
  });
});

describe("extent", () => {
  it("ignores non-finite values", () => {
    expect(extent([3, Number.NaN, -1, Infinity, 7])).toEqual([-1, 7]);
    expect(extent([Number.NaN])).toBeNull();
    expect(extent([])).toBeNull();
  });
});

describe("niceAxis", () => {
  it("covers the data with at most maxTicks nice ticks", () => {
    const axis = niceAxis(75_191.3, 75_262.8, 4);
    expect(axis.ticks.length).toBeLessThanOrEqual(4);
    expect(axis.ticks[0]).toBeLessThanOrEqual(75_191.3);
    expect(axis.ticks[axis.ticks.length - 1]).toBeGreaterThanOrEqual(75_262.8);
    expect(axis.domain).toEqual([axis.ticks[0], axis.ticks[axis.ticks.length - 1]]);
    for (const tick of axis.ticks) expect(Math.abs(tick / axis.step - Math.round(tick / axis.step))).toBeLessThan(1e-6);
    expect([10, 20, 25, 50]).toContain(axis.step);
  });

  it("rounds ticks to the step precision", () => {
    const axis = niceAxis(0.1, 0.7, 4);
    expect(axis.ticks).toEqual([0, 0.25, 0.5, 0.75]);
    expect(axis.step).toBe(0.25);
  });

  it("pads a flat series instead of collapsing", () => {
    const axis = niceAxis(75_230.75, 75_230.75, 4);
    expect(axis.domain[0]).toBeLessThan(75_230.75);
    expect(axis.domain[1]).toBeGreaterThan(75_230.75);
  });

  it("accepts swapped bounds", () => {
    expect(niceAxis(10, 0, 3).domain).toEqual(niceAxis(0, 10, 3).domain);
  });
});

describe("timeTicks", () => {
  const t0 = Date.UTC(2026, 10, 9, 18, 28, 41, 300);

  it("returns round timestamps inside the window", () => {
    const ticks = timeTicks(t0, t0 + 78_000, 4);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThanOrEqual(4);
    expect(ticks).toEqual([Date.UTC(2026, 10, 9, 18, 29), Date.UTC(2026, 10, 9, 18, 29, 30)]);
  });

  it("uses the smallest step that fits", () => {
    const ticks = timeTicks(t0, t0 + 10_000, 6);
    expect(ticks[1] - ticks[0]).toBe(2_000);
  });

  it("returns nothing for an empty window", () => {
    expect(timeTicks(t0, t0, 4)).toEqual([]);
    expect(timeTicks(Number.NaN, t0, 4)).toEqual([]);
  });
});

describe("resolveDomain", () => {
  const steady = Array.from({ length: 30 }, (_, i) => 210 + Math.sin(i) * 8);

  it("keeps a steady series calm with a minimum span", () => {
    const { domain } = resolveDomain(steady);
    expect(domain[1] - domain[0]).toBeGreaterThanOrEqual(210 * 0.25 - 1e-9);
    expect(domain[0]).toBeLessThan(202);
    expect(domain[1]).toBeGreaterThan(218);
  });

  it("stretches to include a nearby limit", () => {
    const result = resolveDomain(steady, { limit: 260 });
    expect(result.limit).toBe("inside");
    expect(result.domain[1]).toBeGreaterThan(260);
  });

  it("reports a far limit as above instead of flattening the data", () => {
    const result = resolveDomain(steady, { limit: 4_000 });
    expect(result.limit).toBe("above");
    expect(result.domain[1]).toBeLessThan(4_000);
  });

  it("reports a far limit below the data", () => {
    const result = resolveDomain([640, 650, 660, 655], { limit: 100, minSpanRatio: 0.02 });
    expect(result.limit).toBe("below");
  });

  it("brings a limit into view when zero is included", () => {
    const result = resolveDomain(steady, { limit: 400, includeZero: true });
    expect(result.domain[0]).toBe(0);
    expect(result.limit).toBe("inside");
    expect(result.domain[1]).toBeGreaterThan(400);
  });

  it("uses a fixed domain as is and only reports the limit", () => {
    expect(resolveDomain(steady, { domain: [0, 300], limit: 400 })).toEqual({ domain: [0, 300], limit: "above" });
    expect(resolveDomain(steady, { domain: [300, 0], limit: 100 })).toEqual({ domain: [0, 300], limit: "inside" });
  });

  it("has a usable domain without data", () => {
    expect(resolveDomain([], { limit: 400 })).toEqual({ domain: [0, 500], limit: "inside" });
    expect(resolveDomain([]).domain).toEqual([0, 1]);
  });
});

describe("paths", () => {
  it("builds straight paths with rounded coordinates", () => {
    expect(linePath([])).toBe("");
    expect(linePath([{ x: 0, y: 1.234 }, { x: 10.005, y: 2 }])).toBe("M0,1.23L10.01,2");
  });

  it("falls back to straight lines below three points", () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 5 }];
    expect(monotonePath(pts)).toBe(linePath(pts));
  });

  it("draws a cubic per segment that never overshoots monotone data", () => {
    const pts = [
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 40, y: 8 },
    ];
    const d = monotonePath(pts);
    expect(d.startsWith("M0,10")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(pts.length - 1);
    const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const ys = numbers.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(10);
    // A flat run stays flat (no bulge between equal neighbours).
    const firstCurve = d.slice(d.indexOf("C") + 1, d.indexOf("C", d.indexOf("C") + 1));
    expect(firstCurve.split(",").filter((_, i) => i % 2 === 1).map(Number)).toEqual([10, 10, 10]);
  });
});

describe("detectAppendShift", () => {
  it("detects a rolling window that slid forward", () => {
    expect(detectAppendShift([1, 2, 3, 4], [2, 3, 4, 5])).toBe(1);
    expect(detectAppendShift([1, 2, 3, 4], [3, 4, 5, 6])).toBe(2);
    expect(detectAppendShift([1, 2, 3], [1, 2, 3, 4])).toBe(1);
  });

  it("returns 0 for identical series and null for unrelated ones", () => {
    expect(detectAppendShift([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(detectAppendShift([1, 2, 3], [9, 8, 7])).toBeNull();
    expect(detectAppendShift([], [1])).toBeNull();
  });
});

describe("nearestIndex", () => {
  it("finds the closest key", () => {
    const keys = [0, 10, 20, 30];
    expect(nearestIndex(keys, -5)).toBe(0);
    expect(nearestIndex(keys, 14)).toBe(1);
    expect(nearestIndex(keys, 16)).toBe(2);
    expect(nearestIndex(keys, 99)).toBe(3);
    expect(nearestIndex([], 1)).toBe(-1);
  });
});

describe("latencyScaleMax", () => {
  it("fits the slowest request and the limit with headroom", () => {
    const requests = [
      { id: "a", t: 0, latencyMs: 120, providerId: "together", status: "ok" as const },
      { id: "b", t: 1, latencyMs: null, providerId: null, status: "rejected" as const },
    ];
    expect(latencyScaleMax(requests, 400)).toBe(500);
    expect(latencyScaleMax(requests, null)).toBeCloseTo(129.6);
    expect(latencyScaleMax([], null)).toBe(1);
  });
});
