/**
 * Tender registry: the structured description of every API sold on Tender.
 *
 * Hierarchy (navigation):  Group  ›  Category  ›  Market
 * Interface (what you buy): every Market implements one Contract, the normalized API
 * (typed params in, typed fields out). Providers compete for a Market through Listings.
 *
 * This module is data + pure lookups only (server- and client-safe, no React).
 */

/** Wire type of an output field. Nested objects use dotted keys ("departure.airport"). */
export type FieldType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "money"
  | "percent"
  | "timestamp"
  | "date"
  | "enum"
  | "url"
  | "list"
  | "object";

export interface FieldSpec {
  /** Dotted path into the result payload, e.g. "temperatureF" or "departure.airport". */
  key: string;
  label: string;
  type: FieldType;
  /** Display unit, e.g. "USD", "°F", "µg/m³", "min". */
  unit?: string;
  /** Headline value of the result (exactly one per contract). */
  primary?: boolean;
  /** Numeric value that moves over time: plotted and drifted by the market signal. */
  series?: boolean;
  /** Allowed values for "enum". */
  values?: readonly string[];
  /** May be absent in a valid result. */
  optional?: boolean;
  description?: string;
}

export interface ParamSpec {
  key: string;
  label: string;
  type: "string" | "number" | "enum";
  values?: readonly string[];
  example: string;
  description?: string;
}

/** Which result renderer a market uses. */
export type ResultView = "weather" | "price" | "fields";

/** What "data age" means for a contract. */
export interface FreshnessSpec {
  /** observed: time since the measurement; source: time since the source published it; generated: produced on request. */
  basis: "observed" | "source" | "generated";
  /** UI label, e.g. "Observation age". */
  label: string;
  /** Input unit for policies and conditions. */
  unit: "ms" | "min";
}

/** A normalized API. Many markets can implement the same contract with different params. */
export interface ContractSpec {
  /** "namespace.action"; the HTTP path is /api/v1/{namespace}/{action}. */
  id: string;
  version: number;
  label: string;
  description: string;
  params: readonly ParamSpec[];
  output: readonly FieldSpec[];
  freshness: FreshnessSpec;
  resultView: ResultView;
  /** Billing unit of bids. Every contract bills per request today (bids are USD per 1M requests). */
  pricingUnit: "request";
  /** Schema-shaped template result. Markets override values for their params. */
  sample: Readonly<Record<string, unknown>>;
}

/** What a buyer cares about most in a category; drives default sort and highlighted columns. */
export type MetricFocus = "freshness" | "latency" | "price";

export interface GroupSpec {
  id: string;
  label: string;
  description: string;
}

export interface CategorySpec {
  id: string;
  groupId: string;
  label: string;
  description: string;
  /** lucide-react icon name in kebab-case, e.g. "cloud", "languages". */
  icon: string;
  focus: readonly MetricFocus[];
}

export interface ProviderSpec {
  id: string;
  name: string;
  /** Local logo path; empty string renders the provider initial. */
  logo: string;
}

/** A provider's standing offer in one market (fixture defaults for its conditions). */
export interface ListingSpec {
  providerId: string;
  /** USD per 1M requests. */
  bidPrice: number;
  p95LatencyMs: number;
  dataAgeMs: number;
  /** 0..1 */
  errorRate: number;
  available: boolean;
  /** Small deterministic offset of the values this provider reports (-1..1). */
  bias: number;
}

export interface MarketImage {
  src: string;
  /** Optional modern format of the same image. */
  avif?: string;
  alt: string;
}

export interface MarketSpec {
  id: string;
  categoryId: string;
  contractId: string;
  /** Values bound to the contract params, e.g. { location: "seoul" }. */
  params: Readonly<Record<string, string>>;
  name: string;
  shortName: string;
  description: string;
  /** lucide icon override (defaults to the category icon). */
  icon?: string;
  image?: MarketImage;
  /** IANA time zone for timestamps. */
  timeZone: string;
  /** upstream: anchored to a live upstream reference; signal: deterministic Tender signal. Internal, not shown as a badge. */
  source: "upstream" | "signal";
  /** Shown first in the directory's Recommended order. */
  featured?: boolean;
  /** Overrides merged over the contract sample (dotted keys allowed). */
  sample?: Readonly<Record<string, unknown>>;
  listings: readonly ListingSpec[];
}

export interface Breadcrumb {
  group: GroupSpec;
  category: CategorySpec;
  market: MarketSpec;
}
