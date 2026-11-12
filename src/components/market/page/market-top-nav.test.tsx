// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MarketTopNav } from "./market-top-nav";

vi.mock("@/components/credits/balance-chip", () => ({ BalanceChip: () => <a href="/account">Credits</a> }));
beforeAll(() => {
  window.matchMedia ??= ((media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} })) as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

describe("market navigation", () => {
  it("keeps Account and Leaderboard as ordinary links on desktop and in the compact menu", async () => {
    render(<MarketTopNav onSearch={vi.fn()} onOpenApi={vi.fn()} onRun={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Account" }).getAttribute("href")).toBe("/account");
    expect(within(nav).getByRole("link", { name: "Leaderboard" }).getAttribute("href")).toBe("/leaderboard");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Account" }).getAttribute("href")).toBe("/account");
    expect(within(menu).getByRole("menuitem", { name: "Leaderboard" }).getAttribute("href")).toBe("/leaderboard");
  });

  it("uses the supplied action label for request input navigation", () => {
    render(<MarketTopNav onSearch={vi.fn()} onOpenApi={vi.fn()} onRun={vi.fn()} runLabel="Request options" />);
    expect(screen.getAllByRole("button", { name: "Request options" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Run request" })).toBeNull();
  });

  it("keeps API actions available from the compact menu", async () => {
    const onOpenApi = vi.fn();
    render(<MarketTopNav onSearch={vi.fn()} onOpenApi={onOpenApi} onRun={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "API" }));
    expect(onOpenApi).toHaveBeenCalledTimes(1);
  });
});
