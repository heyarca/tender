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
  /** 402 response body: provider, payee, price, and settlement amount. */
  paymentRequired?: unknown;
  /** Decoded `PAYMENT-REQUIRED` header (x402 v2): `{ x402Version, resource, accepts: [{ scheme, network, amount, asset, payTo, ... }] }`. */
  paymentRequirements?: TenderPaymentRequirements | null;
}

export interface TenderPaymentRequirements {
  x402Version: number;
  error?: string;
  resource?: { url: string; description?: string; mimeType?: string };
  accepts: {
    scheme: string;
    network: string;
    /** Amount in the asset's smallest unit (USDC has 6 decimals). */
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds?: number;
    extra?: Record<string, unknown>;
  }[];
  [key: string]: unknown;
}

export interface TenderCallResult {
  status: number;
  provider: string | null;
  /** Display name from market metadata, or null when the provider is unknown. */
  providerName: string | null;
  /** Contract-shaped result (`response.data`). */
  data: unknown;
  /** Credits charged for this request and the balance after it, in micro-USD (1 USD = 1,000,000). */
  payment: { charged_micros: number | null; balance_micros: number | null };
  /** Full JSON body: request id, market, contract, provider, latency, data age, payment, data. */
  response: unknown;
}

export interface TenderLedgerEntry {
  id: string;
  kind: string;
  /** Positive for credits, negative for debits, micro-USD. */
  amount_micros: number;
  balance_after_micros: number;
  actor: string;
  market_id: string | null;
  provider_id: string | null;
  request_id: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  created_at: string;
}

export interface TenderAccount {
  has_account: boolean;
  balance_micros: number;
  mandate: { weekly_cap_micros: number; spent_this_week_micros: number; policy: unknown; has_vault: boolean; approved_at: string } | null;
  ledger: TenderLedgerEntry[];
}

export interface TenderClient {
  baseUrl: string;
  /** True when an API key is set (`apiKey` option or `TENDER_API_KEY`). */
  hasApiKey: boolean;
  markets(): Promise<TenderMarketSummary[]>;
  categories(): Promise<TenderCategoryGroup[]>;
  contracts(): Promise<TenderContract[]>;
  market(id: string, policy?: TenderPolicy): Promise<unknown>;
  request(id: string, policy?: TenderPolicy): Promise<TenderRequestResult>;
  /**
   * Call a market's contract and pay the winning bid with Tender credits (needs an API key).
   * Throws an `Error` with `status` 402 when the balance is too low and 409 when no provider meets the policy.
   */
  callMarket(id: string, options?: { params?: Record<string, string | number>; policy?: TenderPolicy }): Promise<TenderCallResult>;
  /** Credits balance, spending limit, and the last 20 ledger entries (needs an API key). */
  balance(): Promise<TenderAccount>;
}

export interface TenderOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Tender API key (`tk_...`). Defaults to the `TENDER_API_KEY` environment variable. */
  apiKey?: string;
}

export declare function createTender(options?: TenderOptions): TenderClient;

/** Format micro-USD as dollars: 18 -> "$0.000018", 5000000 -> "$5.00". */
export declare function formatMicros(micros: number): string;

/** Contract URL of a market from the API (`contract_url`). */
export declare function contractPathFor(market: { id?: string; contract_url?: string; contract_path?: string }): string;
