import { getApiSnippets } from "../snippets";
import type { MarketDefinition, MarketIcon, PriceMarketId, ProviderFixture, RoutingPolicy } from "../types";

/**
 * Real-world goods priced through the price contract (`prices.spot`). Values come from a
 * sample index, not a live exchange or freight feed; the price definition says so.
 * Providers other than Arca Labs are fictional and show their initial instead of a logo.
 */
const MIN = 60_000;

const provider = (id: string, name: string, bidPrice: number, p95LatencyMs: number, dataAgeMin: number, errorRate: number, bias: number, logo = ""): ProviderFixture => ({
  id,
  name,
  logo,
  defaults: { bidPrice, p95LatencyMs, dataAgeMs: dataAgeMin * MIN, errorRate, available: true },
  bias,
});
const arcaLabs = (bidPrice: number, p95LatencyMs: number, dataAgeMin: number, errorRate: number) =>
  provider("arca-labs", "Arca Labs", bidPrice, p95LatencyMs, dataAgeMin, errorRate, -0.2, "/providers/arca-labs.png");

interface Spec {
  id: PriceMarketId;
  name: string;
  shortName: string;
  pair: string;
  icon: MarketIcon;
  description: string;
  priceDefinition: string;
  unit: string;
  policy: RoutingPolicy;
  providers: ProviderFixture[];
  sample: number;
}

const input = (label: string, unit: string, min: number, max: number, step: number, decimals: number, factor: number, hint: string, prefix?: string) => ({
  label, unit, min, max, step, decimals, factor, hint, ...(prefix ? { prefix } : {}),
});

function build(spec: Spec): MarketDefinition {
  const identifier = `prices/${spec.pair.toLowerCase()}`;
  return {
    id: spec.id,
    name: spec.name,
    shortName: spec.shortName,
    identifier,
    contract: `prices.spot({ pair: "${spec.pair}" })`,
    description: spec.description,
    timeZone: "UTC",
    timeZoneLabel: "UTC",
    icon: spec.icon,
    units: { price: "/M req", dataAge: "ms", value: spec.unit },
    priceDefinition: spec.priceDefinition,
    resultFields: [
      { key: "pair", label: "Instrument" },
      { key: "priceUsd", label: "Price", unit: spec.unit },
      { key: "changeUsd", label: "Change vs previous request", unit: "USD" },
      { key: "sourceTimestamp", label: "Source timestamp" },
    ],
    defaultPolicy: spec.policy,
    policyInputs: {
      maxPrice: input("Max price", "/M req", 0, 200, 0.5, 2, 1, "Highest bid you accept, in USD per 1M requests.", "$"),
      maxP95LatencyMs: input("Max P95 latency", "ms", 50, 3000, 10, 0, 1, "95% of requests must finish within this time."),
      maxDataAgeMs: input("Max data age", "ms", 1000, 43_200_000, 60_000, 0, 1, "Oldest quote you accept at response time."),
      minSuccessRate: input("Min success rate", "%", 90, 100, 0.01, 2, 0.01, "Share of requests that must succeed."),
    },
    conditionInputs: {
      bidPrice: input("Bid", "/M req", 0.5, 400, 0.5, 2, 1, "What the provider charges, in USD per 1M requests.", "$"),
      p95LatencyMs: input("P95 latency", "ms", 10, 5000, 10, 0, 1, "95th percentile request latency."),
      dataAgeMs: input("Data age", "ms", 0, 86_400_000, 60_000, 0, 1, "Age of the quote the provider returns."),
      errorRate: input("Error rate", "%", 0, 20, 0.01, 2, 0.01, "Share of requests that fail."),
    },
    providers: spec.providers,
    codeSamples: getApiSnippets({ id: spec.id, identifier }, spec.policy),
    sampleResponse: JSON.stringify(
      {
        id: "req_000003",
        market: identifier,
        requestedAt: "2026-11-09T06:30:00.000Z",
        status: "ok",
        servedBy: spec.providers[0].id,
        latencyMs: 212,
        dataAgeMs: 1_140_000,
        costUsd: spec.providers[0].defaults.bidPrice / 1e6,
        data: { pair: spec.pair, priceUsd: spec.sample, changeUsd: 0, sourceTimestamp: "2026-11-09T06:11:00.000Z" },
      },
      null,
      2,
    ),
  };
}

const policy = (maxPrice: number, maxP95LatencyMs: number, maxDataAgeMin: number, minSuccessRate: number): RoutingPolicy => ({
  maxPrice, maxP95LatencyMs, maxDataAgeMs: maxDataAgeMin * MIN, minSuccessRate, preference: "lowest-cost", mode: { kind: "auto" },
});

export const SZ_MLCC = build({
  id: "sz-mlcc",
  name: "Shenzhen MLCC Spot Price",
  shortName: "SZ MLCC",
  pair: "MLCC-0402-100NF",
  icon: "cpu",
  description:
    "Huaqiangbei spot price for 0402 100nF MLCC reels through one normalized contract. Component brokers bid to serve each quote; Tender routes to the best one that meets your policy.",
  priceDefinition: "Indicative Huaqiangbei spot quote in USD per 10k reel (0402 100nF X7R 16V), from a sample index. Not a live exchange feed.",
  unit: "USD/reel",
  policy: policy(60, 800, 60, 0.99),
  providers: [
    arcaLabs(21, 240, 6, 0.001),
    provider("huaqiang-desk", "Huaqiang Desk", 32, 420, 20, 0.004, 0.2),
    provider("futian-parts", "Futian Parts Index", 45, 260, 8, 0.002, -0.3),
    provider("pearl-river", "Pearl River Components", 24, 950, 35, 0.006, 0.5),
    provider("seg-broker", "SEG Broker Net", 58, 180, 4, 0.001, -0.1),
    provider("bom-scout", "BOM Scout", 18, 640, 95, 0.012, 0.8),
  ],
  sample: 3.42,
});

export const LITHIUM_CARBONATE = build({
  id: "lithium-carbonate",
  name: "Lithium Carbonate Spot",
  shortName: "Li₂CO₃",
  pair: "LI2CO3-CN",
  icon: "pickaxe",
  description:
    "Battery-grade lithium carbonate spot price through one normalized contract. Commodity data desks bid to serve each quote; Tender routes to the best one that meets your policy.",
  priceDefinition: "Indicative battery-grade Li₂CO₃ 99.5% price in USD per tonne, from a sample index. Not a live exchange feed.",
  unit: "USD/t",
  policy: policy(80, 600, 30, 0.995),
  providers: [
    provider("salar-index", "Salar Index", 42, 310, 12, 0.002, 0.3),
    arcaLabs(48, 150, 4, 0.001),
    provider("cathode-wire", "Cathode Wire", 66, 140, 3, 0.001, -0.2),
    provider("yichun-desk", "Yichun Desk", 28, 520, 25, 0.004, 0.6),
    provider("metal-ledger", "Metal Ledger", 90, 95, 1, 0.0005, -0.1),
  ],
  sample: 10_486.2,
});

export const FREIGHT_SHA_LAX = build({
  id: "freight-sha-lax",
  name: "Container Freight Shanghai → LA",
  shortName: "SHA → LAX",
  pair: "SHA-LAX-40FT",
  icon: "ship",
  description:
    "Spot container rate for a 40ft box from Shanghai to Los Angeles through one normalized contract. Freight data providers bid to serve each quote; Tender routes to the best one that meets your policy.",
  priceDefinition: "Indicative spot rate in USD per 40ft container (FEU), from a sample index. Not a live freight feed.",
  unit: "USD/FEU",
  policy: policy(50, 900, 120, 0.99),
  providers: [
    provider("harbor-quote", "Harbor Quote", 22, 480, 45, 0.003, 0.4),
    provider("lane-signal", "Lane Signal", 35, 220, 15, 0.002, -0.3),
    provider("box-index", "Box Index", 14, 1100, 180, 0.008, 0.7),
    provider("pacific-lanes", "Pacific Lanes", 48, 160, 6, 0.001, -0.1),
  ],
  sample: 2_318.4,
});
