/** Keyless reference inputs. Tender provider identities are independent of these sources. */
export interface WeatherReference {
  temperature_f: number; feels_like_f: number; condition: string; humidity_percent: number;
  wind_mph: number; wind_direction_degrees: number; pressure_hpa: number;
  visibility_mi: number; dew_point_f: number; cloud_cover_percent: number;
}
export interface Reference<T> { value: T; timestamp: string; source: string }
export const UPSTREAM_TIMEOUT_MS = 1800;
const CACHE_MS = 3000;
const weatherFallback: WeatherReference = {
  temperature_f: 61, feels_like_f: 60, condition: "Overcast", humidity_percent: 86,
  wind_mph: 9, wind_direction_degrees: 278, pressure_hpa: 1018,
  visibility_mi: 9.4, dew_point_f: 57, cloud_cover_percent: 100,
};
const FALLBACK_TIMESTAMP = "2026-11-09T18:30:00.000Z";
const cache = new Map<string, { expires: number; promise: Promise<Reference<unknown>> }>();

export function clearReferenceCache() { cache.clear(); }
function cached<T>(key: string, load: () => Promise<Reference<T>>): Promise<Reference<T>> {
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise as Promise<Reference<T>>;
  const promise = load();
  cache.set(key, { expires: Date.now() + CACHE_MS, promise });
  return promise;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error("Invalid reference response");
  return value as Record<string, unknown>;
}
function number(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || value === "" || !Number.isFinite(Number(value)))
    throw new Error("Invalid reference number");
  return Number(value);
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("Invalid reference timestamp");
  return new Date(value).toISOString();
}
async function json(url: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(url, { signal, cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Reference HTTP ${response.status}`);
  return record(await response.json());
}
function condition(code: number): string {
  if (code === 0) return "Clear";
  if (code < 3) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code < 50) return "Fog";
  if (code < 60) return "Drizzle";
  if (code < 70) return "Rain";
  if (code < 80) return "Snow";
  if (code < 90) return "Showers";
  return "Thunderstorm";
}
export function getWeatherReference(): Promise<Reference<WeatherReference>> {
  return cached("weather", async () => {
    try {
      const fields = "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m";
      const data = await json(`https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=${fields}&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=UTC`, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));
      const current = record(data.current);
      const temp = number(current.temperature_2m);
      const humidity = number(current.relative_humidity_2m);
      // Magnus approximation; Open-Meteo current does not expose dew point or visibility.
      const c = (temp - 32) * 5 / 9;
      const gamma = Math.log(Math.max(1, humidity) / 100) + 17.625 * c / (243.04 + c);
      return { source: "open-meteo", timestamp: timestamp(`${String(current.time)}Z`), value: {
        temperature_f: temp, feels_like_f: number(current.apparent_temperature),
        condition: condition(number(current.weather_code)), humidity_percent: humidity,
        wind_mph: number(current.wind_speed_10m), wind_direction_degrees: number(current.wind_direction_10m),
        pressure_hpa: number(current.surface_pressure), visibility_mi: weatherFallback.visibility_mi,
        dew_point_f: 243.04 * gamma / (17.625 - gamma) * 9 / 5 + 32,
        cloud_cover_percent: number(current.cloud_cover),
      } };
    } catch {
      return { value: { ...weatherFallback }, timestamp: FALLBACK_TIMESTAMP, source: "fixture" };
    }
  });
}
export function getPriceReference(): Promise<Reference<number>> {
  return cached("price", async () => {
    // Both attempts share one deadline; failover cannot double the request timeout.
    const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
    try {
      const data = await json("https://api.exchange.coinbase.com/products/BTC-USD/ticker", signal);
      const price = (number(data.bid) + number(data.ask)) / 2;
      if (price <= 0) throw new Error("Invalid price");
      return { value: price, timestamp: timestamp(data.time), source: "coinbase" };
    } catch {
      try {
        const data = await json("https://api.kraken.com/0/public/Trades?pair=XBTUSD&count=1", signal);
        const result = record(data.result);
        const trades = Object.entries(result).find(([key]) => key !== "last")?.[1];
        if (!Array.isArray(trades) || !Array.isArray(trades[0])) throw new Error("Invalid trades");
        const price = number(trades[0][0]);
        if (price <= 0) throw new Error("Invalid price");
        return { value: price, timestamp: new Date(number(trades[0][2]) * 1000).toISOString(), source: "kraken" };
      } catch {
        return { value: 75230.75, timestamp: FALLBACK_TIMESTAMP, source: "fixture" };
      }
    }
  });
}
