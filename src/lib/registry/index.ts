import { CONTRACTS } from "./contracts";
import { MARKET_SPECS } from "./markets";
import { PROVIDERS } from "./providers";
import { CATEGORIES, GROUPS } from "./taxonomy";
import type { Breadcrumb, CategorySpec, ContractSpec, GroupSpec, MarketSpec, ProviderSpec } from "./types";

export type * from "./types";
export { CATEGORIES, CONTRACTS, GROUPS, MARKET_SPECS, PROVIDERS };

const byId = <T extends { id: string }>(list: readonly T[]) => new Map(list.map((item) => [item.id, item]));
const GROUP_BY_ID = byId(GROUPS);
const CATEGORY_BY_ID = byId(CATEGORIES);
const CONTRACT_BY_ID = byId(CONTRACTS);
const MARKET_BY_ID = byId(MARKET_SPECS);
const PROVIDER_BY_ID = byId(PROVIDERS);

export const getGroup = (id: string): GroupSpec | undefined => GROUP_BY_ID.get(id);
export const getCategory = (id: string): CategorySpec | undefined => CATEGORY_BY_ID.get(id);
export const getContract = (id: string): ContractSpec | undefined => CONTRACT_BY_ID.get(id);
export const getMarketSpec = (id: string): MarketSpec | undefined => MARKET_BY_ID.get(id);
export const getProvider = (id: string): ProviderSpec | undefined => PROVIDER_BY_ID.get(id);
export const isRegisteredMarket = (id: unknown): id is string => typeof id === "string" && MARKET_BY_ID.has(id);

/** Categories of a group, in display order. */
export const categoriesOf = (groupId: string): CategorySpec[] => CATEGORIES.filter((category) => category.groupId === groupId);

/** Markets filtered by group and/or category, in directory order. */
export function listMarkets(filter: { groupId?: string; categoryId?: string } = {}): MarketSpec[] {
  return MARKET_SPECS.filter((market) => {
    if (filter.categoryId && market.categoryId !== filter.categoryId) return false;
    if (filter.groupId && getCategory(market.categoryId)?.groupId !== filter.groupId) return false;
    return true;
  });
}

/** Group › Category › Market for navigation. */
export function breadcrumbFor(marketId: string): Breadcrumb | undefined {
  const market = getMarketSpec(marketId);
  const category = market && getCategory(market.categoryId);
  const group = category && getGroup(category.groupId);
  return market && category && group ? { group, category, market } : undefined;
}

/** "/api/v1/translation/text" for "translation.text". */
export const contractPath = (contractId: string): string => `/api/v1/${contractId.replace(".", "/")}`;

/** Contract call signature shown in the UI: `translation.text({ source: "en", target: "ko" })`. */
export function contractCall(market: MarketSpec): string {
  const args = Object.entries(market.params).map(([key, value]) => `${key}: "${value}"`);
  return `${market.contractId}(${args.length ? `{ ${args.join(", ")} }` : ""})`;
}

/** Contract URL with the market's params bound, e.g. "/api/v1/translation/text?source=en&target=ko". */
export function contractUrl(market: MarketSpec): string {
  const query = new URLSearchParams(market.params).toString();
  return `${contractPath(market.contractId)}${query ? `?${query}` : ""}`;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function deepMerge(base: Readonly<Record<string, unknown>>, patch: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return out;
}

/** The market's schema-shaped sample result: contract template with the market's overrides. */
export function sampleFor(market: MarketSpec): Record<string, unknown> {
  const contract = getContract(market.contractId);
  return deepMerge(contract?.sample ?? {}, market.sample ?? {});
}

/** Read a dotted path ("departure.airport") from a result payload. */
export function readField(result: Readonly<Record<string, unknown>>, key: string): unknown {
  return key.split(".").reduce<unknown>((value, part) => (isPlainObject(value) ? value[part] : undefined), result);
}

/** Problems in the registry (empty when consistent). */
export function validateRegistry(): string[] {
  const errors: string[] = [];
  const unique = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`duplicate ${label} id ${id}`);
      seen.add(id);
    }
  };
  unique("group", GROUPS.map((g) => g.id));
  unique("category", CATEGORIES.map((c) => c.id));
  unique("contract", CONTRACTS.map((c) => c.id));
  unique("market", MARKET_SPECS.map((m) => m.id));
  unique("provider", PROVIDERS.map((p) => p.id));
  for (const category of CATEGORIES) if (!getGroup(category.groupId)) errors.push(`category ${category.id}: unknown group ${category.groupId}`);
  for (const contract of CONTRACTS) {
    if (contract.output.filter((field) => field.primary).length !== 1) errors.push(`contract ${contract.id}: needs exactly one primary field`);
    for (const field of contract.output) {
      if (!field.optional && readField(contract.sample, field.key) === undefined) errors.push(`contract ${contract.id}: sample misses ${field.key}`);
    }
  }
  for (const market of MARKET_SPECS) {
    const contract = getContract(market.contractId);
    if (!getCategory(market.categoryId)) errors.push(`market ${market.id}: unknown category ${market.categoryId}`);
    if (!contract) {
      errors.push(`market ${market.id}: unknown contract ${market.contractId}`);
      continue;
    }
    const expected = contract.params.map((param) => param.key).sort().join(",");
    const actual = Object.keys(market.params).sort().join(",");
    if (expected !== actual) errors.push(`market ${market.id}: params ${actual} do not match ${contract.id} (${expected})`);
    if (market.listings.length === 0) errors.push(`market ${market.id}: no listings`);
    for (const listing of market.listings) if (!getProvider(listing.providerId)) errors.push(`market ${market.id}: unknown provider ${listing.providerId}`);
    const sample = sampleFor(market);
    for (const field of contract.output) {
      if (!field.optional && readField(sample, field.key) === undefined) errors.push(`market ${market.id}: sample misses ${field.key}`);
    }
  }
  return errors;
}
