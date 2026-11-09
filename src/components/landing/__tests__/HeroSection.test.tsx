// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroSection } from "../HeroSection";
import { HERO_SWITCH_DELAY_MS } from "../LandingMedia";

let reducedMotion = false;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // jsdom has no media playback.
  HTMLMediaElement.prototype.play = function play() {
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function pause() {};
});

beforeEach(() => {
  reducedMotion = false;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function rowOf(name: string) {
  const table = screen.getByRole("table", { name: "Bitcoin price providers" });
  return within(table).getByText(name).closest('[role="row"]') as HTMLElement;
}

describe("HeroSection", () => {
  it("renders the only h1, the approved copy, and the calls to action", () => {
    const { container } = render(<HeroSection />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Always on the best API.");
    expect(
      screen.getByText("If an API breaks, Tender switches. If a better one shows up, Tender switches. Your app never notices."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /Try Tender/ }).getAttribute("href")).toBe("/markets");
    expect(screen.getByRole("link", { name: /See how it works/ }).getAttribute("href")).toBe("#how-it-works");
    expect(screen.getByRole("link", { name: /Watch video/ }).getAttribute("href")).toBe("/demo");
    expect(container.textContent).not.toMatch(/simulated|sample|illustrative|demo/i);
  });

  it("shows the engine's policy limits and providers in a fixed order", () => {
    render(<HeroSection />);
    const limits = screen.getByLabelText("Your requirements");
    expect(limits.textContent).toContain("$2.00 /M req");
    expect(limits.textContent).toContain("150 ms");
    expect(limits.textContent).toContain("1 s");
    expect(limits.textContent).toContain("99.90%");
    const table = screen.getByRole("table", { name: "Bitcoin price providers" });
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("[role=cell]")?.textContent);
    expect(names).toEqual(["THE ZONE BIO", "Arca Labs", "NovitaAI", "Crusoe"]);
    expect(within(rowOf("THE ZONE BIO")).getByText("Active")).toBeTruthy();
    expect(within(rowOf("NovitaAI")).getByText("Too slow")).toBeTruthy();
    expect(within(rowOf("Crusoe")).getByText("Stale data")).toBeTruthy();
    expect(rowOf("THE ZONE BIO").textContent).toContain("$0.70 /M req");
  });

  it("switches from THE ZONE BIO to Arca Labs once, after the delay", () => {
    render(<HeroSection />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");

    act(() => vi.advanceTimersByTime(HERO_SWITCH_DELAY_MS - 1));
    expect(within(rowOf("THE ZONE BIO")).getByText("Active")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1));
    expect(within(rowOf("THE ZONE BIO")).getByText("Too slow")).toBeTruthy();
    expect(rowOf("THE ZONE BIO").textContent).toContain("180 ms");
    expect(within(rowOf("Arca Labs")).getByText("Active")).toBeTruthy();
    expect(screen.getByText("Routing to Arca Labs")).toBeTruthy();
    expect(status.textContent).toContain("Switched from THE ZONE BIO to Arca Labs");
    expect(status.textContent).toContain("P95 180 ms exceeds 150 ms");

    act(() => vi.advanceTimersByTime(HERO_SWITCH_DELAY_MS * 3));
    expect(screen.getAllByText("Switched from THE ZONE BIO to Arca Labs")).toHaveLength(1);
    expect(within(rowOf("Arca Labs")).getByText("Active")).toBeTruthy();
  });

  it("does not switch under reduced motion", () => {
    reducedMotion = true;
    const setTimeout = vi.spyOn(window, "setTimeout");
    render(<HeroSection />);
    expect(setTimeout.mock.calls.some(([, delay]) => delay === HERO_SWITCH_DELAY_MS)).toBe(false);
    act(() => vi.advanceTimersByTime(HERO_SWITCH_DELAY_MS * 3));
    expect(within(rowOf("THE ZONE BIO")).getByText("Active")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("clears the switch timer on unmount", () => {
    const setTimeout = vi.spyOn(window, "setTimeout");
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    const { unmount } = render(<HeroSection />);
    const index = setTimeout.mock.calls.findLastIndex(([, delay]) => delay === HERO_SWITCH_DELAY_MS);
    expect(index).toBeGreaterThanOrEqual(0);
    const timer = setTimeout.mock.results[index]!.value;
    unmount();
    expect(clearTimeout).toHaveBeenCalledWith(timer);
  });

  it("toggles the traffic film with a labelled button", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
    const { container } = render(<HeroSection />);
    const video = container.querySelector("video")!;
    expect(video.getAttribute("aria-hidden")).toBe("true");
    expect(video.muted).toBe(true);
    const button = screen.getByRole("button", { name: "Play video" });
    Object.defineProperty(video, "paused", { configurable: true, get: () => false });
    fireEvent.click(button);
    expect(pause).toHaveBeenCalled();
    Object.defineProperty(video, "paused", { configurable: true, get: () => true });
    fireEvent.click(button);
    expect(play).toHaveBeenCalled();
  });
});
