import { listingSummary, marketIdentifier } from "@/components/market/market-registry";
import { marketIconName } from "@/components/market/page/market-icon";
import { marketHref } from "@/components/market/page/routes";
import {
  CATEGORIES,
  contractCall,
  getCategory,
  getGroup,
  GROUPS,
  MARKET_SPECS,
  type MarketImage,
  type MarketSpec,
} from "@/lib/registry";
import type { MarketView } from "@/lib/tender";

/**
 * One market in the directory. Bids and routes come from the engine's market view; P95, data age, and
 * success are the active provider's latest monitor sample (the monitor measures watched markets every 5 s).
 */
export interface DirectoryRow {
  id: string;
  href: string;
  /** Recommended order: featured markets first, then registry order (group, category, market). */
  order: number;
  name: string;
  shortName: string;
  identifier: string;
  description: string;
  groupId: string;
  groupLabel: string;
  categoryId: string;
  categoryLabel: string;
  icon: string;
  image?: MarketImage;
  /** Lowercase text the search matches: names, identifier, contract, group, category, providers. */
  searchText: string;
  providerCount: number;
  qualifiedCount: number;
  /** Cheapest qualified bid (USD per 1M requests). */
  bestPrice: number | null;
  /** Fastest qualified P95 (ms). */
  bestP95: number | null;
  /** Freshest qualified data age (ms), what the Freshness filter reads. */
  freshestDataAgeMs: number | null;
  activeProviderId: string | null;
  activeProviderName: string | null;
  activeProviderLogo: string | undefined;
  /** Bid of the provider that serves requests now (USD per 1M requests). */
  bid: number | null;
  /** Measured P95 of the active provider (ms). */
  p95: number | null;
  /** Measured data age of the active provider (ms). */
  dataAge: number | null;
  /** Measured success rate of the active provider (0..1). */
  success: number | null;
  /** The active provider's last three success samples, oldest first. */
  successSamples: number[];
  /** The market policy's minimum success rate (green bars at or above it). */
  successThreshold: number;
  /** The active provider's P95 samples, oldest first (≤ 30). */
  trend: number[];
  /** Time of the newest sample. */
  sampledAt: number | null;
  mode: "auto" | "pinned";
  logos: { name: string; logo?: string }[];
}

const SPECS_IN_ORDER: readonly MarketSpec[] = MARKET_SPECS.map((spec, index) => ({ spec, index }))
  .sort((a, b) => Number(b.spec.featured === true) - Number(a.spec.featured === true) || a.index - b.index)
  .map(({ spec }) => spec);

/** Registry-only row: stats from the standing listings. */
function registryRow(spec: MarketSpec, order: number): DirectoryRow {
  const category = getCategory(spec.categoryId);
  const group = category ? getGroup(category.groupId) : undefined;
  const summary = listingSummary(spec);
  const identifier = marketIdentifier(spec);
  const logos = summary.providers.map((provider) => ({ name: provider.name, logo: provider.logo || undefined }));
  return {
    id: spec.id,
    href: marketHref(spec.id),
    order,
    name: spec.name,
    shortName: spec.shortName,
    identifier,
    description: spec.description,
    groupId: group?.id ?? "",
    groupLabel: group?.label ?? "",
    categoryId: spec.categoryId,
    categoryLabel: category?.label ?? spec.categoryId,
    icon: marketIconName(spec.id),
    image: spec.image,
    searchText: [spec.name, spec.shortName, identifier, contractCall(spec), group?.label, category?.label, ...logos.map((l) => l.name)]
      .join(" ")
      .toLowerCase(),
    providerCount: summary.providerCount,
    qualifiedCount: spec.listings.filter((listing) => listing.available).length,
    bestPrice: summary.cheapestBid,
    bestP95: summary.bestP95Ms,
    freshestDataAgeMs: summary.freshestDataAgeMs,
    activeProviderId: summary.cheapestProvider?.id ?? null,
    activeProviderName: summary.cheapestProvider?.name ?? null,
    activeProviderLogo: summary.cheapestProvider?.logo || undefined,
    bid: summary.cheapestBid,
    p95: summary.bestP95Ms,
    dataAge: summary.freshestDataAgeMs,
    success: summary.cheapestSuccessRate,
    successSamples: [],
    successThreshold: 0.995,
    trend: [],
    sampledAt: null,
    mode: "auto",
    logos: logos.slice(0, 5),
  };
}

export const REGISTRY_ROWS: readonly DirectoryRow[] = SPECS_IN_ORDER.map(registryRow);

/** Row stats from the engine's market view (routing, qualification, monitor samples). */
export function liveRow(base: DirectoryRow, view: MarketView): DirectoryRow {
  const qualified = view.providers.filter((provider) => provider.evaluation.qualifies);
  const active = view.route.activeProvider;
  const history = active?.history ?? [];
  const last = history[history.length - 1];
  return {
    ...base,
    providerCount: view.providers.length,
    qualifiedCount: view.qualifiedCount,
    bestPrice: view.bestPrice?.conditions.bidPrice ?? null,
    bestP95: qualified.length ? Math.min(...qualified.map((provider) => provider.conditions.p95LatencyMs)) : null,
    freshestDataAgeMs: qualified.length ? Math.min(...qualified.map((provider) => provider.conditions.dataAgeMs)) : null,
    activeProviderId: active?.id ?? null,
    activeProviderName: active?.name ?? null,
    activeProviderLogo: active?.logo || undefined,
    bid: active?.conditions.bidPrice ?? null,
    p95: last ? last.p95LatencyMs : (active?.conditions.p95LatencyMs ?? null),
    dataAge: last ? last.dataAgeMs : (active?.conditions.dataAgeMs ?? null),
    success: last ? last.successRate : (active?.successRate ?? null),
    successSamples: history.slice(-3).map((sample) => sample.successRate),
    successThreshold: view.policy.minSuccessRate,
    trend: history.map((sample) => sample.p95LatencyMs),
    sampledAt: last?.at ?? null,
    mode: view.policy.mode.kind,
    logos: view.providers.slice(0, 5).map((provider) => ({ name: provider.identity.name, logo: provider.identity.logo || undefined })),
  };
}

export const CATEGORY_COUNTS: ReadonlyMap<string, number> = MARKET_SPECS.reduce(
  (counts, spec) => counts.set(spec.categoryId, (counts.get(spec.categoryId) ?? 0) + 1),
  new Map<string, number>(),
);
export const GROUP_COUNTS: ReadonlyMap<string, number> = CATEGORIES.reduce(
  (counts, category) => counts.set(category.groupId, (counts.get(category.groupId) ?? 0) + (CATEGORY_COUNTS.get(category.id) ?? 0)),
  new Map<string, number>(),
);

// ---------------------------------------------------------------------------------------------
// The directory query: one state, mirrored in the URL. The list view filters with these
// predicates; the table hands the same state to AG Grid (quick filter, external filter, column
// filter model, column sort), which uses the same predicates for the external filter.
// ---------------------------------------------------------------------------------------------

export type SortColumn = "market" | "category" | "active" | "bid" | "p95" | "dataAge" | "success" | "providers";
export type SortDirection = "asc" | "desc";
export interface DirectorySort {
  column: SortColumn;
  direction: SortDirection;
}

/** Column filter limits, in engine units (USD per 1M requests, ms, 0..1). */
export interface DirectoryLimits {
  maxBid?: number;
  maxP95?: number;
  minSuccess?: number;
}

export interface DirectoryQuery {
  q: string;
  group: string | null;
  categories: readonly string[];
  /** Freshest qualified data age at most this (ms). */
  maxFreshnessMs: number | null;
  minProviders: number | null;
  limits: DirectoryLimits;
  /** `null`: Recommended order. */
  sort: DirectorySort | null;
  view: "list" | "table" | null;
}

export const EMPTY_QUERY: DirectoryQuery = {
  q: "",
  group: null,
  categories: [],
  maxFreshnessMs: null,
  minProviders: null,
  limits: {},
  sort: null,
  view: null,
};

export const FRESHNESS_BUCKETS = [
  { id: "1s", label: "\u2264 1 s", maxMs: 1_000 },
  { id: "1m", label: "\u2264 1 min", maxMs: 60_000 },
  { id: "15m", label: "\u2264 15 min", maxMs: 900_000 },
] as const;

export const PROVIDER_MINIMUMS = [4, 8] as const;

const SORT_COLUMNS = new Set<SortColumn>(["market", "category", "active", "bid", "p95", "dataAge", "success", "providers"]);
const GROUP_IDS = new Set(GROUPS.map((group) => group.id));
const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));

interface ParamsLike {
  get(key: string): string | null;
  getAll(key: string): string[];
}

const positive = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
};

/**
 * `?q=weather&group=ai-models&category=translation&freshness=1m&providers=4&max_bid=20&max_p95=400&min_success=99.5&sort=-success&view=table`
 * (comma lists are accepted for `category`; `min_success` is a percentage).
 */
export function parseQuery(params: ParamsLike): DirectoryQuery {
  const group = params.get("group");
  const categories = params
    .getAll("category")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value, index, all) => CATEGORY_IDS.has(value) && all.indexOf(value) === index);
  const freshness = FRESHNESS_BUCKETS.find((bucket) => bucket.id === params.get("freshness"));
  const providers = Number(params.get("providers"));
  const sortParam = params.get("sort") ?? "";
  const sortColumn = sortParam.replace(/^-/, "") as SortColumn;
  const minSuccess = positive(params.get("min_success"));
  const view = params.get("view");
  return {
    q: params.get("q") ?? "",
    group: group && GROUP_IDS.has(group) ? group : null,
    categories,
    maxFreshnessMs: freshness?.maxMs ?? null,
    minProviders: (PROVIDER_MINIMUMS as readonly number[]).includes(providers) ? providers : null,
    limits: {
      maxBid: positive(params.get("max_bid")),
      maxP95: positive(params.get("max_p95")),
      minSuccess: minSuccess === undefined ? undefined : Math.min(1, minSuccess / 100),
    },
    sort: SORT_COLUMNS.has(sortColumn) ? { column: sortColumn, direction: sortParam.startsWith("-") ? "desc" : "asc" } : null,
    view: view === "table" || view === "list" ? view : null,
  };
}

const percent = (ratio: number) => String(Math.round(ratio * 100_000) / 1_000);

export function queryString(query: DirectoryQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.group) params.set("group", query.group);
  for (const category of query.categories) params.append("category", category);
  const freshness = FRESHNESS_BUCKETS.find((bucket) => bucket.maxMs === query.maxFreshnessMs);
  if (freshness) params.set("freshness", freshness.id);
  if (query.minProviders !== null) params.set("providers", String(query.minProviders));
  if (query.limits.maxBid !== undefined) params.set("max_bid", String(query.limits.maxBid));
  if (query.limits.maxP95 !== undefined) params.set("max_p95", String(query.limits.maxP95));
  if (query.limits.minSuccess !== undefined) params.set("min_success", percent(query.limits.minSuccess));
  if (query.sort) params.set("sort", `${query.sort.direction === "desc" ? "-" : ""}${query.sort.column}`);
  if (query.view) params.set("view", query.view);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const sameQuery = (a: DirectoryQuery, b: DirectoryQuery) => queryString(a) === queryString(b);

/** Quick filter semantics (AG Grid's): every word of the query appears in the row's search text. */
export function matchesText(row: DirectoryRow, q: string): boolean {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((word) => row.searchText.includes(word));
}

/** The sidebar and group tabs (the grid's external filter). */
export function passesSidebar(row: DirectoryRow, query: DirectoryQuery): boolean {
  return (
    (query.group === null || row.groupId === query.group) &&
    (query.categories.length === 0 || query.categories.includes(row.categoryId)) &&
    (query.minProviders === null || row.providerCount >= query.minProviders) &&
    (query.maxFreshnessMs === null || (row.freshestDataAgeMs ?? Infinity) <= query.maxFreshnessMs)
  );
}

export const sidebarActive = (query: DirectoryQuery) =>
  query.group !== null || query.categories.length > 0 || query.minProviders !== null || query.maxFreshnessMs !== null;

/** The column filters (the grid's Number Filters). */
export function passesLimits(row: DirectoryRow, { maxBid, maxP95, minSuccess }: DirectoryLimits): boolean {
  return (
    (maxBid === undefined || (row.bid !== null && row.bid <= maxBid)) &&
    (maxP95 === undefined || (row.p95 !== null && row.p95 <= maxP95)) &&
    (minSuccess === undefined || (row.success !== null && row.success >= minSuccess))
  );
}

export const limitsActive = (limits: DirectoryLimits) => Object.values(limits).some((value) => value !== undefined);

export function filterRows(rows: readonly DirectoryRow[], query: DirectoryQuery): DirectoryRow[] {
  return rows.filter((row) => matchesText(row, query.q) && passesSidebar(row, query) && passesLimits(row, query.limits));
}

const TEXT_VALUE: Partial<Record<SortColumn, (row: DirectoryRow) => string | null>> = {
  market: (row) => row.name,
  category: (row) => row.categoryLabel,
  active: (row) => row.activeProviderName,
};

/** Value a column sorts on. */
export function sortValue(row: DirectoryRow, column: SortColumn): number | string | null {
  const text = TEXT_VALUE[column];
  if (text) return text(row);
  switch (column) {
    case "bid":
      return row.bid;
    case "p95":
      return row.p95;
    case "dataAge":
      return row.dataAge;
    case "success":
      return row.success;
    default:
      return row.providerCount;
  }
}

/** Ascending compare with empty values last; ties keep the Recommended order. */
export function compareRows(a: DirectoryRow, b: DirectoryRow, column: SortColumn, descending: boolean): number {
  const va = sortValue(a, column);
  const vb = sortValue(b, column);
  if (va === null || vb === null) {
    if (va === vb) return a.order - b.order;
    // The grid reverses the comparator for descending sorts; keep empty values last either way.
    return (va === null ? 1 : -1) * (descending ? -1 : 1);
  }
  const diff = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb) : (va as number) - (vb as number);
  // Ties keep the Recommended order in both directions.
  return diff || (a.order - b.order) * (descending ? -1 : 1);
}

export function sortRows(rows: DirectoryRow[], sort: DirectorySort | null): DirectoryRow[] {
  if (!sort) return rows.sort((a, b) => a.order - b.order);
  const sign = sort.direction === "desc" ? -1 : 1;
  return rows.sort((a, b) => sign * compareRows(a, b, sort.column, sort.direction === "desc"));
}

/** The sort menu: the common orders, plus whatever a header click chose. */
export const SORT_PRESETS: readonly { value: string; label: string; sort: DirectorySort | null }[] = [
  { value: "recommended", label: "Recommended", sort: null },
  { value: "bid", label: "Lowest price", sort: { column: "bid", direction: "asc" } },
  { value: "p95", label: "Lowest latency", sort: { column: "p95", direction: "asc" } },
  { value: "dataAge", label: "Freshest data", sort: { column: "dataAge", direction: "asc" } },
  { value: "-success", label: "Most reliable", sort: { column: "success", direction: "desc" } },
  { value: "-providers", label: "Most providers", sort: { column: "providers", direction: "desc" } },
];

const COLUMN_LABELS: Record<SortColumn, string> = {
  market: "Market",
  category: "Category",
  active: "Active provider",
  bid: "Winning bid",
  p95: "P95",
  dataAge: "Data age",
  success: "Success",
  providers: "Providers",
};

export const sortKey = (sort: DirectorySort | null) => (sort ? `${sort.direction === "desc" ? "-" : ""}${sort.column}` : "recommended");

export function sortLabel(sort: DirectorySort): string {
  const text = sort.column === "market" || sort.column === "category" || sort.column === "active";
  const order = text ? (sort.direction === "asc" ? "A to Z" : "Z to A") : sort.direction === "asc" ? "low to high" : "high to low";
  return `${COLUMN_LABELS[sort.column]}, ${order}`;
}
