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
  contract: string;
  provider_count: number;
  [key: string]: unknown;
}

export interface TenderRequestResult {
  status: number;
  provider: string | null;
  data?: unknown;
  paymentRequired?: unknown;
}

export interface TenderClient {
  baseUrl: string;
  markets(): Promise<TenderMarketSummary[]>;
  market(id: string, policy?: TenderPolicy): Promise<unknown>;
  request(id: string, policy?: TenderPolicy): Promise<TenderRequestResult>;
}

export declare function createTender(options?: { baseUrl?: string; fetch?: typeof fetch }): TenderClient;

export declare function contractPathFor(market: { identifier?: string }): string;
