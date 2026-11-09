export declare const DEFAULT_BASE_URL: "https://tender.heyarca.app";

export interface TenderPolicy {
  /** Highest bid you accept, USD per 1M requests. */
  maxPrice?: number;
  maxP95LatencyMs?: number;
  maxDataAgeMs?: number;
  /** 0..1, for example 0.999. */
  minSuccessRate?: number;
  preference?: "lowest-cost" | "lowest-latency" | "freshest-data";
  /** Provider id to pin instead of automatic switching. */
  pin?: string;
}

export interface TenderMarketSummary {
  id: string;
  name: string;
  identifier: string;
  group: { id: string; label: string } | null;
  category: { id: string; label: string } | null;
  /** Contract call with the market's params bound, e.g. `translation.text({ source: "en", target: "ko" })`. */
  contract: string;
  contract_id: string;
  /** "/api/v1/translation/text" */
  contract_path: string;
  /** "/api/v1/translation/text?source=en&target=ko" */
  contract_url: string;
  params: Record<string, string>;
  provider_count: number;
  [key: string]: unknown;
}

export interface TenderCategoryGroup {
  id: string;
  label: string;
  description: string;
  market_count: number;
  categories: { id: string; label: string; description: string; icon: string; focus: string[]; market_count: number }[];
}

export interface TenderContract {
  id: string;
  label: string;
  description: string;
  path: string;
  params: { key: string; label: string; type: string; example: string }[];
  output: { key: string; label: string; type: string; unit?: string; primary?: boolean; optional?: boolean }[];
  output_schema: Record<string, unknown>;
  markets: { id: string; params: Record<string, string> }[];
  [key: string]: unknown;
}

export interface TenderRequestResult {
  status: number;
  provider: string | null;
  /** Contract-shaped result (`response.data`). */
  data?: unknown;
  /** Full JSON body: request id, market, contract, provider, latency, data age, settlement, data. */
  response?: unknown;
  paymentRequired?: unknown;
}

export interface TenderClient {
  baseUrl: string;
  markets(): Promise<TenderMarketSummary[]>;
  categories(): Promise<TenderCategoryGroup[]>;
  contracts(): Promise<TenderContract[]>;
  market(id: string, policy?: TenderPolicy): Promise<unknown>;
  request(id: string, policy?: TenderPolicy): Promise<TenderRequestResult>;
}

export declare function createTender(options?: { baseUrl?: string; fetch?: typeof fetch }): TenderClient;

/** Contract URL of a market from the API (`contract_url`). */
export declare function contractPathFor(market: { id?: string; contract_url?: string; contract_path?: string }): string;
