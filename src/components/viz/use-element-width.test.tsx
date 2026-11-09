// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElementWidth } from "./use-element-width";

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed: Element | null = null;
  disconnectCount = 0;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observed = target;
  }
  unobserve() {}
  disconnect() {
    this.disconnectCount += 1;
  }
  emit(width: number) {
    this.callback([{ contentRect: { width, height: 10 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

function Harness() {
  const [ref, width, measured] = useElementWidth<HTMLDivElement>(640);
  return (
    <div ref={ref}>
      <span data-testid="width">{width}</span>
      <span data-testid="measured">{String(measured)}</span>
    </div>
  );
}

const widthOf = () => Number(screen.getByTestId("width").textContent);
const measuredOf = () => screen.getByTestId("measured").textContent === "true";

beforeEach(() => {
  MockResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useElementWidth", () => {
  it("returns the initial width before the first observation (hydration parity)", () => {
    render(<Harness />);
    expect(widthOf()).toBe(640);
    expect(measuredOf()).toBe(false);
    expect(MockResizeObserver.instances).toHaveLength(1);
    expect(MockResizeObserver.instances[0].observed?.tagName).toBe("DIV");
  });

  it("tracks ResizeObserver updates, rounds, and ignores zero widths", () => {
    render(<Harness />);
    const observer = MockResizeObserver.instances[0];
    act(() => observer.emit(321.6));
    expect(widthOf()).toBe(322);
    expect(measuredOf()).toBe(true);
    act(() => observer.emit(0));
    expect(widthOf()).toBe(322);
    act(() => observer.emit(500));
    expect(widthOf()).toBe(500);
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<Harness />);
    const observer = MockResizeObserver.instances[0];
    unmount();
    expect(observer.disconnectCount).toBe(1);
  });
});
