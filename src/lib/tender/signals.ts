/**
 * Deterministic market signals: the "true" value of each market at any time.
 * Pure functions of `(time − signalOrigin)`, so rebasing all timestamps by the
 * same delta keeps every value unchanged.
 */
import { hashNormal } from "./random";

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

/** True San Francisco conditions at `at`; drifts slowly from the baseline. */
export function weatherAt(at: number, origin: number): WeatherState {
  const s = (at - origin) / 1000;
  const temperatureF = SF_BASELINE.temperatureF + anchoredNoise(s, TEMP);
  const humidityPct = clamp(SF_BASELINE.humidityPct + anchoredNoise(s, HUMIDITY), 0, 100);
  return {
    temperatureF,
    humidityPct,
    windMph: Math.max(0, SF_BASELINE.windMph + anchoredNoise(s, WIND)),
    windDirectionDeg: (SF_BASELINE.windDirectionDeg + anchoredNoise(s, WIND_DIR) + 360) % 360,
    pressureHpa: SF_BASELINE.pressureHpa + anchoredNoise(s, PRESSURE),
    visibilityMi: Math.max(0, SF_BASELINE.visibilityMi + anchoredNoise(s, VISIBILITY)),
    dewPointF:
      SF_BASELINE.dewPointF +
      0.6 * (temperatureF - SF_BASELINE.temperatureF) +
      0.2 * (humidityPct - SF_BASELINE.humidityPct),
    cloudCoverPct: clamp(SF_BASELINE.cloudCoverPct - Math.abs(anchoredNoise(s, CLOUD)), 0, 100),
  };
}

/** Condition label from cloud cover. */
export function conditionLabel(cloudCoverPct: number): string {
  if (cloudCoverPct >= 88) return "Overcast";
  if (cloudCoverPct >= 70) return "Mostly cloudy";
  if (cloudCoverPct >= 40) return "Partly cloudy";
  return "Mostly clear";
}
