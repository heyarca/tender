// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ActivitySection } from "@/components/market/activity/activity-section";
import { ProviderConditionsSection } from "@/components/market/conditions/provider-conditions-section";
import { MarketUiProvider } from "@/components/market/market-ui";
import { RoutingPolicySection } from "@/components/market/policy/routing-policy-section";
import { FIXTURE_EPOCH } from "@/lib/tender";
import { createTenderStore, TenderProvider, type TenderStore } from "@/lib/tender/client";

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

function setup(children: ReactNode): TenderStore {
  let now = FIXTURE_EPOCH;
  const store = createTenderStore({ clock: () => (now += 1_000) });
  render(
    <TenderProvider store={store}>
      <MarketUiProvider>{children}</MarketUiProvider>
    </TenderProvider>,
  );
  return store;
}

const sf = (store: TenderStore) => store.api.getState().markets["sf-weather"];

function commit(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("RoutingPolicySection", () => {
  it("applies a typed limit on Enter and explains the effect", () => {
    const store = setup(<RoutingPolicySection marketId="sf-weather" />);
    const section = document.getElementById("routing")!;
    expect(within(section).getByText("4 of 8 qualify")).toBeTruthy();

    commit(within(section).getByRole("textbox", { name: "Max P95 latency" }), "700");
    expect(sf(store).policy.maxP95LatencyMs).toBe(700);
    expect(sf(store).route.activeProviderId).toBe("slatework");
    expect(within(section).getByText("5 of 8 qualify")).toBeTruthy();
    expect(within(section).getByText("Slatework now qualifies.")).toBeTruthy();
    expect(
      within(section).getByText("Route switched from Fernline to Slatework, which ranks first for lowest cost."),
    ).toBeTruthy();

    fireEvent.click(within(section).getByRole("button", { name: /Reset max p95 latency to the default, 400 ms/ }));
    expect(sf(store).policy.maxP95LatencyMs).toBe(400);
  });

  it("converts weather data age from minutes", () => {
    const store = setup(<RoutingPolicySection marketId="sf-weather" />);
    const section = document.getElementById("routing")!;
    commit(within(section).getByRole("textbox", { name: "Max data age" }), "45");
    expect(sf(store).policy.maxDataAgeMs).toBe(45 * 60_000);
  });

  it("changes preference and mode, and resets the policy", () => {
    const store = setup(<RoutingPolicySection marketId="sf-weather" />);
    const section = document.getElementById("routing")!;
    fireEvent.click(within(section).getByRole("radio", { name: "Lowest latency" }));
    expect(sf(store).policy.preference).toBe("lowest-latency");
    expect(sf(store).route.activeProviderId).toBe("cinderlane");

    fireEvent.click(within(section).getByRole("radio", { name: "Pin a provider" }));
    expect(sf(store).policy.mode).toEqual({ kind: "pinned", providerId: "cinderlane" });
    expect(within(section).getByRole("combobox", { name: "Pinned provider" }).textContent).toContain("Cinderlane");

    fireEvent.click(within(section).getByRole("button", { name: "Reset policy" }));
    expect(sf(store).policy.preference).toBe("lowest-cost");
    expect(sf(store).policy.mode).toEqual({ kind: "auto" });
  });

  it("surfaces a failing pinned provider with explicit actions", () => {
    const store = setup(<RoutingPolicySection marketId="sf-weather" />);
    act(() => store.actions.setRoutingMode("sf-weather", { kind: "pinned", providerId: "slatework" }));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Pinned provider Slatework fails your policy: P95 640 ms exceeds 400 ms.");
    fireEvent.click(within(alert).getByRole("button", { name: "Switch to Fernline" }));
    expect(sf(store).policy.mode).toEqual({ kind: "pinned", providerId: "fernline" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows BTC limits in milliseconds", () => {
    setup(<RoutingPolicySection marketId="btc-usd" />);
    const input = screen.getByRole("textbox", { name: "Max data age" }) as HTMLInputElement;
    expect(input.value).toBe("1,000");
    expect(screen.getByText("Default 1,000 ms")).toBeTruthy();
  });
});

describe("ProviderConditionsSection", () => {
  it("edits the serving provider, keeps it selected after failover, and explains the switch", () => {
    const store = setup(<ProviderConditionsSection marketId="sf-weather" />);
    const section = document.getElementById("conditions")!;
    expect(within(section).getByRole("combobox", { name: "Provider" }).textContent).toContain("Fernline");

    fireEvent.click(within(section).getByRole("button", { name: "Add 300 ms latency" }));
    const fernline = sf(store).providers.find((p) => p.id === "fernline")!;
    expect(fernline.conditions.p95LatencyMs).toBe(510);
    expect(sf(store).route.activeProviderId).toBe("kitefin");
    expect(within(section).getByRole("combobox", { name: "Provider" }).textContent).toContain("Fernline");
    expect(within(section).getByText("Fernline no longer qualifies: P95 510 ms exceeds 400 ms.")).toBeTruthy();
    expect(
      within(section).getByText("Route switched from Fernline to Kitefin, which ranks first for lowest cost."),
    ).toBeTruthy();

    fireEvent.click(within(section).getByRole("button", { name: "Restore provider Fernline to default conditions" }));
    expect(sf(store).providers.find((p) => p.id === "fernline")!.conditions.p95LatencyMs).toBe(210);
  });

  it("submits a bid only with Update bid", () => {
    const store = setup(<ProviderConditionsSection marketId="sf-weather" />);
    const section = document.getElementById("conditions")!;
    const update = within(section).getByRole("button", { name: "Update bid" }) as HTMLButtonElement;
    expect(update.disabled).toBe(true);
    fireEvent.change(within(section).getByRole("textbox", { name: "Bid" }), { target: { value: "45" } });
    expect(update.disabled).toBe(false);
    expect(sf(store).providers.find((p) => p.id === "fernline")!.conditions.bidPrice).toBe(18);
    fireEvent.click(update);
    expect(sf(store).providers.find((p) => p.id === "fernline")!.conditions.bidPrice).toBe(45);
    expect(within(section).getByText("Fernline no longer qualifies: Bid $45.00 exceeds $40.00 /M.")).toBeTruthy();
  });

  it("takes a provider offline and resets every provider", () => {
    const store = setup(<ProviderConditionsSection marketId="sf-weather" />);
    const section = document.getElementById("conditions")!;
    fireEvent.click(within(section).getByRole("button", { name: "Take offline" }));
    expect(sf(store).providers.find((p) => p.id === "fernline")!.conditions.available).toBe(false);
    expect(within(section).getByRole("switch").getAttribute("aria-checked")).toBe("false");
    fireEvent.click(within(section).getByRole("button", { name: /Reset conditions for all providers/ }));
    expect(sf(store).providers.find((p) => p.id === "fernline")!.conditions.available).toBe(true);
  });
});

describe("ActivitySection", () => {
  it("filters entries and shows an empty state", () => {
    const store = setup(<ActivitySection marketId="sf-weather" />);
    const section = document.getElementById("activity")!;
    fireEvent.click(within(section).getByRole("radio", { name: /^Policy/ }));
    expect(within(section).getByText("No policy changes")).toBeTruthy();
    act(() => store.actions.setPolicy("sf-weather", { maxP95LatencyMs: 700 }));
    expect(within(section).getByText("Policy updated: max P95 latency 400 ms → 700 ms")).toBeTruthy();
    fireEvent.click(within(section).getByRole("radio", { name: /^Routing/ }));
    const switchRow = section.querySelector('li[data-kind="route-switch"]')!;
    expect(switchRow.textContent).toContain("Switched from Fernline to Slatework");
    expect(switchRow.textContent).toContain("Policy change");
    expect(switchRow.textContent).toContain("Why Slatework qualifies:");
    expect(switchRow.textContent).toContain("P95 640 ms ≤ 700 ms");
  });

  it("paginates 20 entries at a time", () => {
    const store = setup(<ActivitySection marketId="sf-weather" />);
    act(() => {
      for (let i = 0; i < 30; i++) store.actions.runRequest("sf-weather");
    });
    const section = document.getElementById("activity")!;
    expect(section.querySelectorAll("li[data-kind]")).toHaveLength(20);
    fireEvent.click(within(section).getByRole("button", { name: "Show 12 more" }));
    expect(section.querySelectorAll("li[data-kind]")).toHaveLength(32);
    expect(within(section).queryByRole("button", { name: /more$/ })).toBeNull();
  });
});
