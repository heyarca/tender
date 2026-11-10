// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTenderStore, TenderProvider } from "@/lib/tender/client";
import { SpendingLimitCard } from "./ask-cards";
vi.mock("@/components/credits/paypal-vault", () => ({ readVaultStatus: async () => ({ saved: false }), savePayPal: vi.fn() }));
const input = { marketId: "sf-weather", weeklyCapUsd: 5, policy: { maxPrice: 30, maxP95LatencyMs: 300 } };
beforeEach(() => { window.localStorage.clear(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the routed provider and requires an explicit Approve action to persist the limit", async () => {
  const store = createTenderStore();
  store.actions.setPolicy("sf-weather", input.policy);
  const onAnswer = vi.fn();
  vi.mocked(fetch).mockResolvedValue(Response.json({ weekly_cap: "$5.00", spent_this_week: "$0.00", policy: "max $30.00 /M, P95 ≤ 300 ms" }));
  render(<TenderProvider store={store}><SpendingLimitCard input={input} onAnswer={onAnswer} /></TenderProvider>);
  expect(screen.getByText(/Fernline.*\$18.00/)).toBeTruthy();
  await waitFor(() => expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(false));
  expect(fetch).not.toHaveBeenCalled();
  expect(onAnswer).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ approved: true })));
  expect(fetch).toHaveBeenCalledWith("/api/ask/mandate", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
});

it("declines without saving or authorizing a limit", () => {
  const onAnswer = vi.fn();
  render(<TenderProvider store={createTenderStore()}><SpendingLimitCard input={input} onAnswer={onAnswer} /></TenderProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ approved: false }));
  expect(fetch).not.toHaveBeenCalled();
});
