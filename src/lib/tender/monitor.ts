/**
 * Monitoring and history (SPEC §4.4): 30 seeded samples per provider, one
 * sample per provider on every monitor tick, and an exact sample right after a
 * condition change so sparklines jump visibly.
 */
import { HISTORY_LIMIT, MONITOR_INTERVAL_MS } from "./constants";
import type { Rng } from "./random";
import type { MarketState, ProviderConditions, ProviderSample, ProviderState } from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** One noisy monitor sample around the current conditions. */
export function sampleConditions(rng: Rng, conditions: ProviderConditions, at: number): ProviderSample {
  const latencyNoise = clamp(rng.normal() * 0.06, -0.15, 0.15);
  const ageNoise = clamp(rng.normal() * 0.08, -0.2, 0.2);
  const errorNoise = clamp(rng.normal() * 0.35, -0.8, 0.8);
  return {
    at,
    p95LatencyMs: Math.max(1, Math.round(conditions.p95LatencyMs * (1 + latencyNoise))),
    dataAgeMs: Math.max(0, Math.round(conditions.dataAgeMs * (1 + ageNoise))),
    successRate: conditions.available ? clamp(1 - conditions.errorRate * (1 + errorNoise), 0, 1) : 0,
    bidPrice: conditions.bidPrice,
    available: conditions.available,
  };
}

/** Exact sample of the current conditions (used right after an edit). */
export function exactSample(conditions: ProviderConditions, at: number): ProviderSample {
  return {
    at,
    p95LatencyMs: conditions.p95LatencyMs,
    dataAgeMs: conditions.dataAgeMs,
    successRate: conditions.available ? 1 - conditions.errorRate : 0,
    bidPrice: conditions.bidPrice,
    available: conditions.available,
  };
}

/** `HISTORY_LIMIT` samples ending at `end`, one per monitor interval. */
export function seedHistory(rng: Rng, conditions: ProviderConditions, end: number): ProviderSample[] {
  return Array.from({ length: HISTORY_LIMIT }, (_, index) =>
    sampleConditions(rng, conditions, end - (HISTORY_LIMIT - 1 - index) * MONITOR_INTERVAL_MS),
  );
}

/** Append a sample, keeping the last `HISTORY_LIMIT`. */
export function appendSample(provider: ProviderState, sample: ProviderSample): ProviderState {
  const history = provider.history.length >= HISTORY_LIMIT ? provider.history.slice(1) : provider.history.slice();
  history.push(sample);
  return { ...provider, history };
}

/** Monitor tick for one market: one noisy sample per provider. Advances the market PRNG. */
export function monitorMarket(market: MarketState, rng: Rng, now: number): MarketState {
  return {
    ...market,
    providers: market.providers.map((provider) => appendSample(provider, sampleConditions(rng, provider.conditions, now))),
  };
}
