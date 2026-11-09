/** Identity of a provider as charts show it. */
export interface VizProvider {
  name: string;
  /** Logo path under `/public`, e.g. `/providers/the-zone-bio.jpg`. */
  logo?: string;
  /** Series color. Default: `providerColor(id, providerIds)`. */
  color?: string;
}

export type VizProviders = Readonly<Record<string, VizProvider>>;

/** One request on the BTC/USD price chart. */
export interface PricePoint {
  /** Source timestamp (epoch ms). Points are drawn in time order. */
  t: number;
  /** Price in USD. Ignored for failed requests. */
  price: number;
  /** Provider that served (or failed) the request. */
  providerId?: string;
  /** Failed requests are marked on the time axis and left out of the line. Default `ok`. */
  status?: "ok" | "failed";
  /** Request id, shown in the tooltip when present. */
  id?: string;
}

export type TimelineStatus = "ok" | "failed" | "rejected";

/** One request on the latency strip. */
export interface TimelineRequest {
  id: string;
  /** Request time (epoch ms). */
  t: number;
  /** Request latency. Null for rejected requests (they are not sent). */
  latencyMs: number | null;
  /** Serving provider. Null for rejected requests. */
  providerId: string | null;
  status: TimelineStatus;
}
