import { expect, it } from "vitest";
import { findMarkets } from "./markets";
it("keeps ambiguous searches available and returns no market for unmatched terms", () => {
  const weather = findMarkets({ query: "weather" });
  expect(weather.markets.length).toBeGreaterThan(1);
  expect(findMarkets({ query: "zzzznoavailablemarket" }).markets).toEqual([]);
});
