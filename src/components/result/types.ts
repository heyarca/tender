/** Identity of the provider that served (or failed) a request. */
export interface ResultProvider {
  id: string;
  name: string;
  /** Logo path under `/public`, e.g. `/providers/together.png`. */
  logo?: string;
}

export type ResultStatus = "ok" | "failed" | "rejected";

/** The latest request of a market, whatever its outcome. */
export interface ResultRequest {
  /** Request id, e.g. `req_000123`. */
  id: string;
  status: ResultStatus;
  /** Serving (or failing) provider. Null when the request was rejected. */
  provider: ResultProvider | null;
  /** Request latency. Null when the request was not sent. */
  latencyMs: number | null;
  /** Error text for failed requests (`503 Service Unavailable`) or the reason for a rejection. */
  error?: string;
}

export type WeatherCondition =
  | "clear"
  | "mostly-clear"
  | "partly-cloudy"
  | "mostly-cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "wind";

/** Normalized `weather.current()` payload, as displayed. */
export interface WeatherReading {
  /** `San Francisco, CA`. */
  location: string;
  /** Observation time (epoch ms). */
  observedAt: number;
  /** Observation age when the response arrived (ms). */
  dataAgeMs: number;
  temperatureF: number;
  feelsLikeF: number;
  /** Condition code (`overcast`) or display label (`Partly cloudy`); both map to an icon. */
  condition: WeatherCondition | (string & {});
  /** Display label. Default: the label for `condition`. */
  conditionLabel?: string;
  /** Relative humidity, 0–100. */
  humidityPct: number;
  windMph: number;
  /** Wind bearing in degrees (278 → `W`). */
  windDirectionDeg: number;
  pressureHpa: number;
  visibilityMi: number;
  dewPointF: number;
  /** Cloud cover, 0–100. */
  cloudCoverPct: number;
}

/** Normalized `prices.spot()` payload, as displayed. */
export interface BitcoinQuote {
  /** `BTC/USD`. */
  pair: string;
  /** Spot mid price in USD. */
  price: number;
  /** Change in USD against the previous served request. Takes precedence over `previousPrice`. */
  change?: number | null;
  /** Price from the previous served request, used to derive the change when `change` is not set. */
  previousPrice?: number | null;
  /** Source timestamp (epoch ms). */
  sourceTimestamp: number;
  /** Data age when the response arrived (ms). */
  dataAgeMs: number;
  /** Request latency (ms). */
  latencyMs: number;
}

/** Normalized result of any other contract (`FieldsPayload` from the engine), as displayed. */
export interface FieldsReading {
  /** Contract id, e.g. `components.price`. */
  contractId: string;
  /** Schema-shaped result (dotted field keys read nested values). */
  values: Readonly<Record<string, unknown>>;
  /** Source time of the data (epoch ms). */
  sourceTimestamp: number;
  /** Change of the contract's series field vs the previous served request, or `null`. */
  change: number | null;
  /** Data age when the response arrived (ms). */
  dataAgeMs: number;
  /** Request latency (ms). */
  latencyMs: number;
}
