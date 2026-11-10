import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearReferenceCache, loadPrice, loadWeather, UPSTREAM_TIMEOUT_MS } from "./reference";

const SF = { latitude: 37.7749, longitude: -122.4194 };

beforeEach(() => { clearReferenceCache(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("reference inputs", () => {
  it("loads and caches Coinbase mid price with its source timestamp", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ bid: "75000", ask: "75002", time: "2026-11-09T18:30:00Z" }));
    vi.stubGlobal("fetch", fetcher);
    const result = await loadPrice("BTC-USD", "crypto");
    expect(result).toEqual({ value: 75001, timestamp: "2026-11-09T18:30:00.000Z", source: "coinbase" });
    expect(await loadPrice("BTC-USD", "crypto")).toEqual(result);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("falls back to Kraken with the actual trade timestamp", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ result: { XXBTZUSD: [["75001", "0.1", 1794249000]], last: "123" } })));
    expect(await loadPrice("BTC-USD", "crypto")).toEqual({ value: 75001, timestamp: new Date(1794249000000).toISOString(), source: "kraken" });
  });
  it("loads the ECB rate of a currency with its date", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ amount: 1, base: "EUR", date: "2026-11-09", rates: { USD: 1.1193 } })));
    expect(await loadPrice("EUR-USD", "currency")).toEqual({ value: 1.1193, timestamp: "2026-11-09T00:00:00.000Z", source: "frankfurter" });
  });
  it("returns null when both price sources fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await loadPrice("BTC-USD", "crypto")).toBeNull();
  });
  it("returns null when a weather request reaches its bounded timeout", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
    })));
    const start = Date.now();
    expect(await loadWeather(SF)).toBeNull();
    expect(Date.now() - start).toBeLessThan(UPSTREAM_TIMEOUT_MS + 500);
  });
  it("normalizes weather, preserving reference time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ current: {
      time: "2026-11-09T18:30", temperature_2m: 61, relative_humidity_2m: 86,
      apparent_temperature: 60, weather_code: 3, cloud_cover: 100,
      surface_pressure: 1018, wind_speed_10m: 9, wind_direction_10m: 278,
      visibility: 16093.44, dew_point_2m: 57,
    } })));
    const result = await loadWeather(SF);
    expect(result?.source).toBe("open-meteo");
    expect(result?.timestamp).toBe("2026-11-09T18:30:00.000Z");
    expect(result?.value).toMatchObject({ temperature_f: 61, condition: "Overcast", wind_mph: 9, visibility_mi: 10, dew_point_f: 57 });
  });
  it("rejects malformed reference numbers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ bid: "NaN", ask: "75001" })));
    expect(await loadPrice("BTC-USD", "crypto")).toBeNull();
  });
});
