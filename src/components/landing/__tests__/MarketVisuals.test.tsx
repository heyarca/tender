import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BitcoinMarketVisual, WeatherMarketVisual } from "../MarketVisuals";

describe("landing market previews", () => {
  it("shows useful results without claiming wall-clock freshness", () => {
    const bitcoin = renderToStaticMarkup(<BitcoinMarketVisual />);
    const weather = renderToStaticMarkup(<WeatherMarketVisual />);
    expect(bitcoin).toContain("BTC/USD");
    expect(weather).toContain("°F");
    for (const html of [bitcoin, weather]) {
      expect(html).toContain("Data age");
      expect(html).toContain(" at response");
      expect(html).not.toMatch(/Source |Observed |\d{2}:\d{2}/);
    }
  });
});
