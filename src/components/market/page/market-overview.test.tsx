// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createInitialState, selectMarketViewFromState, type MarketView } from "@/lib/tender";
import { createTenderStore, TenderProvider, useMarketView, type TenderActions, type TenderStore } from "@/lib/tender/client";
import { buildPaletteGroups } from "./market-command-palette";
import { MarketOverview } from "./market-overview";

beforeAll(() => {
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
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  // The store persists policies; keep tests independent.
  window.localStorage.clear();
});

function makeStore(): TenderStore {
  const initialState = createInitialState();
  let now = initialState.now;
  return createTenderStore({ initialState, clock: () => (now += 1000) });
}

function Overview({ marketId }: { marketId: "sf-weather" | "btc-usd" }) {
  const view = useMarketView(marketId);
  return <MarketOverview view={view} />;
}

function renderOverview(store: TenderStore, marketId: "sf-weather" | "btc-usd" = "sf-weather") {
  return render(
    <TenderProvider store={store}>
      <TooltipProvider>
        <Overview marketId={marketId} />
      </TooltipProvider>
    </TenderProvider>,
  );
}

describe("MarketOverview", () => {
  it("summarizes the active route and the latest result", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout"] });
    const { container } = renderOverview(makeStore());
    const card = container.querySelector('[data-slot="active-provider"]')!;
    expect(card.textContent).toContain("Together");
    expect(card.textContent).toContain("Automatic");
    expect(screen.getByText("$18.00")).toBeTruthy();
    expect(container.textContent).toContain("Max 400 ms");
    expect(container.textContent).toContain("Min 99.50%");
    expect(container.textContent).toContain("Latest result");
    expect(container.textContent).toContain("Served by");
  });

  it("highlights the new provider after a failover and shows the next request on it", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout"] });
    const store = makeStore();
    const { container } = renderOverview(store);
    act(() => store.actions.updateProvider("sf-weather", "together", { p95LatencyMs: 640 }));
    const card = container.querySelector('[data-slot="active-provider"]')!;
    expect(card.textContent).toContain("DeepInfra");
    expect(card.getAttribute("data-highlight")).toBe("true");
    act(() => store.actions.runRequest("sf-weather"));
    expect(container.textContent).toMatch(/Served by\s*DeepInfra/);
    act(() => vi.advanceTimersByTime(2000));
    expect(card.hasAttribute("data-highlight")).toBe(false);
  });

  it("shows when no provider is eligible and the request is not sent", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout"] });
    const store = makeStore();
    const { container } = renderOverview(store);
    act(() => store.actions.setPolicy("sf-weather", { maxPrice: 1 }));
    act(() => store.actions.runRequest("sf-weather"));
    const card = container.querySelector('[data-slot="active-provider"]')!;
    expect(card.textContent).toContain("No eligible provider");
    expect(card.textContent).toContain("No route");
    expect(container.textContent).toContain("No eligible provider — request not sent");
  });

  it("renders the BTC price chart", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout"] });
    const { container } = renderOverview(makeStore(), "btc-usd");
    expect(container.textContent).toContain("BTC/USD");
    expect(container.querySelector('[aria-label^="Price chart"]')).toBeTruthy();
    expect(container.textContent).toContain("THE ZONE BIO");
  });
});

describe("command palette groups", () => {
  function setup(view: MarketView) {
    const actions = {
      runRequest: vi.fn(),
      setAutoRun: vi.fn(),
      setPolicy: vi.fn(),
      setRoutingMode: vi.fn(),
      resetPolicy: vi.fn(),
      updateProvider: vi.fn(),
      restoreProvider: vi.fn(),
      resetConditions: vi.fn(),
      switchToRecommended: vi.fn(),
    } satisfies TenderActions;
    const callbacks = { onSwitchMarket: vi.fn(), onOpenApi: vi.fn(), onSelectProvider: vi.fn() };
    const groups = buildPaletteGroups({ view, actions, ...callbacks });
    const item = (id: string) => groups.flatMap((group) => group.items).find((entry) => entry.id === id);
    return { groups, actions, callbacks, item };
  }

  function viewOf(store: TenderStore, marketId: "sf-weather" | "btc-usd" = "sf-weather"): MarketView {
    return selectMarketViewFromState(store.api.getState(), marketId);
  }

  it("lists markets, sections, providers with logos, and actions", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout"] });
    const { groups, item } = setup(viewOf(makeStore()));
    expect(groups.map((group) => group.heading)).toEqual(["Markets", "On this page", "Providers", "Actions"]);
    expect(item("provider:deepinfra")).toMatchObject({ label: "DeepInfra", image: "/providers/deepinfra.webp" });
    expect(item("action:automatic")).toBeUndefined();
  });

  it("runs actions against the current market", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout"] });
    const { actions, callbacks, item } = setup(viewOf(makeStore(), "btc-usd"));
    item("action:run")!.onSelect();
    expect(actions.runRequest).toHaveBeenCalledWith("btc-usd");
    item("action:preference:freshest-data")!.onSelect();
    expect(actions.setPolicy).toHaveBeenCalledWith("btc-usd", { preference: "freshest-data" });
    item("action:reset-conditions")!.onSelect();
    expect(actions.resetConditions).toHaveBeenCalledWith("btc-usd");
    item("action:auto-run")!.onSelect();
    expect(actions.setAutoRun).toHaveBeenCalledWith("btc-usd", true);
    item("provider:coreweave")!.onSelect();
    expect(callbacks.onSelectProvider).toHaveBeenCalledWith("coreweave");
    item("market:sf-weather")!.onSelect();
    expect(callbacks.onSwitchMarket).toHaveBeenCalledWith("sf-weather");
  });

  it("offers automatic switching while a provider is pinned", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout"] });
    const store = makeStore();
    store.actions.setRoutingMode("sf-weather", { kind: "pinned", providerId: "fireworks" });
    const { actions, item } = setup(viewOf(store));
    item("action:automatic")!.onSelect();
    expect(actions.setRoutingMode).toHaveBeenCalledWith("sf-weather", { kind: "auto" });
  });
});
