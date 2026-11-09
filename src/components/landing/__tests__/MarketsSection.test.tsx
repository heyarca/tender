// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { formatUsd } from "@/components/viz/format";
import { getInitialMarketView } from "@/lib/tender";
import { MarketsSection } from "../MarketsSection";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
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
});

afterEach(() => cleanup());

describe("MarketsSection", () => {
  it("renders the approved heading and lead without an eyebrow", () => {
    render(<MarketsSection />);
    const section = document.getElementById("markets")!;
    const heading = within(section).getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Compare providers forthe data your app needs.");
    expect(section.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(
      within(section).getByText(
        "Start with Bitcoin prices or weather data. Compare providers in each market, set your requirements, and see which one gets the next request.",
      ),
    ).toBeTruthy();
  });

  it("links each market card title to its market page", () => {
    render(<MarketsSection />);
    const bitcoin = screen.getByRole("link", { name: "Bitcoin price" });
    const weather = screen.getByRole("link", { name: "Weather" });
    expect(bitcoin.getAttribute("href")).toBe("/markets/btc-usd");
    expect(weather.getAttribute("href")).toBe("/markets/sf-weather");
    expect(screen.getByText("Compare price feeds by request cost, response time, and data age.")).toBeTruthy();
    expect(
      screen.getByText("Compare weather providers by request cost, response time, and update freshness."),
    ).toBeTruthy();
  });

  it("shows the product's own results from the engine's initial views", () => {
    render(<MarketsSection />);
    const btc = getInitialMarketView("btc-usd");
    const sf = getInitialMarketView("sf-weather");
    const bitcoinCard = screen.getByRole("article", { name: "Bitcoin price" });
    const weatherCard = screen.getByRole("article", { name: "Weather" });

    const served = btc.lastServed;
    expect(served?.marketId).toBe("btc-usd");
    if (served?.marketId === "btc-usd") {
      expect(within(bitcoinCard).getByText(formatUsd(served.payload.priceUsd))).toBeTruthy();
    }
    expect(within(bitcoinCard).getByRole("group", { name: /Price chart, \d+ prices/ })).toBeTruthy();
    expect(within(bitcoinCard).getByText(btc.route.activeProvider!.name)).toBeTruthy();
    expect(within(weatherCard).getByText(sf.route.activeProvider!.name)).toBeTruthy();
    expect(within(weatherCard).getByText("Humidity")).toBeTruthy();
  });

  it("uses the SF photo with an AVIF source and a JPEG fallback", () => {
    render(<MarketsSection />);
    const weatherCard = screen.getByRole("article", { name: "Weather" });
    const image = within(weatherCard).getByRole("img", { name: "Fog rolling over San Francisco" });
    expect(image.getAttribute("src")).toBe("/landing/weather-sf.jpg");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("width")).toBe("1600");
    expect(weatherCard.querySelector('source[type="image/avif"]')?.getAttribute("srcset")).toBe("/landing/weather-sf.avif");
  });

  it("has no disclaimers", () => {
    render(<MarketsSection />);
    const text = document.getElementById("markets")!.textContent ?? "";
    expect(text).not.toMatch(/simulated|sample|illustrative|demo|not a claim|powered by|partner|integrated/i);
  });
});
