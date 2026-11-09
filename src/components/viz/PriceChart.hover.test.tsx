// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatUsd } from "./format";
import { PriceChart } from "./PriceChart";
import type { PricePoint } from "./types";

const T0 = Date.UTC(2026, 10, 9, 18, 30);

function makePoints(count: number): PricePoint[] {
  return Array.from({ length: count }, (_, i) => ({
    t: T0 + i * 2_000,
    price: 75_000 + i * 1.5,
    providerId: "parasail",
  }));
}

afterEach(() => {
  cleanup();
});

describe("PriceChart hover across a rolling window", () => {
  it("keeps the hovered point when the window slides forward by one", () => {
    const points = makePoints(40);
    const last = points[points.length - 1];
    const { container, rerender } = render(<PriceChart points={points} timeZone="UTC" />);
    const group = screen.getByRole("group", { name: /arrow keys/i });

    fireEvent.keyDown(group, { key: "End" });
    expect(container.textContent).toContain(formatUsd(last.price));
    expect(container.textContent).not.toContain("$75,060.00");

    // The rolling window drops the oldest sample and appends a newer one: every index shifts.
    const shifted: PricePoint[] = [...points.slice(1), { t: T0 + 80_000, price: 75_060, providerId: "parasail" }];
    rerender(<PriceChart points={shifted} timeZone="UTC" />);

    // The same request stays hovered: same time and price, not the point that took its index.
    expect(container.textContent).toContain(formatUsd(last.price));
    expect(container.textContent).not.toContain("$75,060.00");
  });

  it("steps one point per arrow keypress after a window slide", () => {
    const points = makePoints(40);
    const { container, rerender } = render(<PriceChart points={points} timeZone="UTC" />);
    const group = screen.getByRole("group", { name: /arrow keys/i });

    fireEvent.keyDown(group, { key: "End" });
    const shifted: PricePoint[] = [...points.slice(1), { t: T0 + 80_000, price: 75_060, providerId: "parasail" }];
    rerender(<PriceChart points={shifted} timeZone="UTC" />);

    fireEvent.keyDown(group, { key: "ArrowLeft" });
    // One step back from the old last point ($75,058.50), not from the appended one ($75,060).
    expect(container.textContent).toContain("$75,057.00");
    expect(container.textContent).not.toContain("$75,058.50");
    expect(container.textContent).not.toContain("$75,060.00");
  });
});
