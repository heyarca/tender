// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { FIXTURE_EPOCH, getInitialMarketView } from "@/lib/tender";
import { createTenderStore, TenderProvider, type TenderStore } from "@/lib/tender/client";

import { LandingProductProviders } from "../LandingProductProviders";
import { freshnessBreach, latencyBreach, SwitchSection } from "../SwitchSection";

const WALL = FIXTURE_EPOCH + 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(WALL);
  window.localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount() {
  const store: TenderStore = createTenderStore();
  render(
    <TenderProvider store={store}>
      <TooltipProvider>
        <LandingProductProviders>
          <SwitchSection />
        </LandingProductProviders>
      </TooltipProvider>
    </TenderProvider>,
  );
  return store;
}

const section = () => document.getElementById("switch-providers")!;
const routeText = () => section().querySelector("[data-state]")!.textContent;
const button = (name: string) => within(section()).getByRole("button", { name });
const market = (store: TenderStore, id: "btc-usd" | "sf-weather" = "btc-usd") => store.api.getState().markets[id];
const conditions = (store: TenderStore, id: "btc-usd" | "sf-weather" = "btc-usd") =>
  Object.fromEntries(market(store, id).providers.map((provider) => [provider.id, provider.conditions]));

describe("SwitchSection", () => {
  it("renders the approved copy, the market link, and each product section once", () => {
    mount();
    expect(screen.getByRole("heading", { level: 2, name: /Switch API providers\s*when performance drops\./ })).toBeTruthy();
    expect(screen.getByText(/Tender checks the alternatives and switches to one that still meets your requirements\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open the Bitcoin market" }).getAttribute("href")).toBe("/markets/btc-usd");
    for (const id of ["providers", "conditions", "activity"]) {
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
    }
    expect(section().querySelectorAll("[aria-label='Market overview']")).toHaveLength(1);
    expect(routeText()).toContain("Routing to");
    expect(routeText()).toContain("THE ZONE BIO");
  });

  it("does not change the store on mount", () => {
    const store = mount();
    const before = conditions(store);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(conditions(store)).toEqual(before);
    expect(button("Reset").hasAttribute("disabled")).toBe(true);
  });

  it("raises the active provider's latency above the limit and fails over", () => {
    const store = mount();
    fireEvent.click(button("Raise latency"));
    const state = market(store);
    expect(conditions(store)["the-zone-bio"].p95LatencyMs).toBeGreaterThan(state.policy.maxP95LatencyMs);
    expect(state.route.activeProviderId).toBe("arca-labs");
    expect(routeText()).toContain("Arca Labs");
    expect(button("Reset").hasAttribute("disabled")).toBe(false);
  });

  it("makes the active provider's data stale, then resets the conditions", () => {
    const store = mount();
    fireEvent.click(button("Make data stale"));
    expect(conditions(store)["the-zone-bio"].dataAgeMs).toBeGreaterThan(market(store).policy.maxDataAgeMs);
    expect(market(store).route.activeProviderId).toBe("arca-labs");
    fireEvent.click(button("Reset"));
    expect(conditions(store)["the-zone-bio"].dataAgeMs).toBe(220);
  });

  it("acts on the market chosen in the window bar", () => {
    const store = mount();
    fireEvent.click(within(section()).getByRole("radio", { name: /San Francisco Weather/ }));
    expect(section().querySelector("#providers")!.getAttribute("data-market")).toBe("sf-weather");
    const weather = market(store, "sf-weather");
    const activeId = weather.route.activeProviderId!;
    fireEvent.click(button("Raise latency"));
    const after = market(store, "sf-weather");
    expect(conditions(store, "sf-weather")[activeId].p95LatencyMs).toBeGreaterThan(after.policy.maxP95LatencyMs);
    expect(after.route.activeProviderId).not.toBe(activeId);
    expect(conditions(store)).toEqual(conditions(createTenderStore()));
  });
});

describe("breach patches", () => {
  it("target twice the policy limit for the active provider", () => {
    const view = getInitialMarketView("btc-usd");
    expect(latencyBreach(view)).toEqual({ p95LatencyMs: view.policy.maxP95LatencyMs * 2 });
    expect(freshnessBreach(view)).toEqual({ dataAgeMs: view.policy.maxDataAgeMs * 2 });
  });

  it("return null without an active provider", () => {
    const view = getInitialMarketView("sf-weather");
    const none = { ...view, route: { ...view.route, activeProvider: null, activeProviderId: null } };
    expect(latencyBreach(none)).toBeNull();
    expect(freshnessBreach(none)).toBeNull();
  });
});
