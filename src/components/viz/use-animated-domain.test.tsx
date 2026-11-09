// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnimatedDomain, type AnimatedDomain, type ChartDomain } from "./use-animated-domain";

const A: ChartDomain = { x0: 0, x1: 100, y0: 0, y1: 10 };
const B: ChartDomain = { x0: 100, x1: 200, y0: 2, y1: 12 };
const C: ChartDomain = { x0: 50, x1: 150, y0: 5, y1: 15 };

function Harness({ target, payload, duration = 450 }: { target: ChartDomain; payload: number; duration?: number }) {
  const result = useAnimatedDomain(target, payload, duration);
  return <span data-testid="state">{JSON.stringify(result)}</span>;
}

/** Latest render output of the hook, read back from the DOM. */
function state(): AnimatedDomain<number> {
  return JSON.parse(screen.getByTestId("state").textContent ?? "{}");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useAnimatedDomain", () => {
  it("tweens across a domain change and settles at progress 1", () => {
    const { rerender } = render(<Harness target={A} payload={1} />);
    // Progress 0 (before any change): the target is shown directly, nothing animates.
    expect(state()).toEqual({ domain: A, previous: null, animating: false });
    expect(vi.getTimerCount()).toBe(0); // no frame is scheduled before a domain change

    rerender(<Harness target={B} payload={2} />);
    // Progress 0: the previous domain is still drawn and the pre-change payload is kept.
    expect(state().animating).toBe(true);
    expect(state().domain).toEqual(A);
    expect(state().previous).toBe(1);

    // Mid-tween: between the two domains, still animating, still holding previous.
    act(() => {
      vi.advanceTimersByTime(224);
    });
    expect(state().animating).toBe(true);
    expect(state().domain.x0).toBeGreaterThan(A.x0);
    expect(state().domain.x0).toBeLessThan(B.x0);
    expect(state().domain.y1).toBeGreaterThan(A.y1);
    expect(state().domain.y1).toBeLessThan(B.y1);
    expect(state().previous).toBe(1);

    // Progress 1: the new target, previous released.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(state().animating).toBe(false);
    expect(state().domain).toEqual(B);
    expect(state().previous).toBeNull();
  });

  it("bumps the generation: a new target cancels the stale frame and re-hands previous", () => {
    const { rerender } = render(<Harness target={A} payload={1} />);
    rerender(<Harness target={B} payload={2} />);
    act(() => {
      vi.advanceTimersByTime(64);
    });
    expect(vi.getTimerCount()).toBe(1); // one in-flight frame

    // A new target arrives mid-flight: the stale frame is cancelled and only the new one is pending.
    rerender(<Harness target={C} payload={3} />);
    expect(state().animating).toBe(true);
    expect(state().previous).toBe(2);
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(state().animating).toBe(false);
    expect(state().domain).toEqual(C);
    expect(state().previous).toBeNull();
    expect(vi.getTimerCount()).toBe(0); // no stale frames keep spinning
  });

  it("skips the tween under reduced motion: no frames and previous stays null", () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) => ({
        matches: true,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }),
    );
    const { rerender } = render(<Harness target={A} payload={1} />);
    rerender(<Harness target={B} payload={2} />);

    expect(state().animating).toBe(false);
    expect(state().domain).toEqual(B);
    expect(state().previous).toBeNull();
    expect(vi.getTimerCount()).toBe(0); // no frame was ever scheduled

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(state().animating).toBe(false);
    expect(state().domain).toEqual(B);
    expect(vi.getTimerCount()).toBe(0);
  });
});
