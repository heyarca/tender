// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { evaluateMarket, format, getDefaultPolicy, getProviderFixture } from "@/lib/tender";
import { ClosingSection } from "../ClosingSection";
import { buildMarketplaceScene, MarketplaceSection } from "../MarketplaceSection";

afterEach(() => {
  cleanup();
});

const BANNED = /simulat|sample|illustrat|\bdemo\b|not a claim|\blive\b|powered by|partner|integrated with|coming soon/i;

describe("buildMarketplaceScene", () => {
  it("uses the Bitcoin fixture bids and the engine's first-ranked offer", () => {
    const scene = buildMarketplaceScene();
    const ids = ["inference-net", "coreweave", "baseten"];
    expect(scene.offers.map((offer) => offer.id)).toEqual(ids);
    for (const offer of scene.offers) {
      const fixture = getProviderFixture("btc-usd", offer.id);
      expect(fixture).toBeDefined();
      expect(offer.name).toBe(fixture?.name);
      expect(offer.logo).toBe(fixture?.logo);
      expect(offer.bid).toBe(fixture?.defaults.bidPrice);
    }
    const policy = getDefaultPolicy("btc-usd");
    const evaluation = evaluateMarket(
      ids.flatMap((id) => {
        const fixture = getProviderFixture("btc-usd", id);
        return fixture ? [{ id, name: fixture.name, conditions: fixture.defaults }] : [];
      }),
      policy,
    );
    expect(scene.selected.id).toBe(evaluation.recommendedId);
    expect(scene.selected.id).toBe("inference-net");
  });

  it("states the default Bitcoin requirements for price, speed, freshness, and reliability", () => {
    const policy = getDefaultPolicy("btc-usd");
    expect(buildMarketplaceScene().requirements).toEqual([
      { label: "Price", value: `≤ ${format.priceWithUnit(policy.maxPrice)}` },
      { label: "Speed", value: `≤ ${format.latency(policy.maxP95LatencyMs)}` },
      { label: "Freshness", value: `≤ ${format.dataAge(policy.maxDataAgeMs)}` },
      { label: "Reliability", value: `≥ ${format.percent(policy.minSuccessRate, 1)}` },
    ]);
  });
});

describe("MarketplaceSection", () => {
  it("renders the approved heading and body inside #marketplace", () => {
    const { container } = render(<MarketplaceSection />);
    const section = container.querySelector("section#marketplace");
    expect(section).not.toBeNull();
    const heading = screen.getByRole("heading", { level: 2, name: "Let API providers bid for your traffic." });
    expect(section?.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(
      screen.getByText(
        "We’re building toward a market where API providers publish offers and compete to serve application demand. Apps state what they need. Providers win traffic by offering better prices and meeting those requirements.",
      ),
    ).toBeTruthy();
    // No caption or extra sentences: exactly one paragraph of body copy outside the figure.
    expect(section?.querySelectorAll("figcaption")).toHaveLength(0);
    expect(section?.textContent ?? "").not.toMatch(/today/i);
  });

  it("shows three provider offers with their bids per million requests", () => {
    render(<MarketplaceSection />);
    const offers = screen.getByRole("list", { name: "Provider offers" });
    const items = within(offers).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "inference.net$0.95 /M req",
      "CoreWeave$1.40 /M req",
      "Baseten$1.80 /M req",
    ]);
    expect(items[0]?.dataset.selected).toBe("true");
    expect(items[1]?.dataset.selected).toBeUndefined();
    expect(items[2]?.dataset.selected).toBeUndefined();
    expect(Array.from(offers.querySelectorAll("img")).map((img) => img.getAttribute("src"))).toEqual([
      "/providers/inference-net.png",
      "/providers/coreweave.svg",
      "/providers/baseten.svg",
    ]);
  });

  it("names the selected offer and the requirements it meets", () => {
    const { container } = render(<MarketplaceSection />);
    expect(screen.getByText("Selected offer:", { exact: false }).closest("p")?.textContent).toBe(
      "Selected offer: inference.net$0.95 /M req",
    );
    expect(screen.getByText("Your requirements")).toBeTruthy();
    const terms = Array.from(container.querySelectorAll("dt")).map((term) => term.textContent);
    expect(terms).toEqual(["Price", "Speed", "Freshness", "Reliability"]);
    const values = Array.from(container.querySelectorAll("dd")).map((value) => value.textContent);
    expect(values).toEqual(["≤ $2.00 /M req", "≤ 150 ms", "≤ 1 s", "≥ 99.9%"]);
  });

  it("uses the lanes photo with an AVIF source and a lazy JPEG fallback", () => {
    const { container } = render(<MarketplaceSection />);
    const picture = container.querySelector("picture");
    expect(picture?.querySelector('source[type="image/avif"]')?.getAttribute("srcset")).toBe("/landing/bids-lanes.avif");
    const photo = picture?.querySelector("img");
    expect(photo?.getAttribute("src")).toBe("/landing/bids-lanes.jpg");
    expect(photo?.getAttribute("loading")).toBe("lazy");
    expect(photo?.getAttribute("width")).toBeTruthy();
    expect(photo?.getAttribute("height")).toBeTruthy();
  });

  it("has no disclaimers or partnership claims", () => {
    const { container } = render(<MarketplaceSection />);
    expect(container.textContent ?? "").not.toMatch(BANNED);
  });
});

describe("ClosingSection", () => {
  it("renders the approved heading, body, and one Try Tender action", () => {
    const { container } = render(<ClosingSection />);
    expect(screen.getByRole("heading", { level: 2, name: "Find a better provider for your next request." })).toBeTruthy();
    expect(
      screen.getByText("Pick any API on Tender or request a new one. Set your requirements and see where Tender routes your next request."),
    ).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toBe("Try Tender");
    expect(links[0]?.getAttribute("href")).toBe("/markets/btc-usd");
    expect(container.textContent ?? "").not.toMatch(BANNED);
  });

  it("keeps the track motif decorative", () => {
    const { container } = render(<ClosingSection />);
    const svgs = Array.from(container.querySelectorAll("svg"));
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      const hidden = svg.closest('[aria-hidden="true"]') ?? (svg.getAttribute("aria-hidden") === "true" ? svg : null);
      expect(hidden).not.toBeNull();
    }
  });
});
