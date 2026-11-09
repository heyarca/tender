import type { QuoteMarketId } from "../types";

/** Contract input of each quote market (one supported value, like the other markets). */
export const QUOTE_CONTRACTS: Record<QuoteMarketId, { path: string; key: string; value: string; namespace: string; unit: string; symbol: string }> = {
  "sz-mlcc": { path: "/api/v1/components/spot", key: "part", value: "MLCC-0402-100NF", namespace: "components.spot", unit: "USD/reel", symbol: "MLCC 0402 100nF X7R 16V · 10k reel" },
  "lithium-carbonate": { path: "/api/v1/commodities/spot", key: "symbol", value: "LI2CO3-CN", namespace: "commodities.spot", unit: "USD/t", symbol: "Lithium carbonate 99.5% · CIF China" },
  "freight-sha-lax": { path: "/api/v1/freight/rate", key: "lane", value: "SHA-LAX", namespace: "freight.rate", unit: "USD/FEU", symbol: "Shanghai → Los Angeles · 40ft" },
};

/** Quote market ids. */
export const QUOTE_MARKET_IDS = Object.keys(QUOTE_CONTRACTS) as QuoteMarketId[];

/** Type guard: the market serves an indicative quote payload. */
export function isQuoteMarketId(value: unknown): value is QuoteMarketId {
  return typeof value === "string" && Object.hasOwn(QUOTE_CONTRACTS, value);
}
