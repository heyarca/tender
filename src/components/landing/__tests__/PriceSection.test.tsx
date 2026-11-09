// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_EPOCH, getInitialMarketView } from "@/lib/tender";
import { createTenderStore, TenderProvider, type TenderStore } from "@/lib/tender/client";

import { PRICE_STEPS, PriceSection, priceStepsDone, stillExcluded } from "../PriceSection";

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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount() {
  const store: TenderStore = createTenderStore();
  render(
    <TenderProvider store={store}>
      <PriceSection />
    </TenderProvider>,
  );
  return store;
}

const section = () => document.getElementById("better-prices")!;
const button = (name: string | RegExp) => within(section()).getByRole("button", { name });
const stat = (label: string) => within(section()).getByText(label).parentElement!.textContent;
const btc = (store: TenderStore) => store.api.getState().markets["btc-usd"];
const bid = (store: TenderStore, id: string) => btc(store).providers.find((provider) => provider.id === id)!.conditions.bidPrice;

describe("PriceSection", () => {
  it("renders the approved copy, the live prices, and the excluded offers", () => {
    mount();
    expect(screen.getByRole("heading", { level: 2, name: /Pay less for API calls\s*that meet your requirements\./ })).toBeTruthy();
    expect(screen.getByText(/Tender selects the lowest-priced eligible provider and reevaluates as prices change\./)).toBeTruthy();
    expect(screen.getByText("Providers that are too slow, too stale, or unreliable remain excluded.")).toBeTruthy();
    expect(stat("Current price")).toContain("$0.70");
    expect(stat("Current price")).toContain("THE ZONE BIO");
    expect(stat("Best eligible offer")).toContain("$0.70");
    const offers = within(section()).getAllByRole("listitem").filter((item) => item.textContent?.includes("/M req"));
    expect(offers.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^NovitaAI\$0\.40\/M reqToo slow/),
      expect.stringMatching(/^Crusoe\$0\.55\/M reqStale data/),
      expect.stringMatching(/^Wafer\$0\.60\/M reqUnreliable/),
    ]);
  });

  it("does not change the store on mount", () => {
    const store = mount();
    expect(bid(store, "arca-labs")).toBe(0.95);
    expect(bid(store, "the-zone-bio")).toBe(0.7);
    expect(button(/Arca Labs bids/).hasAttribute("disabled")).toBe(false);
    expect(button(/THE ZONE BIO counters/).hasAttribute("disabled")).toBe(true);
    expect(button("Reset").hasAttribute("disabled")).toBe(true);
  });

  it("switches at once on the first bid, then waits for the cooldown on the counter bid", () => {
    const store = mount();
    fireEvent.click(button(/Arca Labs bids/));
    expect(bid(store, "arca-labs")).toBe(0.65);
    expect(btc(store).route.activeProviderId).toBe("arca-labs");
    expect(stat("Current price")).toContain("$0.65");
    expect(stat("Current price")).toContain("Arca Labs");
    expect(screen.getByText("Switched from THE ZONE BIO to Arca Labs")).toBeTruthy();
    expect(button(/Arca Labs bids/).hasAttribute("disabled")).toBe(true);

    fireEvent.click(button(/THE ZONE BIO counters/));
    expect(bid(store, "the-zone-bio")).toBe(0.6);
    expect(btc(store).route.activeProviderId).toBe("arca-labs");
    expect(btc(store).route.pending?.providerId).toBe("the-zone-bio");
    expect(screen.getByText(/Switching to THE ZONE BIO in \d+ s/)).toBeTruthy();
    expect(within(section()).getByRole("progressbar", { name: "Switch cooldown" })).toBeTruthy();
    expect(stat("Current price")).toContain("$0.65");
    expect(stat("Best eligible offer")).toContain("$0.60");
    expect(stat("Best eligible offer")).toContain("THE ZONE BIO");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(btc(store).route.activeProviderId).toBe("the-zone-bio");
    expect(stat("Current price")).toContain("$0.60");
    expect(within(section()).queryByRole("progressbar")).toBeNull();

    fireEvent.click(button("Reset"));
    expect(bid(store, "arca-labs")).toBe(0.95);
    expect(bid(store, "the-zone-bio")).toBe(0.7);
    expect(button(/Arca Labs bids/).hasAttribute("disabled")).toBe(false);
  });
});

describe("price helpers", () => {
  it("derive the steps from the live bids", () => {
    const view = getInitialMarketView("btc-usd");
    expect(priceStepsDone(view)).toEqual([false, false]);
    const [first] = PRICE_STEPS;
    const row = view.providersById[first.providerId];
    const bumped = {
      ...view,
      providersById: { ...view.providersById, [first.providerId]: { ...row, conditions: { ...row.conditions, bidPrice: first.bid } } },
    };
    expect(priceStepsDone(bumped)).toEqual([true, false]);
  });

  it("list offers excluded by checks other than price, cheapest first", () => {
    expect(stillExcluded(getInitialMarketView("btc-usd")).map((row) => row.id)).toEqual(["novita", "crusoe", "wafer"]);
  });
});
