/** Keyless reference inputs. Tender provider identities are independent of these sources. */
export interface WeatherReference {
  temperature_f: number; feels_like_f: number; condition: string; humidity_percent: number;
  wind_mph: number; wind_direction_degrees: number; pressure_hpa: number;
  visibility_mi: number; dew_point_f: number; cloud_cover_percent: number;
}
export interface AirQualityReference {
  aqi: number; pm25: number; pm10: number; ozone_ppm: number;
  /** Pollutant with the highest sub-index: pm25, pm10, o3, or no2. */
  dominant_pollutant: string;
}
export interface Reference<T> { value: T; timestamp: string; source: string }
export interface Place { latitude: number; longitude: number }
export const UPSTREAM_TIMEOUT_MS = 1800;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const cache = new Map<string, { expires: number; promise: Promise<unknown> }>();

export function clearReferenceCache() { cache.clear(); }
/** One load per key and lifetime per instance; concurrent reads share it. Failures resolve to null. */
function cached<T>(key: string, ttlMs: number, load: () => Promise<Reference<T>>): Promise<Reference<T> | null> {
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise as Promise<Reference<T> | null>;
  const promise = load().catch(() => null);
  cache.set(key, { expires: Date.now() + ttlMs, promise });
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

/** Open-Meteo current conditions at a place, or null when the source fails. */
export function loadWeather(place: Place): Promise<Reference<WeatherReference> | null> {
  return cached(`weather:${place.latitude},${place.longitude}`, MINUTE, async () => {
    const fields = "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,visibility,dew_point_2m";
    const data = await json(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=${fields}&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=UTC`, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));
    const current = record(data.current);
    return { source: "open-meteo", timestamp: timestamp(`${String(current.time)}Z`), value: {
      temperature_f: number(current.temperature_2m), feels_like_f: number(current.apparent_temperature),
      condition: condition(number(current.weather_code)), humidity_percent: number(current.relative_humidity_2m),
      wind_mph: number(current.wind_speed_10m), wind_direction_degrees: number(current.wind_direction_10m),
      pressure_hpa: number(current.surface_pressure), visibility_mi: number(current.visibility) / 1609.344,
      dew_point_f: number(current.dew_point_2m), cloud_cover_percent: number(current.cloud_cover),
    } };
  });
}

/** Micrograms per cubic metre of ozone in one ppm (25 °C, 1 atm). */
const OZONE_UG_PER_PPM = 1963;

/** Open-Meteo current US AQI and pollutant levels at a place, or null when the source fails. */
export function loadAirQuality(place: Place): Promise<Reference<AirQualityReference> | null> {
  return cached(`air:${place.latitude},${place.longitude}`, MINUTE, async () => {
    const fields = "us_aqi,pm2_5,pm10,ozone,us_aqi_pm2_5,us_aqi_pm10,us_aqi_ozone,us_aqi_nitrogen_dioxide";
    const data = await json(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.latitude}&longitude=${place.longitude}&current=${fields}&timezone=UTC`, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));
    const current = record(data.current);
    const indexes: [string, number][] = [
      ["pm25", number(current.us_aqi_pm2_5)], ["pm10", number(current.us_aqi_pm10)],
      ["o3", number(current.us_aqi_ozone)], ["no2", number(current.us_aqi_nitrogen_dioxide)],
    ];
    return { source: "open-meteo", timestamp: timestamp(`${String(current.time)}Z`), value: {
      aqi: number(current.us_aqi), pm25: number(current.pm2_5), pm10: number(current.pm10),
      ozone_ppm: number(current.ozone) / OZONE_UG_PER_PPM,
      dominant_pollutant: indexes.reduce((top, entry) => (entry[1] > top[1] ? entry : top))[0],
    } };
  });
}

/**
 * Spot price of a `BASE-USD` pair, or null when every source fails. Crypto: Coinbase Exchange
 * bid/ask midpoint, then Kraken's latest trade (both attempts share one deadline). Currencies:
 * the ECB reference rate through Frankfurter, published once per working day.
 */
export function loadPrice(pair: string, kind: "crypto" | "currency"): Promise<Reference<number> | null> {
  const [base, quote] = pair.toUpperCase().split("-");
  if (quote !== "USD") return Promise.resolve(null);
  if (kind === "currency") {
    return cached(`price:${base}`, 10 * MINUTE, async () => {
      const data = await json(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=USD`, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));
      const price = number(record(data.rates).USD);
      if (price <= 0) throw new Error("Invalid price");
      // Frankfurter dates each rate; there is no time of day.
      return { value: price, timestamp: timestamp(`${String(data.date)}T00:00:00Z`), source: "frankfurter" };
    });
  }
  return cached(`price:${base}`, 3 * SECOND, async () => {
    const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
    try {
      const data = await json(`https://api.exchange.coinbase.com/products/${base}-USD/ticker`, signal);
      const price = (number(data.bid) + number(data.ask)) / 2;
      if (price <= 0) throw new Error("Invalid price");
      return { value: price, timestamp: timestamp(data.time), source: "coinbase" };
    } catch {
      const data = await json(`https://api.kraken.com/0/public/Trades?pair=${base === "BTC" ? "XBT" : base}USD&count=1`, signal);
      const result = record(data.result);
      const trades = Object.entries(result).find(([key]) => key !== "last")?.[1];
      if (!Array.isArray(trades) || !Array.isArray(trades[0])) throw new Error("Invalid trades");
      const price = number(trades[0][0]);
      if (price <= 0) throw new Error("Invalid price");
      return { value: price, timestamp: new Date(number(trades[0][2]) * 1000).toISOString(), source: "kraken" };
    }
  });
}
