// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LandingPage, { metadata } from "@/app/landing/page";
import {
  FailoverScene,
  HeroSelection,
  PriceScene,
  RequirementsExplorer,
} from "./LandingScenes";
import { ProviderStatus } from "./ProviderComparison";
import { createProviders, INITIAL_POLICY, type Provider } from "./demo-model";

function mockReducedMotion(reduced: boolean) {
  const matchMedia = vi.fn((query: string) => ({
    matches: reduced && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  return matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockReducedMotion(false);
});

afterEach(() => {
  // Unmount before restoring timers so effect cleanups use the same clock.
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

function heroRow(name: string) {
  const row = screen.getByText(name).closest<HTMLElement>("[data-active]");
  if (!row) throw new Error(`Missing hero row for ${name}`);
  return row;
}

function providerRow(name: string, table = screen.getByRole("table")) {
  return within(table).getByRole("row", { name: new RegExp(name) });
}

function expectStatus(row: HTMLElement, status: string) {
  expect(within(row).getByText(status)).toBeTruthy();
  expect(row.getAttribute("data-active")).toBe(String(status === "Active"));
}

function expectEmphasis(table: HTMLElement, label: string, values: string[]) {
  const emphasizedHeaders = within(table)
    .getAllByRole("columnheader")
    .filter((header) => header.getAttribute("data-emphasized") === "true");
  expect(emphasizedHeaders).toHaveLength(1);
  expect(emphasizedHeaders[0].textContent).toBe(label);
  for (const [index, name] of [
    "Provider A",
    "Provider B",
    "Provider C",
    "Provider D",
  ].entries()) {
    const cells = within(providerRow(name, table))
      .getAllByRole("cell")
      .filter((cell) => cell.getAttribute("data-emphasized") === "true");
    expect(cells).toHaveLength(1);
    expect(cells[0].textContent).toBe(values[index]);
  }
}

function priceCard(label: string) {
  const card = screen.getByText(label).parentElement;
  if (!card) throw new Error(`Missing price card for ${label}`);
  return within(card);
}

function expectCurrentPrice(price: string, provider: "A" | "B") {
  const current = priceCard("Current provider price");
  expect(current.getByText(price)).toBeTruthy();
  expect(
    current.getByText(`Provider ${provider} · Meets all requirements`),
  ).toBeTruthy();
}

describe("HeroSelection", () => {
  it("starts with the lowest-priced eligible provider and stays static with reduced motion", () => {
    const matchMedia = mockReducedMotion(true);
    const { container } = render(<HeroSelection />);

    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(
      screen.getByLabelText(
        "Simulated Bitcoin price request and four competing API providers",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Bitcoin price")).toBeTruthy();
    expect(screen.getByText("$0.50 / 1K")).toBeTruthy();
    expect(screen.getByText("100 ms")).toBeTruthy();
    expect(screen.getByText("2 s")).toBeTruthy();
    expectStatus(heroRow("Provider A"), "Active");
    expectStatus(heroRow("Provider B"), "Eligible");
    expectStatus(heroRow("Provider C"), "Too slow");
    expectStatus(heroRow("Provider D"), "Stale data");
    expect(within(heroRow("Provider A")).getByText("$0.40")).toBeTruthy();
    expect(within(heroRow("Provider C")).getByText("$0.28")).toBeTruthy();
    expect(within(heroRow("Provider D")).getByText("$0.22")).toBeTruthy();
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);

    advance(60_000);
    expectStatus(heroRow("Provider A"), "Active");
    expect(
      screen.getByText("Provider A meets your requirements at the best price."),
    ).toBeTruthy();
  });

  it("makes one automatic change after 3.5 seconds, without looping", () => {
    render(<HeroSelection />);
    expect(vi.getTimerCount()).toBe(1);
    advance(3_499);
    expectStatus(heroRow("Provider A"), "Active");

    advance(1);
    expectStatus(heroRow("Provider A"), "Too slow");
    expect(within(heroRow("Provider A")).getByText("180 ms")).toBeTruthy();
    expectStatus(heroRow("Provider B"), "Active");
    const event = screen.getByText(
      "A exceeds 100 ms. The next request goes to B.",
    );
    expect(event.getAttribute("aria-live")).toBe("polite");
    expect(vi.getTimerCount()).toBe(0);

    advance(60_000);
    expectStatus(heroRow("Provider B"), "Active");
    expect(event.textContent).toBe(
      "A exceeds 100 ms. The next request goes to B.",
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows an explicit slowdown and reset even with reduced motion", () => {
    mockReducedMotion(true);
    render(<HeroSelection />);
    const replay = screen.getByRole("button", {
      name: "Simulate provider slowdown",
    });

    fireEvent.click(replay);
    expectStatus(heroRow("Provider A"), "Too slow");
    expectStatus(heroRow("Provider B"), "Active");
    fireEvent.click(replay);
    expectStatus(heroRow("Provider A"), "Active");
    expectStatus(heroRow("Provider B"), "Eligible");
    expect(vi.getTimerCount()).toBe(0);
  });
});

const requirementCases = [
  {
    title: "Pay within your budget.",
    body: "Set a maximum price per request. Providers above your limit stay out of consideration.",
    note: "Maximum price: $0.50 / 1K requests",
    metric: "Price / 1K",
    values: ["$0.40", "$0.46", "$0.28", "$0.22"],
  },
  {
    title: "Keep responses fast.",
    body: "Set a latency limit so a lower price does not come with responses that are too slow for your app.",
    note: "P95 latency limit: 100 ms",
    metric: "P95 latency",
    values: ["48 ms", "72 ms", "140 ms", "35 ms"],
  },
  {
    title: "Keep data fresh.",
    body: "Set a maximum data age. A fast response still has to contain information recent enough for your app.",
    note: "Maximum data age: 2 seconds",
    metric: "Data age",
    values: ["160 ms", "220 ms", "300 ms", "8 s"],
  },
  {
    title: "Avoid unreliable providers.",
    body: "Set a minimum request-success rate and exclude providers that fall below it.",
    note: "Minimum request success: 99.5%",
    metric: "Request success",
    values: ["99.9%", "99.9%", "99.9%", "99.9%"],
  },
];

function expectRequirement(item: (typeof requirementCases)[number]) {
  expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
  expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(3);
  const button = screen.getByRole("button", {
    name: item.title,
    expanded: true,
  });
  const region = screen.getByRole("region", { name: item.title });
  expect(screen.getAllByRole("region")).toHaveLength(1);
  expect(screen.getAllByRole("region", { hidden: true })).toHaveLength(4);
  expect(button.getAttribute("aria-controls")).toBe(region.id);
  expect(region.getAttribute("aria-labelledby")).toBe(button.id);
  expect(within(region).getByText(item.body)).toBeTruthy();
  expect(within(region).getByText(item.note)).toBeTruthy();

  // jsdom does not apply responsive CSS. Check both rendered comparison copies,
  // without treating their simultaneous presence as a real viewport assertion.
  for (const table of screen.getAllByRole("table", {
    name: /Provider comparison/,
  })) {
    expectEmphasis(table, item.metric, item.values);
    expectStatus(providerRow("Provider A", table), "Active");
    expectStatus(providerRow("Provider C", table), "Too slow");
    expectStatus(providerRow("Provider D", table), "Stale data");
  }
}

describe("RequirementsExplorer", () => {
  it("opens only the budget explanation initially", () => {
    render(<RequirementsExplorer />);
    expectRequirement(requirementCases[0]);
  });

  it.each(requirementCases)(
    "opens only $title and emphasizes its metric",
    (item) => {
      render(<RequirementsExplorer />);
      // Move away first so the budget case also exercises an actual change.
      fireEvent.click(
        screen.getByRole("button", { name: "Keep responses fast." }),
      );
      fireEvent.click(screen.getByRole("button", { name: item.title }));
      expectRequirement(item);

      fireEvent.click(screen.getByRole("button", { name: item.title }));
      expectRequirement(item);
    },
  );
});

describe("ProviderStatus", () => {
  it.each<{
    status: string;
    patch: Partial<Provider>;
    activeId: Provider["id"] | null;
  }>([
    { status: "Active", patch: {}, activeId: "a" },
    { status: "Eligible", patch: {}, activeId: "b" },
    { status: "Too slow", patch: { latency: 180 }, activeId: "a" },
    { status: "Stale data", patch: { dataAge: 8_000 }, activeId: "a" },
    { status: "Over budget", patch: { price: 0.51 }, activeId: "a" },
    { status: "Unreliable", patch: { success: 99.4 }, activeId: "a" },
    { status: "Unavailable", patch: { available: false }, activeId: "a" },
  ])(
    "writes $status instead of communicating eligibility only through color",
    ({ status, patch, activeId }) => {
      render(
        <ProviderStatus
          provider={{ ...createProviders()[0], ...patch }}
          policy={INITIAL_POLICY}
          activeId={activeId}
        />,
      );
      expect(screen.getByText(status)).toBeTruthy();
      if (status !== "Active") expect(screen.queryByText("Active")).toBeNull();
    },
  );
});

describe("FailoverScene", () => {
  it("fails over immediately on latency, then on stale data after Reset, without changing the sample result", () => {
    const { container } = render(<FailoverScene />);
    const latency = screen.getByRole("button", { name: "Raise latency" });
    const stale = screen.getByRole("button", { name: "Make data stale" });
    const reset = screen.getByRole("button", { name: "Reset" });
    const sample = screen.getByText("$75,230.75");
    const chart = screen.getByRole("img", {
      name: "Illustrative Bitcoin price history, not a live quote",
    });
    const initialChart = chart.innerHTML;
    const expectStableSample = () => {
      expect(screen.getByText("Sample BTC / USD result")).toBeTruthy();
      expect(sample.textContent).toBe("$75,230.75");
      expect(chart.innerHTML).toBe(initialChart);
    };

    expectStatus(providerRow("Provider A"), "Active");
    expectStatus(providerRow("Provider B"), "Eligible");
    expectStatus(providerRow("Provider C"), "Too slow");
    expectStatus(providerRow("Provider D"), "Stale data");
    const summaries = container.querySelectorAll("details > summary");
    expect(summaries).toHaveLength(4);
    for (const [index, status] of [
      "Active",
      "Eligible",
      "Too slow",
      "Stale data",
    ].entries()) {
      expect(summaries[index].textContent).toContain(status);
    }
    expect(latency.getAttribute("aria-pressed")).toBe("false");
    expect(stale.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Next request → Provider A")).toBeTruthy();
    expectStableSample();

    fireEvent.click(latency);
    expect(latency.getAttribute("aria-pressed")).toBe("true");
    expectStatus(providerRow("Provider A"), "Too slow");
    expectStatus(providerRow("Provider B"), "Active");
    expectEmphasis(screen.getByRole("table"), "P95 latency", [
      "180 ms",
      "72 ms",
      "140 ms",
      "35 ms",
    ]);
    const latencyEvent = screen.getByText(
      "Provider A → Provider B. P95 latency exceeded the 100 ms limit.",
    );
    expect(
      latencyEvent.closest('[aria-live="polite"]')?.getAttribute("aria-atomic"),
    ).toBe("true");
    expect(screen.getByText("Next request → Provider B")).toBeTruthy();
    expectStableSample();
    advance(5_000);
    expectStatus(providerRow("Provider B"), "Active");
    expectStableSample();

    fireEvent.click(reset);
    expectStatus(providerRow("Provider A"), "Active");
    expectStatus(providerRow("Provider B"), "Eligible");
    expect(within(providerRow("Provider A")).getByText("160 ms")).toBeTruthy();
    expect(latency.getAttribute("aria-pressed")).toBe("false");
    expect(stale.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Next request → Provider A")).toBeTruthy();

    fireEvent.click(stale);
    expect(stale.getAttribute("aria-pressed")).toBe("true");
    expect(latency.getAttribute("aria-pressed")).toBe("false");
    expectStatus(providerRow("Provider A"), "Stale data");
    expectStatus(providerRow("Provider B"), "Active");
    expect(within(providerRow("Provider A")).getByText("48 ms")).toBeTruthy();
    expectEmphasis(screen.getByRole("table"), "Data age", [
      "8 s",
      "220 ms",
      "300 ms",
      "8 s",
    ]);
    expect(
      screen.getByText(
        "Provider A → Provider B. Data age exceeded the 2 s limit.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Next request → Provider B")).toBeTruthy();
    expectStableSample();

    fireEvent.click(reset);
    advance(20_000);
    expectStatus(providerRow("Provider A"), "Active");
    expectStatus(providerRow("Provider B"), "Eligible");
    expectEmphasis(screen.getByRole("table"), "P95 latency", [
      "48 ms",
      "72 ms",
      "140 ms",
      "35 ms",
    ]);
    expectStableSample();
  });
  it("lets each failure control tell its own story without requiring a manual Reset", () => {
    render(<FailoverScene />);
    const latency = screen.getByRole("button", { name: "Raise latency" });
    const stale = screen.getByRole("button", { name: "Make data stale" });

    for (let repeat = 0; repeat < 2; repeat += 1) {
      fireEvent.click(latency);
      expectStatus(providerRow("Provider A"), "Too slow");
      expect(latency.getAttribute("aria-pressed")).toBe("true");
      expect(stale.getAttribute("aria-pressed")).toBe("false");
      expect(
        screen.getByText(
          "Provider A → Provider B. P95 latency exceeded the 100 ms limit.",
        ),
      ).toBeTruthy();

      fireEvent.click(stale);
      expectStatus(providerRow("Provider A"), "Stale data");
      expect(latency.getAttribute("aria-pressed")).toBe("false");
      expect(stale.getAttribute("aria-pressed")).toBe("true");
      expect(
        screen.getByText(
          "Provider A → Provider B. Data age exceeded the 2 s limit.",
        ),
      ).toBeTruthy();
      expectStatus(providerRow("Provider B"), "Active");
    }
  });
});

describe("PriceScene", () => {
  it("keeps the current $0.40 route through the full countdown, then selects eligible Provider B at $0.34", () => {
    render(<PriceScene />);
    const lower = screen.getByRole<HTMLButtonElement>("button", {
      name: "Lower a provider’s price",
    });
    expectCurrentPrice("$0.40", "A");
    expect(priceCard("Eligible alternative").getByText("$0.46")).toBeTruthy();
    expect(
      priceCard("Eligible alternative").getByText(
        "Provider B · Eligible, but currently costs more",
      ),
    ).toBeTruthy();
    expect(lower.disabled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(lower);
    expect(lower.disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    expect(
      priceCard("Lower-priced eligible option").getByText("$0.34"),
    ).toBeTruthy();
    expectCurrentPrice("$0.40", "A");
    expect(within(screen.getByRole("status")).getByText("10 s")).toBeTruthy();
    expect(
      screen.getByText("Switching after the optimization cooldown."),
    ).toBeTruthy();
    expect(screen.getByText("Too slow")).toBeTruthy();
    expect(screen.getByText("Stale data")).toBeTruthy();

    for (let remaining = 9; remaining >= 1; remaining -= 1) {
      advance(1_000);
      expect(
        within(screen.getByRole("status")).getByText(`${remaining} s`),
      ).toBeTruthy();
      expectCurrentPrice("$0.40", "A");
    }
    advance(999);
    expectCurrentPrice("$0.40", "A");
    advance(1);
    expectCurrentPrice("$0.34", "B");
    expect(
      priceCard("Selected eligible option").getByText("$0.34"),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Provider B now receives the next request.",
    );
    expect(
      screen.queryByText("Switching after the optimization cooldown."),
    ).toBeNull();
    expect(lower.disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts a full ten-second cooldown when the price is lowered between clock ticks", () => {
    render(<PriceScene />);
    advance(30_250);
    fireEvent.click(
      screen.getByRole("button", { name: "Lower a provider’s price" }),
    );
    expect(within(screen.getByRole("status")).getByText("10 s")).toBeTruthy();

    advance(9_999);
    expectCurrentPrice("$0.40", "A");
    expect(within(screen.getByRole("status")).getByText("1 s")).toBeTruthy();
    advance(1);
    expectCurrentPrice("$0.34", "B");
  });

  it("Reset clears the pending switch and restores prices before later ticks can select B", () => {
    const { unmount } = render(<PriceScene />);
    const lower = screen.getByRole<HTMLButtonElement>("button", {
      name: "Lower a provider’s price",
    });
    fireEvent.click(lower);
    advance(3_000);
    expect(within(screen.getByRole("status")).getByText("7 s")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expectCurrentPrice("$0.40", "A");
    expect(priceCard("Eligible alternative").getByText("$0.46")).toBeTruthy();
    expect(lower.disabled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByRole("status").textContent).toBe(
      "Lower B’s price to see how competition changes the route.",
    );
    expect(
      screen.queryByText("Switching after the optimization cooldown."),
    ).toBeNull();
    advance(20_000);
    expectCurrentPrice("$0.40", "A");
    expect(
      screen.queryByText("Provider B now receives the next request."),
    ).toBeNull();

    fireEvent.click(lower);
    expect(within(screen.getByRole("status")).getByText("10 s")).toBeTruthy();
    advance(9_000);
    expectCurrentPrice("$0.40", "A");
    advance(1_000);
    expectCurrentPrice("$0.34", "B");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("landing timer cleanup", () => {
  it.each([
    { name: "hero before its automatic change", Component: HeroSelection },
    { name: "failover scene", Component: FailoverScene },
    { name: "idle price scene", Component: PriceScene },
  ])("leaves no timers after unmounting the $name", ({ Component }) => {
    const { unmount } = render(<Component />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(60_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the price timer while an optimization is still pending", () => {
    const { unmount } = render(<PriceScene />);
    fireEvent.click(
      screen.getByRole("button", { name: "Lower a provider’s price" }),
    );
    advance(2_000);
    expect(within(screen.getByRole("status")).getByText("8 s")).toBeTruthy();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(20_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("LandingPage", () => {
  it("publishes the landing title and accurate demo metadata", () => {
    expect(metadata.title).toBe("Tender — Make APIs compete for your traffic");
    expect(metadata.description).toBe(
      "Compare API providers on price, speed, and data freshness. Explore Tender’s demo and see how requirements change where requests go.",
    );
    expect(metadata.openGraph).toMatchObject({
      title: metadata.title,
      description: metadata.description,
      type: "website",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: metadata.title,
    });
  });

  it("describes the simulated demo and separates current routing from proposed provider bids", () => {
    render(<LandingPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Make APIs compete\s*for your traffic\./,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Compare API providers on price, speed, and data freshness. Set your requirements, and Tender routes requests to a provider that meets them.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Interactive demo with simulated providers and performance.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Simulated provider conditions. Changes affect subsequent requests.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Today’s demo shows provider comparison and routing. Provider-submitted bids are the next stage of the marketplace.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Proposed marketplace flow")).toBeTruthy();
    expect(
      screen.getByText(
        "Illustrative unit prices only. Not a claim about real savings or total bills.",
      ),
    ).toBeTruthy();

    // Main section headings lead their copy blocks; no eyebrow labels precede them.
    for (const heading of screen
      .getAllByRole("heading")
      .filter((element) => ["H1", "H2"].includes(element.tagName))) {
      expect(heading.previousElementSibling).toBeNull();
    }
  });

  it("links demo entry points to the actual markets and resolves its in-page destinations", () => {
    render(<LandingPage />);
    const demoLinks = screen.getAllByRole("link", { name: "Explore the demo" });
    expect(demoLinks.length).toBeGreaterThan(0);
    for (const link of demoLinks)
      expect(link.getAttribute("href")).toBe("/markets/btc-usd");
    expect(
      screen
        .getByRole("link", { name: "Open the full demo" })
        .getAttribute("href"),
    ).toBe("/markets/btc-usd");
    expect(
      screen
        .getByRole("link", { name: "Explore Bitcoin price" })
        .getAttribute("href"),
    ).toBe("/markets/btc-usd");
    expect(
      screen
        .getByRole("link", { name: "Explore weather" })
        .getAttribute("href"),
    ).toBe("/markets/sf-weather");
    expect(
      screen
        .getByRole("link", { name: "See how it works" })
        .getAttribute("href"),
    ).toBe("#how-it-works");
    expect(
      screen
        .getByRole("link", { name: "Skip to content" })
        .getAttribute("href"),
    ).toBe("#main");
    for (const link of screen.getAllByRole("link", { name: "Tender home" })) {
      expect(link.getAttribute("href")).toBe("/landing");
    }
    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("#") || href.startsWith("/landing#")) {
        expect(document.getElementById(href.split("#")[1])).not.toBeNull();
      }
      expect(href).not.toMatch(/^\/landing\/(?:demo|markets)(?:[/?#]|$)/);
    }
  });
});
