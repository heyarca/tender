// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketUiProvider, useSelectedProvider } from "@/components/market/market-ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FIXTURE_EPOCH, type MarketId } from "@/lib/tender";
import { createTenderStore, TenderProvider, type TenderStore } from "@/lib/tender/client";

import { ProvidersSection } from "./providers-section";

const WALL = FIXTURE_EPOCH + 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(WALL);
  window.localStorage.clear();
  // jsdom has neither matchMedia nor scrollIntoView (used by focusSection and reduced-motion checks).
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
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function SelectedProbe({ marketId }: { marketId: MarketId }) {
  const [selected] = useSelectedProvider(marketId);
  return <output data-testid="selected">{selected ?? "none"}</output>;
}

function mount(marketId: MarketId = "sf-weather") {
  const store: TenderStore = createTenderStore();
  render(
    <TenderProvider store={store}>
      <TooltipProvider>
        <MarketUiProvider>
          <ProvidersSection marketId={marketId} />
          <SelectedProbe marketId={marketId} />
          <section id="routing">
            <h2 id="routing-title">Routing policy</h2>
          </section>
          <section id="conditions">
            <h2 id="conditions-title">Provider conditions</h2>
          </section>
        </MarketUiProvider>
      </TooltipProvider>
    </TenderProvider>,
  );
  return store;
}

const rowIds = () =>
  Array.from(document.querySelectorAll<HTMLTableRowElement>("[data-slot=providers-table] tbody tr")).map(
    (tr) => tr.dataset.provider ?? `divider:${tr.textContent?.trim()}`,
  );
const row = (id: string) => document.querySelector<HTMLTableRowElement>(`[data-provider="${id}"]`)!;
const decision = () => document.querySelector<HTMLElement>("[data-slot=routing-decision]")!;

describe("ProvidersSection", () => {
  it("renders the weather bids in routing order with statuses, tags, and the decision", () => {
    mount();
    expect(screen.getByRole("heading", { name: "Providers", level: 2 })).toBeTruthy();
    expect(rowIds()).toEqual([
      "together",
      "deepinfra",
      "fireworks",
      "digitalocean",
      "divider:Excluded by your policy (4)",
      "nebius",
      "mistral",
      "cloudflare",
      "modal",
    ]);
    const together = within(row("together"));
    expect(together.getByText("Active", { selector: "[data-tag=active]" })).toBeTruthy();
    expect(together.getByText("Best price")).toBeTruthy();
    expect(together.getByText("$18.00")).toBeTruthy();
    expect(row("cloudflare").querySelector("[data-slot=status-badge]")?.textContent).toBe("Too slow");
    expect(row("cloudflare").querySelector("[data-slot=status-badge]")?.getAttribute("aria-label")).toBe(
      "Too slow. P95 640 ms exceeds 400 ms.",
    );
    expect(row("modal").querySelector("[data-slot=status-badge]")?.textContent).toBe("Stale data");
    expect(row("mistral").querySelector("[data-slot=status-badge]")?.textContent).toBe("Over budget");
    expect(row("nebius").querySelector("[data-slot=status-badge]")?.textContent).toBe("Unavailable");
    expect(within(row("deepinfra")).getByText("Rank #2 standby")).toBeTruthy();
    expect(screen.getByText(/of 8 qualify/).textContent).toBe("4 of 8 qualify");
    expect(decision().dataset.kind).toBe("routing");
    expect(within(decision()).getByRole("heading", { name: "Routing to Together" })).toBeTruthy();
    expect(within(decision()).getByText(/Cloudflare is cheaper/)).toBeTruthy();
  });

  it("renders the Bitcoin market defaults", () => {
    mount("btc-usd");
    expect(rowIds()[0]).toBe("parasail");
    expect(row("novita").dataset.status).toBe("too-slow");
    expect(row("crusoe").dataset.status).toBe("stale-data");
    expect(row("gmicloud").dataset.status).toBe("over-budget");
    expect(row("wafer").dataset.status).toBe("unreliable");
    expect(screen.getByRole("button", { name: /Max data age 1,000 ms/ })).toBeTruthy();
  });

  it("re-ranks when the routing preference changes", () => {
    mount();
    fireEvent.click(screen.getByRole("radio", { name: "Lowest latency" }));
    expect(rowIds()[0]).toBe("fireworks");
    expect(row("fireworks").dataset.role).toBe("active");
    expect(within(decision()).getByRole("heading").textContent).toBe("Routing to Fireworks");
    // Best price still marks the cheapest qualified provider.
    expect(within(row("together")).getByText("Best price")).toBeTruthy();
  });

  it("selects a provider on row click and clears it on a second click", () => {
    mount();
    fireEvent.click(row("fireworks"));
    expect(screen.getByTestId("selected").textContent).toBe("fireworks");
    expect(row("fireworks").dataset.state).toBe("selected");
    expect(within(row("fireworks")).getByRole("button", { name: "Fireworks, select to inspect" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(row("fireworks"));
    expect(screen.getByTestId("selected").textContent).toBe("none");
  });

  it("fails over when the active provider stops qualifying", () => {
    const store = mount();
    act(() => store.actions.updateProvider("sf-weather", "together", { p95LatencyMs: 520 }));
    expect(rowIds()[0]).toBe("deepinfra");
    expect(row("together").dataset.status).toBe("too-slow");
    expect(rowIds().indexOf("together")).toBeGreaterThan(rowIds().findIndex((id) => id.startsWith("divider")));
    expect(within(decision()).getByRole("heading").textContent).toBe("Routing to DeepInfra");
    expect(document.querySelector("[aria-live=polite]")?.textContent).toBe("Routing to DeepInfra");
  });

  it("shows the cooldown countdown for an optimization switch", () => {
    const store = mount();
    act(() => store.actions.updateProvider("sf-weather", "together", { p95LatencyMs: 640 }));
    act(() => store.actions.updateProvider("sf-weather", "together", { p95LatencyMs: 210 }));
    expect(decision().dataset.kind).toBe("pending-switch");
    expect(within(decision()).getByText("Switching to Together in 10 s — switch cooldown")).toBeTruthy();
    expect(within(row("together")).getByText("Next in 10 s")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(within(decision()).getByText("Switching to Together in 7 s — switch cooldown")).toBeTruthy();
    fireEvent.click(within(decision()).getByRole("button", { name: "Switch now" }));
    expect(rowIds()[0]).toBe("together");
    expect(decision().dataset.kind).toBe("routing");
  });

  it("surfaces a failing pinned provider with explicit actions", () => {
    const store = mount();
    act(() => store.actions.setRoutingMode("sf-weather", { kind: "pinned", providerId: "cloudflare" }));
    expect(rowIds()[0]).toBe("cloudflare");
    expect(within(row("cloudflare")).getByText("Pinned, failing")).toBeTruthy();
    expect(decision().dataset.kind).toBe("pinned-failing");
    expect(screen.getByRole("button", { name: /Pinned to Cloudflare/ })).toBeTruthy();
    fireEvent.click(within(decision()).getByRole("button", { name: "Switch to Together" }));
    expect(decision().dataset.kind).toBe("pinned");
    expect(within(decision()).getByRole("heading").textContent).toBe("Pinned to Together");
    fireEvent.click(within(decision()).getByRole("button", { name: "Use automatic switching" }));
    expect(decision().dataset.kind).toBe("routing");
  });

  it("explains No eligible provider and offers to relax the policy", () => {
    const store = mount();
    act(() => store.actions.setPolicy("sf-weather", { maxP95LatencyMs: 100 }));
    expect(decision().dataset.kind).toBe("no-eligible");
    expect(screen.getByText(/of 8 qualify/).textContent).toBe("0 of 8 qualify");
    expect(rowIds()[0]).toBe("divider:Excluded by your policy (8)");
    expect(within(decision()).getByText("P95 640 ms exceeds 100 ms")).toBeTruthy();
    fireEvent.click(within(decision()).getByRole("button", { name: "Relax policy" }));
    expect(document.activeElement?.id).toBe("routing-title");
    fireEvent.click(within(decision()).getByRole("button", { name: "Reset policy" }));
    expect(decision().dataset.kind).toBe("routing");
  });

  it("opens the routing policy from a policy chip", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Max price $40.00 /M req. Edit routing policy" }));
    expect(document.activeElement?.id).toBe("routing-title");
  });

  it("sorts inside each group and returns to routing order", () => {
    mount();
    const bid = screen.getByRole("button", { name: /^Bid/ });
    fireEvent.click(bid);
    fireEvent.click(bid);
    expect(rowIds().slice(0, 4)).toEqual(["digitalocean", "fireworks", "deepinfra", "together"]);
    expect(bid.closest("th")?.getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(bid);
    expect(rowIds()[0]).toBe("together");
  });
});
