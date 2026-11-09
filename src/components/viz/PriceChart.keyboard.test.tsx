// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PriceChart } from "./PriceChart";
import type { PricePoint } from "./types";

const T0 = Date.UTC(2026, 10, 9, 18, 30);
const points: PricePoint[] = Array.from({ length: 10 }, (_, i) => ({
  t: T0 + i * 2_000,
  price: 75_000 + i,
  providerId: "parasail",
}));

afterEach(() => {
  cleanup();
});

function renderChart() {
  const utils = render(<PriceChart points={points} timeZone="UTC" />);
  return { ...utils, group: screen.getByRole("group", { name: /arrow keys/i }) };
}

describe("PriceChart key handling", () => {
  it("End jumps to the newest point and Home to the oldest", () => {
    const { container, group } = renderChart();
    fireEvent.keyDown(group, { key: "End" });
    expect(container.textContent).toContain("$75,009.00");
    fireEvent.keyDown(group, { key: "Home" });
    expect(container.textContent).toContain("$75,000.00");
    expect(container.textContent).not.toContain("$75,009.00");
  });

  it("Escape clears the tooltip", () => {
    const { container, group } = renderChart();
    fireEvent.keyDown(group, { key: "End" });
    expect(container.textContent).toContain("$75,009.00");
    fireEvent.keyDown(group, { key: "Escape" });
    expect(container.textContent).not.toContain("$75,009.00");
  });

  it("ArrowRight with no hover starts at the newest point, then steps one per press", () => {
    const { container, group } = renderChart();
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(container.textContent).toContain("$75,009.00");
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(container.textContent).toContain("$75,008.00");
    expect(container.textContent).not.toContain("$75,009.00");
  });

  it("ArrowRight stops at the newest point without wrapping", () => {
    const { container, group } = renderChart();
    fireEvent.keyDown(group, { key: "End" });
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(container.textContent).toContain("$75,009.00");
    expect(container.textContent).not.toContain("$75,008.00");
  });

  it("pointer movement snaps to the nearest point", () => {
    const { container, group } = renderChart();
    // 374px inside the 640px server-rendered chart maps to the time of the 6th sample
    // (t0 + 10 s); the crosshair snaps to it and the tooltip shows its price.
    fireEvent.pointerMove(group, { clientX: 374 });
    expect(container.textContent).toContain("$75,005.00");
    fireEvent.pointerLeave(group);
    expect(container.textContent).not.toContain("$75,005.00");
  });
});
