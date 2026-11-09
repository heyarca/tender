// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { StickyBar } from "../sticky-bar";

/** Capturing stub so tests can fire layout changes by hand (jsdom has no ResizeObserver). */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger() {
    act(() => this.callback([], this as unknown as ResizeObserver));
  }
}

beforeAll(() => {
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
});

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  // Run scheduled frames synchronously so visibility updates inside `act`.
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  MockResizeObserver.instances = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const id of ["late-title", "resizing-title"]) document.getElementById(id)?.remove();
  cleanup();
});

/** A fake title-row sentinel whose viewport bottom the test controls. */
function makeSentinel(id: string, bottom: () => number) {
  const el = document.createElement("div");
  el.id = id;
  el.getBoundingClientRect = () =>
    ({ top: bottom() - 40, bottom: bottom(), height: 40, width: 320, left: 0, right: 320, x: 0, y: bottom() - 40, toJSON: () => ({}) }) as DOMRect;
  return el;
}

describe("StickyBar", () => {
  it("binds a sentinel that mounts after data loads, without any scroll", async () => {
    render(<StickyBar sentinelId="late-title">Bar</StickyBar>);
    const region = screen.getByRole("region", { hidden: true });
    expect(region.getAttribute("data-visible")).toBe("false");

    await act(async () => {
      document.body.appendChild(makeSentinel("late-title", () => 40));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => expect(region.getAttribute("data-visible")).toBe("true"));
  });

  it("re-measures when the sentinel moves or resizes without a scroll event", async () => {
    let bottom = 40;
    const scrollSpy = vi.fn();
    window.addEventListener("scroll", scrollSpy);
    try {
      render(<StickyBar sentinelId="resizing-title">Bar</StickyBar>);
      await act(async () => {
        document.body.appendChild(makeSentinel("resizing-title", () => bottom));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      const region = screen.getByRole("region", { hidden: true });
      await waitFor(() => expect(region.getAttribute("data-visible")).toBe("true"));

      // Content grows under the scrolled position and pushes the sentinel below the navbar.
      act(() => {
        bottom = 400;
        MockResizeObserver.instances.at(-1)?.trigger();
      });
      expect(region.getAttribute("data-visible")).toBe("false");
      expect(scrollSpy).not.toHaveBeenCalled();

      act(() => {
        bottom = 40;
        MockResizeObserver.instances.at(-1)?.trigger();
      });
      expect(region.getAttribute("data-visible")).toBe("true");
      expect(scrollSpy).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("scroll", scrollSpy);
    }
  });
});
