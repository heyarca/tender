// @vitest-environment jsdom
import { act, render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_EPOCH, POLICIES_STORAGE_KEY } from "./constants";
import { createTenderStore, TenderProvider, useMarketView, useNow, useRouteEvents, useTenderActions, type TenderActions, type TenderStore } from "./store";
import type { RouteEvent } from "./types";

const WALL = FIXTURE_EPOCH + 3 * 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(WALL);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount(store: TenderStore = createTenderStore()) {
  const renders = { view: 0, now: 0 };
  const events: RouteEvent[] = [];
  let actions!: TenderActions;
  function ViewProbe() {
    useMarketView("sf-weather");
    renders.view += 1;
    return null;
  }
  function NowProbe() {
    useNow();
    renders.now += 1;
    return null;
  }
  function EventProbe() {
    actions = useTenderActions();
    useRouteEvents("sf-weather", (event) => events.push(event));
    return null;
  }
  render(
    <TenderProvider store={store}>
      <ViewProbe />
      <NowProbe />
      <EventProbe />
    </TenderProvider>,
  );
  return { store, renders, events, actions: () => actions };
}

describe("TenderProvider", () => {
  it("rebases to the wall clock after mount", () => {
    const { store } = mount();
    const state = store.api.getState();
    expect(state.rebased).toBe(true);
    expect(state.now).toBe(WALL);
    expect(state.markets["sf-weather"].route.activeProviderId).toBe("together");
  });

  it("ticks the clock without re-rendering market views", () => {
    const { store, renders } = mount();
    const view = renders.view;
    const now = renders.now;
    for (let i = 0; i < 3; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
    }
    expect(store.api.getState().now).toBe(WALL + 3_000);
    expect(renders.now).toBe(now + 3);
    expect(renders.view).toBe(view);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    // The 5 s monitor tick adds samples, so the view updates once.
    expect(renders.view).toBe(view + 1);
  });

  it("reports each route event once", () => {
    const { events, actions } = mount();
    act(() => actions().updateProvider("sf-weather", "together", { p95LatencyMs: 640 }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "route-switch", fromProviderId: "together", toProviderId: "deepinfra", trigger: "failover" });
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(events).toHaveLength(1);
    act(() => actions().setPolicy("sf-weather", { maxPrice: 5 }));
    expect(events.map((e) => e.kind)).toEqual(["route-switch", "no-eligible"]);
  });

  it("executes a pending switch when the cooldown ends", () => {
    const { store, actions } = mount();
    act(() => actions().updateProvider("sf-weather", "together", { p95LatencyMs: 640 }));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    act(() => actions().updateProvider("sf-weather", "together", { p95LatencyMs: 210 }));
    expect(store.api.getState().markets["sf-weather"].route.pending?.providerId).toBe("together");
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    const route = store.api.getState().markets["sf-weather"].route;
    expect(route.activeProviderId).toBe("together");
    expect(route.pending).toBeNull();
  });

  it("drives auto-run every 2 s", () => {
    const { store, actions } = mount();
    act(() => actions().setAutoRun("btc-usd", true));
    expect(store.api.getState().markets["btc-usd"].counters.total).toBe(2);
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(store.api.getState().markets["btc-usd"].counters.total).toBe(5);
  });

  it("persists policies and rehydrates them on the next mount", () => {
    const first = mount();
    act(() => first.actions().setPolicy("btc-usd", { maxPrice: 1.2, preference: "freshest-data" }));
    act(() => first.actions().setRoutingMode("sf-weather", { kind: "pinned", providerId: "fireworks" }));
    const stored = JSON.parse(window.localStorage.getItem(POLICIES_STORAGE_KEY)!);
    expect(stored.policies["btc-usd"]).toMatchObject({ maxPrice: 1.2, preference: "freshest-data" });
    expect(stored.policies["sf-weather"].mode).toEqual({ kind: "pinned", providerId: "fireworks" });
    cleanup();

    const second = mount();
    const state = second.store.api.getState();
    expect(state.policiesHydrated).toBe(true);
    expect(state.markets["btc-usd"].policy).toMatchObject({ maxPrice: 1.2, preference: "freshest-data" });
    // CoreWeave and Baseten bid above $1.20, so Arca Labs has the freshest qualifying data.
    expect(state.markets["btc-usd"].route.activeProviderId).toBe("arca-labs");
    expect(state.markets["sf-weather"].route.activeProviderId).toBe("fireworks");
    // Restoring saved policies does not raise toasts.
    expect(second.events).toHaveLength(0);
  });
});
