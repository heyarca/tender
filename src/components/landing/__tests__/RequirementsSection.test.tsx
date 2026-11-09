// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { FIXTURE_EPOCH } from "@/lib/tender";
import { createTenderStore, TenderProvider, type TenderStore } from "@/lib/tender/client";
import { LandingProductProviders } from "../LandingProductProviders";
import { REQUIREMENT_MODULES, RequirementsSection } from "../RequirementsSection";

beforeAll(() => {
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

function setup(): TenderStore {
  let now = FIXTURE_EPOCH;
  const store = createTenderStore({ clock: () => (now += 1_000) });
  render(
    <TenderProvider store={store}>
      <LandingProductProviders>
        <RequirementsSection />
      </LandingProductProviders>
    </TenderProvider>,
  );
  return store;
}

const triggers = () => REQUIREMENT_MODULES.map(({ title }) => screen.getByRole("button", { name: title }));
const expanded = () => triggers().map((trigger) => trigger.getAttribute("aria-expanded"));
const panel = () => document.querySelector<HTMLElement>("[data-requirement]")!;
const summary = () => document.querySelector<HTMLElement>("[data-tone]")!;

describe("RequirementsSection", () => {
  it("renders the approved copy and the real routing policy form", () => {
    setup();
    const section = document.getElementById("how-it-works")!;
    expect(within(section).getByRole("heading", { level: 2, name: "Make APIs competefor your traffic." })).toBeTruthy();
    expect(within(section).getByText(/^Set limits for price, response time, data age, and request success\./)).toBeTruthy();
    expect(triggers().map((trigger) => trigger.textContent)).toEqual([
      "Pay within your budget.",
      "Keep responses fast.",
      "Keep data fresh.",
      "Avoid unreliable providers.",
    ]);
    // The product section, embedded once, for the landing market (Bitcoin by default).
    expect(document.querySelectorAll("#routing")).toHaveLength(1);
    for (const { field } of REQUIREMENT_MODULES) {
      expect(document.querySelector(`[data-slot="spec-field"] input#policy-btc-usd-${field}`)).toBeTruthy();
    }
  });

  it("keeps exactly one module open and marks its policy field", () => {
    setup();
    expect(expanded()).toEqual(["true", "false", "false", "false"]);
    expect(panel().dataset.requirement).toBe("maxPrice");

    const [, , fresh] = triggers();
    const region = document.getElementById(fresh.getAttribute("aria-controls")!)!;
    expect(region.getAttribute("role")).toBe("region");
    expect(region.hasAttribute("inert")).toBe(true);

    fireEvent.click(fresh);
    expect(expanded()).toEqual(["false", "false", "true", "false"]);
    expect(region.hasAttribute("inert")).toBe(false);
    expect(within(region).getByText(/^Set a maximum data age\./)).toBeTruthy();
    expect(panel().dataset.requirement).toBe("maxDataAgeMs");
  });

  it("moves keyboard focus into the matching real input from “Set your limit”", () => {
    setup();
    fireEvent.click(triggers()[1]);
    const region = document.getElementById(triggers()[1].getAttribute("aria-controls")!)!;
    const link = within(region).getByRole("link", { name: "Set your limit" });
    expect(link.getAttribute("href")).toBe("#policy-btc-usd-maxP95LatencyMs");
    fireEvent.click(link);
    expect(document.activeElement?.id).toBe("policy-btc-usd-maxP95LatencyMs");
    expect(panel().dataset.requirement).toBe("maxP95LatencyMs");
  });

  it("opens the module of a policy field that receives focus", () => {
    setup();
    act(() => document.getElementById("policy-btc-usd-minSuccessRate")!.focus());
    expect(expanded()).toEqual(["false", "false", "false", "true"]);
    expect(panel().dataset.requirement).toBe("minSuccessRate");
  });

  it("moves between module buttons with the arrow keys", () => {
    setup();
    const list = triggers();
    act(() => list[0].focus());
    fireEvent.keyDown(list[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(list[1]);
    fireEvent.keyDown(list[1], { key: "End" });
    expect(document.activeElement).toBe(list[3]);
    fireEvent.keyDown(list[3], { key: "ArrowDown" });
    expect(document.activeElement).toBe(list[0]);
  });

  it("summarises the live route under the form", () => {
    const store = setup();
    expect(summary().textContent).toBe("4 of 8 providers qualify.THE ZONE BIO serves the next request.");
    expect(summary().dataset.tone).toBe("positive");

    act(() => store.actions.setPolicy("btc-usd", { maxPrice: 0 }));
    expect(summary().textContent).toBe("No provider qualifies.Requests wait until a provider meets your requirements.");
    expect(summary().dataset.tone).toBe("negative");

    act(() => store.actions.resetPolicy("btc-usd"));
    fireEvent.click(screen.getByRole("radio", { name: "San Francisco Weather" }));
    expect(document.querySelector("input#policy-sf-weather-maxPrice")).toBeTruthy();
    expect(summary().textContent).toBe("4 of 8 providers qualify.Together serves the next request.");
  });
});
