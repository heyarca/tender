/**
 * Deterministic market signals: the "true" value of each market at any time.
 * Pure functions of `(time − signalOrigin)`, so rebasing all timestamps by the
 * same delta keeps every value unchanged.
 */
import { hashNormal } from "./random";
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

/** Location and baseline conditions for every weather market besides San Francisco. */
export const WEATHER_MARKETS: Partial<Record<MarketId, { location: MarketLocation; baseline: WeatherState }>> = {
  "ny-weather": {
    location: { name: "New York, NY", latitude: 40.7128, longitude: -74.006 },
    baseline: {
      temperatureF: 52,
      humidityPct: 68,
      windMph: 12,
      windDirectionDeg: 250,
      pressureHpa: 1015,
      visibilityMi: 8,
      dewPointF: 42,
      cloudCoverPct: 55,
    },
  },
  "london-weather": {
    location: { name: "London, UK", latitude: 51.5074, longitude: -0.1278 },
    baseline: {
      temperatureF: 48,
      humidityPct: 78,
      windMph: 14,
      windDirectionDeg: 220,
      pressureHpa: 1009,
      visibilityMi: 6,
      dewPointF: 42,
      cloudCoverPct: 85,
    },
  },
  "seoul-weather": {
    location: { name: "Seoul, South Korea", latitude: 37.5665, longitude: 126.978 },
    baseline: {
      temperatureF: 41,
      humidityPct: 55,
      windMph: 7,
      windDirectionDeg: 300,
      pressureHpa: 1022,
      visibilityMi: 9,
      dewPointF: 27,
      cloudCoverPct: 20,
    },
  },
  "tokyo-weather": {
    location: { name: "Tokyo, Japan", latitude: 35.6762, longitude: 139.6503 },
    baseline: {
      temperatureF: 57,
      humidityPct: 60,
      windMph: 9,
      windDirectionDeg: 340,
      pressureHpa: 1016,
      visibilityMi: 11,
      dewPointF: 44,
      cloudCoverPct: 35,
    },
  },
  "singapore-weather": {
    location: { name: "Singapore", latitude: 1.3521, longitude: 103.8198 },
    baseline: {
      temperatureF: 86,
      humidityPct: 82,
      windMph: 6,
      windDirectionDeg: 190,
      pressureHpa: 1010,
      visibilityMi: 6,
      dewPointF: 78,
      cloudCoverPct: 70,
    },
  },
};

/** True conditions at `at` for any weather market; `sf-weather` is byte-identical to `weatherAt`. */
export function weatherAtFor(marketId: MarketId, at: number, origin: number): WeatherState {
  const other = WEATHER_MARKETS[marketId];
  return other ? weatherAtWithBaseline(other.baseline, at, origin) : weatherAt(at, origin);
}

/** Result location for any weather market; `sf-weather` is `SF_LOCATION`. */
export function weatherLocationFor(marketId: MarketId): MarketLocation {
  return WEATHER_MARKETS[marketId]?.location ?? SF_LOCATION;
}

/** Baseline price and noise sensitivity (relative to the BTC/USD noise) for every price market besides BTC/USD. */
export const PRICE_MARKETS: Partial<Record<MarketId, { pair: string; basePrice: number; sensitivity: number }>> = {
  "eth-usd": { pair: "ETH-USD", basePrice: 3180.4, sensitivity: 1 },
  "sol-usd": { pair: "SOL-USD", basePrice: 148.25, sensitivity: 1 },
  "xrp-usd": { pair: "XRP-USD", basePrice: 2.14, sensitivity: 1 },
  "eur-usd": { pair: "EUR-USD", basePrice: 1.0812, sensitivity: 0.02 },
  "gbp-usd": { pair: "GBP-USD", basePrice: 1.2734, sensitivity: 0.02 },
};

/** True price at `at` for any price market; `btc-usd` is byte-identical to `btcPriceAt`. */
export function priceAtFor(marketId: MarketId, at: number, origin: number): number {
  const other = PRICE_MARKETS[marketId];
  if (!other) return btcPriceAt(at, origin);
  const noise = anchoredNoise((at - origin) / 1000, BTC_OCTAVES);
  return other.basePrice + other.sensitivity * noise;
}

/** Pair label for any price market; `btc-usd` is `"BTC-USD"`. */
export function pairFor(marketId: MarketId): string {
  return PRICE_MARKETS[marketId]?.pair ?? "BTC-USD";
}
