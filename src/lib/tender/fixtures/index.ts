/**
 * Static market definitions (SPEC §3). Server-safe.
 */
import type {
  MarketDefinition,
  MarketId,
  NumericInputSpec,
  ProviderFixture,
  ProviderId,
  RoutingPolicy,
} from "../types";
import { BTC_USD } from "./btc-usd";
import { SF_WEATHER } from "./sf-weather";
import { FREIGHT_SHA_LAX, LITHIUM_CARBONATE, SZ_MLCC } from "./quotes";

export { BTC_USD, BTC_USD_DEFAULT_POLICY, BTC_USD_PROVIDERS } from "./btc-usd";
export { SF_WEATHER, SF_WEATHER_DEFAULT_POLICY, SF_WEATHER_PROVIDERS } from "./sf-weather";
export { FREIGHT_SHA_LAX, isQuoteMarketId, LITHIUM_CARBONATE, QUOTE_CONTRACTS, QUOTE_MARKET_IDS, SZ_MLCC } from "./quotes";

/** Market ids in display order. */
export const MARKET_IDS = ["sf-weather", "btc-usd", "sz-mlcc", "lithium-carbonate", "freight-sha-lax"] as const satisfies readonly MarketId[];

/** Market definitions by id. */
export const MARKETS: Readonly<Record<MarketId, MarketDefinition>> = {
  "sf-weather": SF_WEATHER,
  "btc-usd": BTC_USD,
  "sz-mlcc": SZ_MLCC,
  "lithium-carbonate": LITHIUM_CARBONATE,
  "freight-sha-lax": FREIGHT_SHA_LAX,
};

/** Default market for `/`. */
export const DEFAULT_MARKET_ID: MarketId = "sf-weather";

/** Type guard for route params. */
export function isMarketId(value: unknown): value is MarketId {
  return typeof value === "string" && (MARKET_IDS as readonly string[]).includes(value);
}

/** Market definition by id. */
export function getMarketDefinition(marketId: MarketId): MarketDefinition {
  return MARKETS[marketId];
}

/** Provider fixture by id, or `undefined`. */
export function getProviderFixture(marketId: MarketId, providerId: ProviderId): ProviderFixture | undefined {
  return MARKETS[marketId].providers.find((provider) => provider.id === providerId);
}

/** A copy of the market's default policy. */
export function getDefaultPolicy(marketId: MarketId): RoutingPolicy {
  const policy = MARKETS[marketId].defaultPolicy;
  return { ...policy, mode: { ...policy.mode } };
}

/** Engine value → input display value (e.g. 900000 ms → 15 min, 0.995 → 99.5). */
export function toDisplayValue(spec: NumericInputSpec, value: number): number {
  return Number((value / spec.factor).toFixed(spec.decimals + 2));
}

/** Input display value → engine value (e.g. 15 min → 900000 ms, 99.5 → 0.995). */
export function fromDisplayValue(spec: NumericInputSpec, display: number): number {
  return Number((display * spec.factor).toFixed(10));
}
