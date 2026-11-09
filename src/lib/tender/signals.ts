/**
 * Deterministic market signals: the "true" value of each market at any time.
 * Pure functions of `(time − signalOrigin)`, so rebasing all timestamps by the
 * same delta keeps every value unchanged. Baselines come from the registry
 * (`sampleFor(market)`); San Francisco and BTC/USD keep their original signals.
 */
import { getContract, getMarketSpec, sampleFor as sampleOf, type MarketSpec } from "@/lib/registry";
import { hashNormal, seedFromString } from "./random";
import type { MarketId } from "./types";

/** Baseline BTC/USD price at the signal origin. */
export const BTC_BASELINE_PRICE = 75_230.75;

/** San Francisco baseline conditions at the signal origin (SPEC §3.1). */
export const SF_BASELINE = {
  temperatureF: 61,
  humidityPct: 86,
  windMph: 9,
  windDirectionDeg: 278,
  pressureHpa: 1018,
  visibilityMi: 9.4,
  dewPointF: 57,
  cloudCoverPct: 100,
} as const;

/** San Francisco location of the normalized result. */
export const SF_LOCATION = { name: "San Francisco, CA", latitude: 37.7749, longitude: -122.4194 } as const;

/** Location shape shared by every weather market's result. */
export interface MarketLocation {
  name: string;
  latitude: number;
  longitude: number;
}

interface Octave {
  periodS: number;
  amplitude: number;
  seed: number;
}

/** Value noise: piecewise-linear interpolation between hashed normal lattice values. */
function valueNoise(seconds: number, octaves: readonly Octave[]): number {
  let total = 0;
  for (const { periodS, amplitude, seed } of octaves) {
    const x = seconds / periodS;
    const i = Math.floor(x);
    const f = x - i;
    const a = hashNormal(seed, i);
    const b = hashNormal(seed, i + 1);
    total += amplitude * (a + (b - a) * f);
  }
  return total;
}

/** Noise anchored so that the value at the origin is exactly zero. */
function anchoredNoise(seconds: number, octaves: readonly Octave[]): number {
  return valueNoise(seconds, octaves) - valueNoise(0, octaves);
}

// Brownian-like octaves: amplitude ∝ √period, σ ≈ $7 per second overall.
const BTC_OCTAVES: readonly Octave[] = [1, 4, 16, 64, 256, 1024].map((periodS, index) => ({
  periodS,
  amplitude: 4.3 * Math.sqrt(periodS),
  seed: 0xb7c0 + index * 7919,
}));

/** True BTC/USD mid price at `at`. */
export function btcPriceAt(at: number, origin: number): number {
  return BTC_BASELINE_PRICE + anchoredNoise((at - origin) / 1000, BTC_OCTAVES);
}

const octaves = (seed: number, list: [number, number][]): Octave[] =>
  list.map(([periodS, amplitude], index) => ({ periodS, amplitude, seed: seed + index * 104_729 }));

const TEMP = octaves(0x7e01, [
  [600, 0.25],
  [2400, 0.5],
  [7200, 0.8],
]);
const HUMIDITY = octaves(0x4b02, [
  [900, 0.6],
  [3600, 1.5],
]);
const WIND = octaves(0x3a03, [
  [120, 0.8],
  [900, 1.2],
]);
const WIND_DIR = octaves(0x2c04, [
  [300, 4],
  [1800, 8],
]);
const PRESSURE = octaves(0x1d05, [
  [1800, 0.3],
  [7200, 0.6],
]);
const VISIBILITY = octaves(0x0e06, [
  [900, 0.15],
  [3600, 0.3],
]);
const CLOUD = octaves(0x0f07, [
  [1200, 2],
  [4800, 3],
]);

/** Raw (unrounded) San Francisco conditions at `at`. */
export interface WeatherState {
  temperatureF: number;
  humidityPct: number;
  windMph: number;
  windDirectionDeg: number;
  pressureHpa: number;
  visibilityMi: number;
  dewPointF: number;
  cloudCoverPct: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Same noise shapes as San Francisco, offset to a different baseline (SPEC-compatible extension). */
function weatherAtWithBaseline(baseline: WeatherState, at: number, origin: number): WeatherState {
  const s = (at - origin) / 1000;
  const temperatureF = baseline.temperatureF + anchoredNoise(s, TEMP);
  const humidityPct = clamp(baseline.humidityPct + anchoredNoise(s, HUMIDITY), 0, 100);
  return {
    temperatureF,
    humidityPct,
    windMph: Math.max(0, baseline.windMph + anchoredNoise(s, WIND)),
    windDirectionDeg: (baseline.windDirectionDeg + anchoredNoise(s, WIND_DIR) + 360) % 360,
    pressureHpa: baseline.pressureHpa + anchoredNoise(s, PRESSURE),
    visibilityMi: Math.max(0, baseline.visibilityMi + anchoredNoise(s, VISIBILITY)),
    dewPointF:
      baseline.dewPointF +
      0.6 * (temperatureF - baseline.temperatureF) +
      0.2 * (humidityPct - baseline.humidityPct),
    cloudCoverPct: clamp(baseline.cloudCoverPct - Math.abs(anchoredNoise(s, CLOUD)), 0, 100),
  };
}

/** True San Francisco conditions at `at`; drifts slowly from the baseline. */
export function weatherAt(at: number, origin: number): WeatherState {
  return weatherAtWithBaseline(SF_BASELINE, at, origin);
}

/** Condition label from cloud cover. */
export function conditionLabel(cloudCoverPct: number): string {
  if (cloudCoverPct >= 88) return "Overcast";
  if (cloudCoverPct >= 70) return "Mostly cloudy";
  if (cloudCoverPct >= 40) return "Partly cloudy";
  return "Mostly clear";
}

/** Coordinates and wind direction of weather locations (registry samples carry the rest). */
const WEATHER_PLACES: Readonly<Record<string, { latitude: number; longitude: number; windDirectionDeg: number }>> = {
  "san-francisco": { latitude: 37.7749, longitude: -122.4194, windDirectionDeg: 278 },
  "new-york": { latitude: 40.7128, longitude: -74.006, windDirectionDeg: 250 },
  london: { latitude: 51.5074, longitude: -0.1278, windDirectionDeg: 220 },
  seoul: { latitude: 37.5665, longitude: 126.978, windDirectionDeg: 300 },
  tokyo: { latitude: 35.6762, longitude: 139.6503, windDirectionDeg: 340 },
  singapore: { latitude: 1.3521, longitude: 103.8198, windDirectionDeg: 190 },
};

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

interface WeatherMarket {
  location: MarketLocation;
  baseline: WeatherState;
}

const weatherCache = new Map<MarketId, WeatherMarket>();

/** Location and baseline conditions of a weather market, from its registry sample. */
function weatherMarket(marketId: MarketId): WeatherMarket {
  const cached = weatherCache.get(marketId);
  if (cached) return cached;
  const spec = getMarketSpec(marketId);
  const sample = spec ? sampleForSpec(spec) : {};
  const place = WEATHER_PLACES[spec?.params.location ?? ""];
  const compassIndex = COMPASS.indexOf(String(sample.windDirection ?? ""));
  const location = sample.location as { name?: unknown } | undefined;
  const value: WeatherMarket = {
    location: {
      name: typeof location?.name === "string" ? location.name : (spec?.name ?? SF_LOCATION.name),
      latitude: place?.latitude ?? 0,
      longitude: place?.longitude ?? 0,
    },
    baseline: {
      temperatureF: num(sample.temperatureF, SF_BASELINE.temperatureF),
      humidityPct: num(sample.humidityPct, SF_BASELINE.humidityPct),
      windMph: num(sample.windMph, SF_BASELINE.windMph),
      windDirectionDeg: place?.windDirectionDeg ?? (compassIndex >= 0 ? compassIndex * 22.5 : SF_BASELINE.windDirectionDeg),
      pressureHpa: num(sample.pressureHpa, SF_BASELINE.pressureHpa),
      visibilityMi: num(sample.visibilityMi, SF_BASELINE.visibilityMi),
      dewPointF: num(sample.dewPointF, SF_BASELINE.dewPointF),
      cloudCoverPct: num(sample.cloudCoverPct, SF_BASELINE.cloudCoverPct),
    },
  };
  weatherCache.set(marketId, value);
  return value;
}

/** True conditions at `at` for any weather market; `sf-weather` is byte-identical to `weatherAt`. */
export function weatherAtFor(marketId: MarketId, at: number, origin: number): WeatherState {
  return marketId === "sf-weather" ? weatherAt(at, origin) : weatherAtWithBaseline(weatherMarket(marketId).baseline, at, origin);
}

/** Result location for any weather market; `sf-weather` is `SF_LOCATION`. */
export function weatherLocationFor(marketId: MarketId): MarketLocation {
  return marketId === "sf-weather" ? SF_LOCATION : weatherMarket(marketId).location;
}

/** Relative volatility of spot pairs vs BTC/USD (1 = same percentage moves). */
const SPOT_SENSITIVITY: Readonly<Record<string, number>> = {
  "ETH-USD": 1.2,
  "SOL-USD": 1.6,
  "XRP-USD": 1.8,
  "EUR-USD": 0.08,
  "GBP-USD": 0.09,
};

interface SpotMarket {
  pair: string;
  basePrice: number;
  sensitivity: number;
}

const spotCache = new Map<MarketId, SpotMarket>();

/** Pair, base price (registry sample), and relative volatility of a `prices.spot` market. */
function spotMarket(marketId: MarketId): SpotMarket {
  const cached = spotCache.get(marketId);
  if (cached) return cached;
  const spec = getMarketSpec(marketId);
  const sample = spec ? sampleForSpec(spec) : {};
  const pair = String(spec?.params.pair ?? sample.pair ?? "BTC-USD").toUpperCase();
  const value: SpotMarket = {
    pair,
    basePrice: num(sample.priceUsd, BTC_BASELINE_PRICE),
    sensitivity: SPOT_SENSITIVITY[pair] ?? (spec?.categoryId === "currencies" ? 0.08 : 1),
  };
  spotCache.set(marketId, value);
  return value;
}

/** True price at `at` for any `prices.spot` market; `btc-usd` is byte-identical to `btcPriceAt`. */
export function priceAtFor(marketId: MarketId, at: number, origin: number): number {
  if (marketId === "btc-usd") return btcPriceAt(at, origin);
  const spot = spotMarket(marketId);
  // Percentage moves of the BTC walk, scaled by this market's relative volatility.
  const relativeMove = anchoredNoise((at - origin) / 1000, BTC_OCTAVES) / BTC_BASELINE_PRICE;
  return spot.basePrice * (1 + spot.sensitivity * relativeMove);
}

/** Pair label of a `prices.spot` market; `btc-usd` is `"BTC-USD"`. */
export function pairFor(marketId: MarketId): string {
  return marketId === "btc-usd" ? "BTC-USD" : spotMarket(marketId).pair;
}

/** Provider bias scale per pair (BTC/USD: bias × $1.50). */
const SPOT_BIAS_SCALE: Readonly<Record<string, number>> = {
  "BTC-USD": 1,
  "ETH-USD": 0.5,
  "SOL-USD": 0.1,
  "XRP-USD": 0.002,
  "EUR-USD": 0.0001,
  "GBP-USD": 0.0001,
};

const isCurrency = (marketId: MarketId) => getMarketSpec(marketId)?.categoryId === "currencies";

/** Decimals a spot price is reported with: 4 for currencies, else 2. */
export function priceDecimalsFor(marketId: MarketId): number {
  return isCurrency(marketId) ? 4 : 2;
}

/** Provider bias scale of a spot market, so small-priced pairs stay realistic. */
export function priceBiasScaleFor(marketId: MarketId): number {
  const pair = pairFor(marketId);
  const known = SPOT_BIAS_SCALE[pair];
  if (known !== undefined) return known;
  return isCurrency(marketId) ? 0.0001 : Math.max(0.0001, spotMarket(marketId).basePrice / 10_000);
}

// ---------------------------------------------------------------------------
// Series drift of `fields` markets
// ---------------------------------------------------------------------------

/** Relative volatility of the series field by market (legacy real-world goods keep their values). */
const SERIES_SENSITIVITY: Readonly<Record<string, number>> = {
  "sz-mlcc": 0.15,
  "lithium-carbonate": 0.1,
  "freight-sha-lax": 0.12,
};

const octaveCache = new Map<MarketId, readonly Octave[]>();

/** BTC-shaped octaves with a per-market seed, so markets do not move in lockstep. */
function marketOctaves(marketId: MarketId): readonly Octave[] {
  let list = octaveCache.get(marketId);
  if (!list) {
    const seed = seedFromString(marketId);
    list = BTC_OCTAVES.map((octave, index) => ({ ...octave, seed: (seed + index * 7919) >>> 0 }));
    octaveCache.set(marketId, list);
  }
  return list;
}

/**
 * Relative volatility of a market's series field: money fields move like prices (gentle for data
 * measured in minutes), other numbers (AQI, minutes, scores) a few percent.
 */
export function seriesSensitivity(marketId: MarketId): number {
  const legacy = SERIES_SENSITIVITY[marketId];
  if (legacy !== undefined) return legacy;
  const spec = getMarketSpec(marketId);
  const contract = spec ? getContract(spec.contractId) : undefined;
  const field = contract?.output.find((f) => f.series);
  if (!contract || !field) return 0;
  if (field.type === "money") return contract.freshness.unit === "ms" ? 0.6 : 0.12;
  return contract.freshness.unit === "ms" ? 6 : 10;
}

/** Relative move of a market's series field at `at` (0 at the signal origin), e.g. 0.0012 = +0.12%. */
export function seriesMoveAt(marketId: MarketId, at: number, origin: number): number {
  const relative = anchoredNoise((at - origin) / 1000, marketOctaves(marketId)) / BTC_BASELINE_PRICE;
  return seriesSensitivity(marketId) * relative;
}

/** Registry sample of a market (contract template merged with the market's overrides). */
function sampleForSpec(spec: MarketSpec): Record<string, unknown> {
  return sampleOf(spec);
}
