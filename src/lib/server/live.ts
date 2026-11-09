/**
 * Live markets: the same normalized contract fetched from several real, keyless upstreams in parallel.
 * Latency, data age and success rate are measured per call; routing reuses the shared engine.
 * ponytail: in-memory rolling stats per instance (resets on cold start); move to KV when multi-instance matters.
 */
import { evaluateMarket } from "@/lib/tender/evaluate";
import type { RoutingPolicy } from "@/lib/tender/types";

type Fetcher = (signal: AbortSignal) => Promise<{ value: number; observedAt: number }>;
interface LiveProvider { id: string; name: string; bidPrice: number; fetch: Fetcher }

const TIMEOUT_MS = 9000;
const WINDOW = 50;

async function get(url: string, signal: AbortSignal, headers: Record<string, string> = {}) {
  const r = await fetch(url, { signal, cache: "no-store", headers: { Accept: "application/json", "User-Agent": "tender/0.1 (me@thezonebio.com)", ...headers } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const num = (v: unknown) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error("bad number"); return n; };
const now = () => Date.now();
/** "08:13 PM" (UTC) → the most recent such instant. */
function utcClockToday(clock: string): number {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(clock);
  if (!m) throw new Error("bad clock");
  const d = new Date();
  d.setUTCHours((Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0), Number(m[2]), 0, 0);
  if (d.getTime() > now()) d.setUTCDate(d.getUTCDate() - 1);
  return d.getTime();
}

const BTC: LiveProvider[] = [
  { id: "coinbase", name: "Coinbase", bidPrice: 0, fetch: async (s) => { const d = await get("https://api.exchange.coinbase.com/products/BTC-USD/ticker", s); return { value: (num(d.bid) + num(d.ask)) / 2, observedAt: Date.parse(d.time) }; } },
  { id: "kraken", name: "Kraken", bidPrice: 0, fetch: async (s) => { const d = await get("https://api.kraken.com/0/public/Ticker?pair=XBTUSD", s); const t = Object.values(d.result)[0] as { b: string[]; a: string[] }; return { value: (num(t.b[0]) + num(t.a[0])) / 2, observedAt: now() }; } },
  { id: "bitstamp", name: "Bitstamp", bidPrice: 0, fetch: async (s) => { const d = await get("https://www.bitstamp.net/api/v2/ticker/btcusd/", s); return { value: (num(d.bid) + num(d.ask)) / 2, observedAt: num(d.timestamp) * 1000 }; } },
  { id: "gemini", name: "Gemini", bidPrice: 0, fetch: async (s) => { const d = await get("https://api.gemini.com/v1/pubticker/btcusd", s); return { value: (num(d.bid) + num(d.ask)) / 2, observedAt: num(d.volume.timestamp) }; } },
  { id: "okx", name: "OKX", bidPrice: 0, fetch: async (s) => { const d = await get("https://www.okx.com/api/v5/market/ticker?instId=BTC-USD", s); const t = d.data?.[0]; if (!t) throw new Error(`OKX ${d.code ?? "?"}: ${d.msg || "no ticker"}`); return { value: (num(t.bidPx) + num(t.askPx)) / 2, observedAt: num(t.ts) }; } },
  { id: "binance-us", name: "Binance.US", bidPrice: 0, fetch: async (s) => { const d = await get("https://api.binance.us/api/v3/ticker/bookTicker?symbol=BTCUSD", s); return { value: (num(d.bidPrice) + num(d.askPrice)) / 2, observedAt: now() }; } },
  { id: "coingecko", name: "CoinGecko", bidPrice: 0, fetch: async (s) => { const d = await get("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true", s); return { value: num(d.bitcoin.usd), observedAt: num(d.bitcoin.last_updated_at) * 1000 }; } },
];

const WEATHER: LiveProvider[] = [
  { id: "open-meteo", name: "Open-Meteo", bidPrice: 0, fetch: async (s) => { const d = await get("https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m&temperature_unit=fahrenheit&timezone=UTC", s); return { value: num(d.current.temperature_2m), observedAt: Date.parse(`${d.current.time}Z`) }; } },
  { id: "nws", name: "US National Weather Service", bidPrice: 0, fetch: async (s) => { const d = await get("https://api.weather.gov/stations/KSFO/observations/latest", s, { Accept: "application/geo+json" }); return { value: num(d.properties.temperature.value) * 9 / 5 + 32, observedAt: Date.parse(d.properties.timestamp) }; } },
  { id: "met-no", name: "MET Norway", bidPrice: 0, fetch: async (s) => { const d = await get("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=37.7749&lon=-122.4194", s); const t = d.properties.timeseries[0]; return { value: num(t.data.instant.details.air_temperature) * 9 / 5 + 32, observedAt: Date.parse(d.properties.meta.updated_at) }; } },
  { id: "wttr", name: "wttr.in", bidPrice: 0, fetch: async (s) => { const d = await get("https://wttr.in/San+Francisco?format=j1", s); const c = d.current_condition[0]; return { value: num(c.temp_F), observedAt: utcClockToday(c.observation_time) }; } },
];

export const LIVE_MARKETS = {
  "btc-usd": { contract: 'prices.spot({ pair: "BTC-USD" })', unit: "USD", providers: BTC },
  "sf-weather": { contract: 'weather.current({ location: "san-francisco" }).temperature_f', unit: "°F", providers: WEATHER },
} as const;
export type LiveMarketId = keyof typeof LIVE_MARKETS;

const history = new Map<string, { ok: boolean; latencyMs: number }[]>();

async function probe(p: LiveProvider) {
  const started = performance.now();
  try {
    const r = await p.fetch(AbortSignal.timeout(TIMEOUT_MS));
    const latencyMs = Math.round(performance.now() - started);
    return { id: p.id, ok: true as const, latencyMs, value: r.value, dataAgeMs: Math.max(0, now() - r.observedAt) };
  } catch (e) {
    return { id: p.id, ok: false as const, latencyMs: Math.round(performance.now() - started), error: e instanceof Error ? e.message : String(e) };
  }
}

const p95 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)] ?? 0; };

/** Probe every provider of a market now, update rolling stats, and route with the shared engine. */
export async function runLive(market: LiveMarketId, policy: RoutingPolicy) {
  const def = LIVE_MARKETS[market];
  const probes = await Promise.all(def.providers.map(probe));
  const rows = def.providers.map((p, i) => {
    const r = probes[i];
    const h = [...(history.get(p.id) ?? []), { ok: r.ok, latencyMs: r.latencyMs }].slice(-WINDOW);
    history.set(p.id, h);
    const okLat = h.filter((x) => x.ok).map((x) => x.latencyMs);
    const errorRate = 1 - h.filter((x) => x.ok).length / h.length;
    return {
      id: p.id, name: p.name, probe: r, samples: h.length,
      conditions: { bidPrice: p.bidPrice, p95LatencyMs: okLat.length ? p95(okLat) : TIMEOUT_MS, dataAgeMs: r.ok ? r.dataAgeMs : Number.MAX_SAFE_INTEGER, errorRate, available: r.ok },
    };
  });
  const evaluation = evaluateMarket(rows, policy);
  const values = probes.flatMap((r) => (r.ok ? [r.value] : [])).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : null;
  const pinned = policy.mode.kind === "pinned" ? policy.mode.providerId : null;
  const winner = rows.find((r) => r.id === (pinned ?? evaluation.recommendedId));
  return {
    market, contract: def.contract, unit: def.unit, policy, measured_at: new Date().toISOString(),
    served_by: winner ? {
      provider: winner.id, name: winner.name, value: winner.probe.ok ? winner.probe.value : null,
      route_reason: pinned ? "pinned" : policy.preference,
      policy_violation: pinned ? !evaluation.byId[winner.id].qualifies : false,
      error: winner.probe.ok ? undefined : winner.probe.error,
    } : null,
    consensus: { median, spread: values.length ? values[values.length - 1] - values[0] : null, providers_ok: values.length, providers_total: rows.length },
    providers: rows.map((r) => ({
      id: r.id, name: r.name, ...evaluation.byId[r.id],
      measured: { ok: r.probe.ok, latency_ms: r.probe.latencyMs, value: r.probe.ok ? r.probe.value : null, data_age_ms: r.probe.ok ? r.probe.dataAgeMs : null, error: r.probe.ok ? undefined : r.probe.error, deviation_from_median: r.probe.ok && median != null ? r.probe.value - median : null },
      rolling: { samples: r.samples, p95_latency_ms: r.conditions.p95LatencyMs, success_rate: 1 - r.conditions.errorRate },
    })),
  };
}
