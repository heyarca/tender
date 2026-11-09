import { getApiSnippets } from "../snippets";
import type { MarketDefinition, MarketIcon, ProviderFixture, QuoteMarketId, RoutingPolicy } from "../types";
import { QUOTE_CONTRACTS } from "./quote-contracts";

export { isQuoteMarketId, QUOTE_CONTRACTS, QUOTE_MARKET_IDS } from "./quote-contracts";

const MIN = 60_000;

interface QuoteSpec {
  id: QuoteMarketId;
  name: string;
  shortName: string;
  identifier: string;
  description: string;
  priceDefinition: string;
  icon: MarketIcon;
  timeZone: MarketDefinition["timeZone"];
  timeZoneLabel: string;
  policy: RoutingPolicy;
  providers: ProviderFixture[];
  sample: { servedBy: string; value: number; changeValue: number };
}

// Provider names are fictional; there are no logos, so the UI shows their initial.
const provider = (id: string, name: string, bidPrice: number, p95LatencyMs: number, dataAgeMin: number, errorRate: number, bias: number): ProviderFixture => ({
  id,
  name,
  logo: "",
  defaults: { bidPrice, p95LatencyMs, dataAgeMs: dataAgeMin * MIN, errorRate, available: true },
  bias,
});

const SPECS: QuoteSpec[] = [
  {
    id: "sz-mlcc",
    name: "Shenzhen MLCC Spot Price",
    shortName: "SZ MLCC",
    identifier: "components/sz-mlcc-0402",
    description:
      "Huaqiangbei spot price for 0402 100nF MLCC reels through one normalized contract. Component brokers bid to serve each quote; Tender routes to the best one that meets your policy.",
    priceDefinition: "Indicative Huaqiangbei spot quote in USD per 10k reel, from a sample index. Not a live exchange feed.",
    icon: "cpu",
    timeZone: "UTC",
    timeZoneLabel: "UTC",
    policy: { maxPrice: 60, maxP95LatencyMs: 800, maxDataAgeMs: 60 * MIN, minSuccessRate: 0.99, preference: "lowest-cost", mode: { kind: "auto" } },
    providers: [
      provider("huaqiang-desk", "Huaqiang Desk", 32, 420, 20, 0.004, 0.2),
      provider("futian-parts", "Futian Parts Index", 45, 260, 8, 0.002, -0.3),
      provider("pearl-river", "Pearl River Components", 24, 950, 35, 0.006, 0.5),
      provider("seg-broker", "SEG Broker Net", 58, 180, 4, 0.001, -0.1),
      provider("bom-scout", "BOM Scout", 18, 640, 95, 0.012, 0.8),
    ],
    sample: { servedBy: "huaqiang-desk", value: 3.42, changeValue: -0.01 },
  },
  {
    id: "lithium-carbonate",
    name: "Lithium Carbonate Spot",
    shortName: "Li₂CO₃",
    identifier: "commodities/lithium-carbonate",
    description:
      "Battery-grade lithium carbonate spot price through one normalized contract. Commodity data desks bid to serve each quote; Tender routes to the best one that meets your policy.",
    priceDefinition: "Indicative battery-grade Li₂CO₃ 99.5% price in USD per tonne, from a sample index. Not a live exchange feed.",
    icon: "pickaxe",
    timeZone: "UTC",
    timeZoneLabel: "UTC",
    policy: { maxPrice: 80, maxP95LatencyMs: 600, maxDataAgeMs: 30 * MIN, minSuccessRate: 0.995, preference: "lowest-cost", mode: { kind: "auto" } },
    providers: [
      provider("salar-index", "Salar Index", 42, 310, 12, 0.002, 0.3),
      provider("cathode-wire", "Cathode Wire", 66, 140, 3, 0.001, -0.2),
      provider("yichun-desk", "Yichun Desk", 28, 520, 25, 0.004, 0.6),
      provider("metal-ledger", "Metal Ledger", 90, 95, 1, 0.0005, -0.1),
    ],
    sample: { servedBy: "salar-index", value: 10_486.2, changeValue: 6.2 },
  },
  {
    id: "freight-sha-lax",
    name: "Container Freight Shanghai → LA",
    shortName: "SHA → LAX",
    identifier: "freight/sha-lax-40ft",
    description:
      "Spot container rate for a 40ft box from Shanghai to Los Angeles through one normalized contract. Freight data providers bid to serve each quote; Tender routes to the best one that meets your policy.",
    priceDefinition: "Indicative spot rate in USD per 40ft container (FEU), from a sample index. Not a live freight feed.",
    icon: "ship",
    timeZone: "UTC",
    timeZoneLabel: "UTC",
    policy: { maxPrice: 50, maxP95LatencyMs: 900, maxDataAgeMs: 120 * MIN, minSuccessRate: 0.99, preference: "lowest-cost", mode: { kind: "auto" } },
    providers: [
      provider("harbor-quote", "Harbor Quote", 22, 480, 45, 0.003, 0.4),
      provider("lane-signal", "Lane Signal", 35, 220, 15, 0.002, -0.3),
      provider("box-index", "Box Index", 14, 1100, 180, 0.008, 0.7),
      provider("pacific-lanes", "Pacific Lanes", 48, 160, 6, 0.001, -0.1),
    ],
    sample: { servedBy: "harbor-quote", value: 2_318.4, changeValue: 3.4 },
  },
];

const input = (label: string, unit: string, min: number, max: number, step: number, decimals: number, factor: number, hint: string, prefix?: string) => ({
  label, unit, min, max, step, decimals, factor, hint, ...(prefix ? { prefix } : {}),
});

function build(spec: QuoteSpec): MarketDefinition {
  const contract = QUOTE_CONTRACTS[spec.id];
  return {
    id: spec.id,
    name: spec.name,
    shortName: spec.shortName,
    identifier: spec.identifier,
    contract: `${contract.namespace}({ ${contract.key}: "${contract.value}" })`,
    description: spec.description,
    timeZone: spec.timeZone,
    timeZoneLabel: spec.timeZoneLabel,
    icon: spec.icon,
    units: { price: "/M req", dataAge: "min", value: contract.unit },
    priceDefinition: spec.priceDefinition,
    resultFields: [
      { key: "symbol", label: "Instrument" },
      { key: "value", label: "Price", unit: contract.unit },
      { key: "changeValue", label: "Change vs previous request", unit: "USD" },
      { key: "sourceTimestamp", label: "Source timestamp" },
    ],
    defaultPolicy: spec.policy,
    policyInputs: {
      maxPrice: input("Max price", "/M req", 0, 200, 0.5, 2, 1, "Highest bid you accept, in USD per 1M requests.", "$"),
      maxP95LatencyMs: input("Max P95 latency", "ms", 50, 3000, 10, 0, 1, "95% of requests must finish within this time."),
      maxDataAgeMs: input("Max data age", "min", 1, 720, 1, 0, MIN, "Oldest quote you accept at response time."),
      minSuccessRate: input("Min success rate", "%", 90, 100, 0.01, 2, 0.01, "Share of requests that must succeed."),
    },
    conditionInputs: {
      bidPrice: input("Bid", "/M req", 0.5, 400, 0.5, 2, 1, "What the provider charges, in USD per 1M requests.", "$"),
      p95LatencyMs: input("P95 latency", "ms", 10, 5000, 10, 0, 1, "95th percentile request latency."),
      dataAgeMs: input("Data age", "min", 0, 1440, 1, 0, MIN, "Age of the quote the provider returns."),
      errorRate: input("Error rate", "%", 0, 20, 0.01, 2, 0.01, "Share of requests that fail."),
    },
    providers: spec.providers,
    codeSamples: getApiSnippets({ id: spec.id, identifier: spec.identifier }, spec.policy),
    sampleResponse: JSON.stringify(
      {
        id: "req_000003",
        market: spec.identifier,
        requestedAt: "2026-11-09T06:30:00.000Z",
        status: "ok",
        servedBy: spec.sample.servedBy,
        latencyMs: 212,
        dataAgeMs: 1_140_000,
        costUsd: spec.providers[0].defaults.bidPrice / 1e6,
        data: {
          symbol: contract.symbol,
          value: spec.sample.value,
          unit: contract.unit,
          changeValue: spec.sample.changeValue,
          sourceTimestamp: "2026-11-09T06:11:00.000Z",
        },
      },
      null,
      2,
    ),
  };
}

export const SZ_MLCC = build(SPECS[0]);
export const LITHIUM_CARBONATE = build(SPECS[1]);
export const FREIGHT_SHA_LAX = build(SPECS[2]);

