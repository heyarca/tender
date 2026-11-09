import {
  getContract,
  getProvider,
  type ContractSpec,
  type FieldSpec,
  type MarketSpec,
  type ProviderSpec,
} from "@/lib/registry";

/**
 * View helpers over the registry (`@/lib/registry`): identifiers, primary and series fields,
 * and listing summaries for markets the engine does not serve yet.
 */

/** Public market slug under the title: contract namespace and market id (`prices/btc-usd`). */
export function marketIdentifier(spec: Pick<MarketSpec, "id" | "contractId">): string {
  return `${spec.contractId.split(".")[0]}/${spec.id}`;
}

/** The contract's headline field. */
export function primaryField(contract: ContractSpec): FieldSpec | undefined {
  return contract.output.find((field) => field.primary) ?? contract.output[0];
}

/** The contract's plotted field, when it has one. */
export function seriesField(contract: ContractSpec): FieldSpec | undefined {
  return contract.output.find((field) => field.series);
}

/** Whether a market has a chart (its contract has a series field). */
export function hasSeries(spec: Pick<MarketSpec, "contractId">): boolean {
  const contract = getContract(spec.contractId);
  return Boolean(contract && seriesField(contract));
}

export interface ListingSummary {
  providerCount: number;
  /** Lowest standing bid (USD per 1M requests). */
  cheapestBid: number | null;
  cheapestProvider: ProviderSpec | null;
  bestP95Ms: number | null;
  freshestDataAgeMs: number | null;
  /** Success rate (1 − error rate) of the cheapest available listing. */
  cheapestSuccessRate: number | null;
  providers: ProviderSpec[];
}

/** Standing offers of a market, summarized for the directory. */
export function listingSummary(spec: MarketSpec): ListingSummary {
  const providers = spec.listings
    .map((listing) => getProvider(listing.providerId))
    .filter((provider): provider is ProviderSpec => Boolean(provider));
  const available = spec.listings.filter((listing) => listing.available);
  const cheapest = [...available].sort((a, b) => a.bidPrice - b.bidPrice)[0] ?? null;
  return {
    providerCount: spec.listings.length,
    cheapestBid: cheapest?.bidPrice ?? null,
    cheapestProvider: cheapest ? (getProvider(cheapest.providerId) ?? null) : null,
    bestP95Ms: available.length ? Math.min(...available.map((listing) => listing.p95LatencyMs)) : null,
    freshestDataAgeMs: available.length ? Math.min(...available.map((listing) => listing.dataAgeMs)) : null,
    cheapestSuccessRate: cheapest ? 1 - cheapest.errorRate : null,
    providers,
  };
}

const zoneLabels = new Map<string, string>();

/** Short time zone label from Intl ("PST", "GMT+9"), for markets without an engine definition. */
export function shortZoneLabel(timeZone: string): string {
  let label = zoneLabels.get(timeZone);
  if (!label) {
    try {
      label =
        new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
          .formatToParts(0)
          .find((part) => part.type === "timeZoneName")?.value ?? timeZone;
    } catch {
      label = timeZone;
    }
    zoneLabels.set(timeZone, label);
  }
  return label;
}
