// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketUiProvider, useSelectedProvider } from "@/components/market/market-ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FIXTURE_EPOCH, type MarketId } from "@/lib/tender";
import { createTenderStore, TenderProvider, type TenderStore } from "@/lib/tender/client";

import { ProvidersSection } from "./providers-section";

// `DataGrid` loads AG Grid when it nears the viewport (jsdom has no IntersectionObserver); render the grid itself.
vi.mock("@/components/ui/data-grid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/data-grid")>();
  const { DataGridCore } = await import("@/components/ui/data-grid-core");
  return { ...actual, DataGrid: DataGridCore };
});

const WALL = FIXTURE_EPOCH + 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(WALL);
  window.localStorage.clear();
  // jsdom has neither matchMedia nor scrollIntoView (used by focusSection and reduced-motion checks).
  // Width queries match (a desktop viewport, so the provider column is not pinned); reduced motion does not.
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width"),
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

/** Grid rows in display order (AG Grid keeps DOM order stable and positions rows by `row-index`). */
const rowIds = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-slot=providers-table] .ag-row[row-id]"))
    .sort((a, b) => Number(a.getAttribute("row-index")) - Number(b.getAttribute("row-index")))
    .map((el) => {
      const id = el.getAttribute("row-id")!;
      return id === "excluded-divider" ? `divider:${el.textContent?.trim()}` : id;
    });
const row = (id: string) => document.querySelector<HTMLElement>(`[data-slot=providers-table] .ag-row[row-id="${id}"]`)!;
/** The provider cell, which carries `data-role` and `data-status`. */
const provider = (id: string) => row(id).querySelector<HTMLElement>(`[data-provider="${id}"]`)!;
const header = (colId: string) => document.querySelector<HTMLElement>(`[data-slot=providers-table] .ag-header-cell[col-id="${colId}"]`)!;
const decision = () => document.querySelector<HTMLElement>("[data-slot=routing-decision]")!;

describe("ProvidersSection", () => {
  it("renders the weather bids in routing order with statuses, tags, and the decision", () => {
    mount();
    expect(screen.getByRole("heading", { name: "Providers", level: 2 })).toBeTruthy();
    expect(rowIds()).toEqual([
      "fernline",
      "kitefin",
      "cinderlane",
      "saltmarsh",
      "divider:Excluded by your policy (4)",
      "kelpwave",
      "owlbridge",
      "slatework",
      "mossgate",
    ]);
    const fernline = within(row("fernline"));
    expect(fernline.getByText("Active", { selector: "[data-tag=active]" })).toBeTruthy();
    expect(fernline.getByText("Best price")).toBeTruthy();
    expect(fernline.getByText("$18.00")).toBeTruthy();
    expect(row("slatework").querySelector("[data-slot=status-badge]")?.textContent).toBe("Too slow");
    expect(row("slatework").querySelector("[data-slot=status-badge]")?.getAttribute("aria-label")).toBe(
      "Too slow. P95 640 ms exceeds 400 ms.",
    );
    expect(row("mossgate").querySelector("[data-slot=status-badge]")?.textContent).toBe("Stale data");
    expect(row("owlbridge").querySelector("[data-slot=status-badge]")?.textContent).toBe("Over budget");
    expect(row("kelpwave").querySelector("[data-slot=status-badge]")?.textContent).toBe("Unavailable");
    expect(row("kitefin").querySelector("[col-id=route]")?.textContent).toBe("Rank #2 standby");
    expect(screen.getByText(/of 8 qualify/).textContent).toBe("4 of 8 qualify");
    expect(decision().dataset.kind).toBe("routing");
    expect(within(decision()).getByRole("heading", { name: "Routing to Fernline" })).toBeTruthy();
    expect(within(decision()).getByText(/Slatework is cheaper/)).toBeTruthy();
  });

  it("renders the Bitcoin market defaults", () => {
    mount("btc-usd");
    expect(rowIds()[0]).toBe("the-zone-bio");
    expect(provider("brindlewood").dataset.status).toBe("too-slow");
    expect(provider("hollowbrook").dataset.status).toBe("stale-data");
    expect(provider("basaltine").dataset.status).toBe("over-budget");
    expect(provider("heronway").dataset.status).toBe("unreliable");
    expect(screen.getByRole("button", { name: /Max data age 1,000 ms/ })).toBeTruthy();
  });

  it("re-ranks when the routing preference changes", () => {
    mount();
    fireEvent.click(screen.getByRole("radio", { name: "Lowest latency" }));
    expect(rowIds()[0]).toBe("cinderlane");
    expect(provider("cinderlane").dataset.role).toBe("active");
    expect(within(decision()).getByRole("heading").textContent).toBe("Routing to Cinderlane");
    // Best price still marks the cheapest qualified provider.
    expect(within(row("fernline")).getByText("Best price")).toBeTruthy();
  });

  it("selects a provider on row click and clears it on a second click", () => {
    mount();
    fireEvent.click(row("cinderlane"));
    expect(screen.getByTestId("selected").textContent).toBe("cinderlane");
    expect(row("cinderlane").classList.contains("ag-row-selected")).toBe(true);
    expect(row("cinderlane").querySelector('button[aria-label="Cinderlane, select to inspect"]')?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(row("cinderlane"));
    expect(screen.getByTestId("selected").textContent).toBe("none");
  });

  it("fails over when the active provider stops qualifying", () => {
    const store = mount();
    act(() => store.actions.updateProvider("sf-weather", "fernline", { p95LatencyMs: 520 }));
    expect(rowIds()[0]).toBe("kitefin");
    expect(provider("fernline").dataset.status).toBe("too-slow");
    expect(rowIds().indexOf("fernline")).toBeGreaterThan(rowIds().findIndex((id) => id.startsWith("divider")));
    expect(within(decision()).getByRole("heading").textContent).toBe("Routing to Kitefin");
    expect(document.querySelector("[aria-live=polite]")?.textContent).toBe("Routing to Kitefin");
  });

  it("shows the cooldown countdown for an optimization switch", () => {
    const store = mount();
    act(() => store.actions.updateProvider("sf-weather", "fernline", { p95LatencyMs: 640 }));
    act(() => store.actions.updateProvider("sf-weather", "fernline", { p95LatencyMs: 210 }));
    expect(decision().dataset.kind).toBe("pending-switch");
    expect(within(decision()).getByText("Switching to Fernline in 10 s — switch cooldown")).toBeTruthy();
    expect(within(row("fernline")).getByText("Next in 10 s")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(within(decision()).getByText("Switching to Fernline in 7 s — switch cooldown")).toBeTruthy();
    fireEvent.click(within(decision()).getByRole("button", { name: "Switch now" }));
    expect(rowIds()[0]).toBe("fernline");
    expect(decision().dataset.kind).toBe("routing");
  });

  it("surfaces a failing pinned provider with explicit actions", () => {
    const store = mount();
    act(() => store.actions.setRoutingMode("sf-weather", { kind: "pinned", providerId: "slatework" }));
    expect(rowIds()[0]).toBe("slatework");
    expect(within(row("slatework")).getByText("Pinned, failing")).toBeTruthy();
    expect(decision().dataset.kind).toBe("pinned-failing");
    expect(screen.getByRole("button", { name: /Pinned to Slatework/ })).toBeTruthy();
    fireEvent.click(within(decision()).getByRole("button", { name: "Switch to Fernline" }));
    expect(decision().dataset.kind).toBe("pinned");
    expect(within(decision()).getByRole("heading").textContent).toBe("Pinned to Fernline");
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
    const bid = header("bid");
    fireEvent.click(bid);
    fireEvent.click(bid);
    expect(rowIds().slice(0, 4)).toEqual(["saltmarsh", "cinderlane", "kitefin", "fernline"]);
    expect(bid.getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(bid);
    expect(rowIds()[0]).toBe("fernline");
  });
});
