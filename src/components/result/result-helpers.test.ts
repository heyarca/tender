import { describe, expect, it } from "vitest";
import { quoteChange } from "./BitcoinResult";
import { WEATHER_CONDITIONS, weatherCondition } from "./weather-condition";

describe("weatherCondition", () => {
  it("resolves codes to their canonical label", () => {
    expect(weatherCondition("partly-cloudy")).toBe(WEATHER_CONDITIONS["partly-cloudy"]);
    expect(weatherCondition("wind").label).toBe("Windy");
  });

  it("resolves engine labels and keeps their wording", () => {
    expect(weatherCondition("Overcast")).toMatchObject({ code: "overcast", label: "Overcast" });
    expect(weatherCondition("Mostly cloudy")).toMatchObject({ code: "mostly-cloudy", label: "Mostly cloudy" });
    expect(weatherCondition("Partly cloudy").code).toBe("partly-cloudy");
    expect(weatherCondition("Mostly clear").code).toBe("mostly-clear");
  });

  it("falls back on keywords, then overcast", () => {
    expect(weatherCondition("Light rain").code).toBe("rain");
    expect(weatherCondition("Haze").code).toBe("fog");
    expect(weatherCondition("Light drizzle").code).toBe("drizzle");
    expect(weatherCondition("Sunny").code).toBe("clear");
    expect(weatherCondition("Something new")).toMatchObject({ code: "overcast", label: "Something new" });
    expect(weatherCondition("").label).toBe("Overcast");
  });
});

describe("quoteChange", () => {
  const base = { pair: "BTC/USD", price: 75_230.75, sourceTimestamp: 0, dataAgeMs: 220, latencyMs: 84 };

  it("prefers an explicit change", () => {
    expect(quoteChange({ ...base, change: -3.5, previousPrice: 1 })).toBe(-3.5);
  });

  it("derives the change from the previous price", () => {
    expect(quoteChange({ ...base, previousPrice: 75_227.5 })).toBeCloseTo(3.25);
  });

  it("is null without a previous request", () => {
    expect(quoteChange({ ...base, change: null })).toBeNull();
    expect(quoteChange(base)).toBeNull();
  });
});
