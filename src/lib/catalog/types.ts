/**
 * Static types for the catalog preview. This catalog is intentionally separate
 * from the Tender engine types: its ids must not widen the runnable engine.
 */

export type CatalogIconKey =
  | "chart"
  | "fuel"
  | "plane"
  | "wind"
  | "trophy"
  | "package"
  | "route"
  | "map-pin"
  | "network"
  | "building"
  | "badge-check"
  | "shield-check"
  | "message-square"
  | "layers"
  | "microphone"
  | "volume-2"
  | "image"
  | "languages"
  | "file-search"
  | "search";

export interface CatalogProviderDemo {
  /** Existing product provider id and local logo path; this is not an affiliation claim. */
  id: string;
  name: string;
  logo: string;
  /** Illustrative USD per one million requests. */
  pricePerMillionUsd: number;
  p95LatencyMs: number;
  /** Illustrative source/result age at demo time. */
  freshnessMs: number;
  /** Illustrative rolling success rate from 0 to 1. */
  successRate: number;
}

export interface CatalogMarketDemo {
  id: string;
  name: string;
  identifier: string;
  contract: string;
  description: string;
  category: string;
  /** Static, schema-shaped example only. It never represents a live response. */
  sampleResult: Record<string, unknown>;
  providers: readonly CatalogProviderDemo[];
}

export interface CatalogCategory {
  id: string;
  label: string;
  description: string;
  iconKey: CatalogIconKey;
  markets: readonly CatalogMarketDemo[];
}
