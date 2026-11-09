"use client";

import { LayoutGrid, Search, Table2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { Select, type SelectOption } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import { TopNav } from "@/components/shell/top-nav";
import { PageContainer } from "@/components/shell/page-container";
import { cn } from "@/lib/utils";
import { listingSummary, marketIdentifier } from "@/components/market/market-registry";
import { MarketGlyph, marketIconName } from "@/components/market/page/market-icon";
import { marketHref } from "@/components/market/page/routes";
import {
  CATEGORIES,
  categoriesOf,
  contractCall,
  getCategory,
  getGroup,
  GROUPS,
  MARKET_SPECS,
  type MarketImage,
  type MarketSpec,
} from "@/lib/registry";
import { format, isMarketId, selectMarketView, type MarketView } from "@/lib/tender";
import { useTenderSelector } from "@/lib/tender/client";
import { AgentInstallBanner } from "./agent-install-banner";

interface DirectoryRow {
  id: string;
  href: string;
  /** Registry order (group, category, market). */
  order: number;
  featured: boolean;
  name: string;
  shortName: string;
  identifier: string;
  contract: string;
  description: string;
  groupId: string;
  groupLabel: string;
  categoryId: string;
  categoryLabel: string;
  icon: string;
  image?: MarketImage;
  providerCount: number;
  qualifiedCount: number;
  bestPrice: number | null;
  bestP95: number | null;
  freshestDataAgeMs: number | null;
  activeProviderName: string | null;
  activeProviderLogo: string | undefined;
  mode: "auto" | "pinned";
  logos: { name: string; logo?: string }[];
}

/** Registry-only row: stats from the standing listings (cheapest bid, best P95, freshest data). */
function registryRow(spec: MarketSpec, order: number): DirectoryRow {
  const category = getCategory(spec.categoryId);
  const group = category ? getGroup(category.groupId) : undefined;
  const summary = listingSummary(spec);
  return {
    id: spec.id,
    href: marketHref(spec.id),
    order,
    featured: spec.featured === true,
    name: spec.name,
    shortName: spec.shortName,
    identifier: marketIdentifier(spec),
    contract: contractCall(spec),
    description: spec.description,
    groupId: group?.id ?? "",
    groupLabel: group?.label ?? "",
    categoryId: spec.categoryId,
    categoryLabel: category?.label ?? spec.categoryId,
    icon: marketIconName(spec.id),
    image: spec.image,
    providerCount: summary.providerCount,
    qualifiedCount: spec.listings.filter((listing) => listing.available).length,
    bestPrice: summary.cheapestBid,
    bestP95: summary.bestP95Ms,
    freshestDataAgeMs: summary.freshestDataAgeMs,
    activeProviderName: summary.cheapestProvider?.name ?? null,
    activeProviderLogo: summary.cheapestProvider?.logo || undefined,
    mode: "auto",
    logos: summary.providers.slice(0, 5).map((provider) => ({ name: provider.name, logo: provider.logo || undefined })),
  };
}

/** Row stats from the engine's market view (routing, qualification, measured conditions). */
function liveRow(base: DirectoryRow, view: MarketView): DirectoryRow {
  const qualified = view.providers.filter((provider) => provider.evaluation.qualifies);
  const active = view.metrics.activeProviderId ? view.providersById[view.metrics.activeProviderId] : null;
  return {
    ...base,
    providerCount: view.providers.length,
    qualifiedCount: view.qualifiedCount,
    bestPrice: view.bestPrice?.conditions.bidPrice ?? null,
    bestP95: qualified.length ? Math.min(...qualified.map((provider) => provider.conditions.p95LatencyMs)) : null,
    freshestDataAgeMs: qualified.length ? Math.min(...qualified.map((provider) => provider.conditions.dataAgeMs)) : null,
    activeProviderName: view.metrics.activeProviderName,
    activeProviderLogo: active?.identity.logo,
    mode: view.policy.mode.kind,
    logos: view.providers.slice(0, 5).map((provider) => ({ name: provider.identity.name, logo: provider.identity.logo })),
  };
}

const REGISTRY_ROWS: readonly DirectoryRow[] = MARKET_SPECS.map(registryRow);

const CATEGORY_COUNTS: ReadonlyMap<string, number> = MARKET_SPECS.reduce(
  (counts, spec) => counts.set(spec.categoryId, (counts.get(spec.categoryId) ?? 0) + 1),
  new Map<string, number>(),
);
const GROUP_COUNTS: ReadonlyMap<string, number> = CATEGORIES.reduce(
  (counts, category) => counts.set(category.groupId, (counts.get(category.groupId) ?? 0) + (CATEGORY_COUNTS.get(category.id) ?? 0)),
  new Map<string, number>(),
);

/**
 * One store subscription for the whole directory. Markets the engine serves use their live view
 * (cached per market state, and reading it does not start monitoring); the rest use their listings.
 */
function useDirectoryRows(): readonly DirectoryRow[] {
  const markets = useTenderSelector((state) => state.markets);
  return useMemo(
    () =>
      REGISTRY_ROWS.map((row) => {
        const state = isMarketId(row.id) ? markets[row.id] : undefined;
        return state ? liveRow(row, selectMarketView(state)) : row;
      }),
    [markets],
  );
}

type SortKey = "recommended" | "price" | "latency" | "freshness" | "providers";

const SORT_OPTIONS: SelectOption<SortKey>[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price", label: "Lowest price" },
  { value: "latency", label: "Lowest latency" },
  { value: "freshness", label: "Freshest data" },
  { value: "providers", label: "Most providers" },
];
const sorters: Record<SortKey, (a: DirectoryRow, b: DirectoryRow) => number> = {
  recommended: (a, b) => Number(b.featured) - Number(a.featured) || a.order - b.order,
  price: (a, b) => (a.bestPrice ?? Infinity) - (b.bestPrice ?? Infinity) || a.order - b.order,
  latency: (a, b) => (a.bestP95 ?? Infinity) - (b.bestP95 ?? Infinity) || a.order - b.order,
  freshness: (a, b) => (a.freshestDataAgeMs ?? Infinity) - (b.freshestDataAgeMs ?? Infinity) || a.order - b.order,
  providers: (a, b) => b.providerCount - a.providerCount || a.order - b.order,
};

function matchesSearch(row: DirectoryRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.name, row.shortName, row.identifier, row.contract, row.groupLabel, row.categoryLabel, ...row.logos.map((l) => l.name)]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

const FRESHNESS_BUCKETS = [
  { id: "1s", label: "\u2264 1 s", maxMs: 1_000 },
  { id: "1m", label: "\u2264 1 min", maxMs: 60_000 },
  { id: "15m", label: "\u2264 15 min", maxMs: 900_000 },
] as const;

const VIEW_STORAGE_KEY = "tender:v1:directory-view";

interface Filters {
  group: string | null;
  categories: readonly string[];
}

const GROUP_IDS = new Set(GROUPS.map((group) => group.id));
const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));

/** `?group=ai-models&category=translation&category=embeddings` (comma lists also accepted). */
function parseFilters(params: URLSearchParams | { get(key: string): string | null; getAll(key: string): string[] }): Filters {
  const group = params.get("group");
  const categories = params
    .getAll("category")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value, index, all) => CATEGORY_IDS.has(value) && all.indexOf(value) === index);
  return { group: group && GROUP_IDS.has(group) ? group : null, categories };
}

function filtersQuery({ group, categories }: Filters): string {
  const params = new URLSearchParams();
  if (group) params.set("group", group);
  for (const category of categories) params.append("category", category);
  const query = params.toString();
  return query ? `?${query}` : "";
}

const sameFilters = (a: Filters, b: Filters) =>
  a.group === b.group && a.categories.length === b.categories.length && a.categories.every((c, i) => c === b.categories[i]);

/** Reads `?group=` and `?category=` (in its own Suspense boundary so the directory still prerenders). */
function FiltersFromUrl({ onChange }: { onChange: (filters: Filters) => void }) {
  const params = useSearchParams();
  useEffect(() => onChange(parseFilters(params)), [params, onChange]);
  return null;
}

export function MarketDirectory() {
  const rows = useDirectoryRows();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ group: null, categories: [] });
  const [sort, setSort] = useState<SortKey>("recommended");
  const [view, setView] = useState<"list" | "table">("list");
  const [minProviders, setMinProviders] = useState<number | null>(null);
  const [maxFreshnessMs, setMaxFreshnessMs] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_STORAGE_KEY) === "table") setView("table");
    } catch {
      // Storage can be unavailable; the list view stays.
    }
  }, []);

  const setViewPersist = (next: "list" | "table") => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Not persisted.
    }
  };

  const applyUrlFilters = useCallback((next: Filters) => {
    setFilters((current) => (sameFilters(current, next) ? current : next));
  }, []);

  /** Update the filters and mirror them in the URL (history.replaceState syncs with the router). */
  const updateFilters = (next: Filters) => {
    setFilters(next);
    window.history.replaceState(null, "", `${window.location.pathname}${filtersQuery(next)}`);
  };

  const selectGroup = (group: string | null) => {
    const categories = group ? filters.categories.filter((id) => getCategory(id)?.groupId === group) : filters.categories;
    updateFilters({ group, categories });
  };

  const toggleCategory = (categoryId: string, checked: boolean) => {
    const categories = checked
      ? CATEGORIES.map((category) => category.id).filter((id) => id === categoryId || filters.categories.includes(id))
      : filters.categories.filter((id) => id !== categoryId);
    updateFilters({ group: filters.group, categories });
  };

  const filtered = useMemo(
    () =>
      rows
        .filter((row) => matchesSearch(row, query))
        .filter((row) => filters.group === null || row.groupId === filters.group)
        .filter((row) => filters.categories.length === 0 || filters.categories.includes(row.categoryId))
        .filter((row) => minProviders === null || row.providerCount >= minProviders)
        .filter((row) => maxFreshnessMs === null || (row.freshestDataAgeMs ?? Infinity) <= maxFreshnessMs)
        .sort(sorters[sort]),
    [rows, query, filters, minProviders, maxFreshnessMs, sort],
  );

  const clearFilters = () => {
    setQuery("");
    setMinProviders(null);
    setMaxFreshnessMs(null);
    updateFilters({ group: null, categories: [] });
  };
  const filtersActive =
    query !== "" || filters.group !== null || filters.categories.length > 0 || minProviders !== null || maxFreshnessMs !== null;
  const sidebarGroups = filters.group ? GROUPS.filter((group) => group.id === filters.group) : GROUPS;

  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={null}>
        <FiltersFromUrl onChange={applyUrlFilters} />
      </Suspense>
      <TopNav links={[]} onSearch={() => searchRef.current?.focus()} />
      <PageContainer>
        <AgentInstallBanner />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-title font-semibold text-foreground">Markets</h1>
            <p className="mt-1 max-w-2xl text-body text-muted-foreground">
              APIs where providers compete to serve your requests on price, latency, freshness, and
              reliability. New markets open all the time, and AI agents can create more.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search markets, providers, or contracts…"
              className="pl-8"
              aria-label="Search markets"
            />
          </div>
          <Select items={SORT_OPTIONS} value={sort} onValueChange={setSort} aria-label="Sort markets" className="shrink-0" />
          <SegmentedControl
            items={[
              { value: "list", label: "List", icon: <LayoutGrid className="size-3.5" /> },
              { value: "table", label: "Table", icon: <Table2 className="size-3.5" /> },
            ]}
            value={view}
            onValueChange={setViewPersist}
            aria-label="Switch between list and table view"
            className="ml-auto shrink-0"
          />
        </div>

        <div
          role="tablist"
          aria-label="Market groups"
          className="-mx-4 mt-3 flex items-center gap-1 overflow-x-auto border-b border-border px-4 pb-3 lg:mx-0 lg:flex-wrap lg:px-0"
        >
          {[{ id: null, label: "All", count: MARKET_SPECS.length }, ...GROUPS.map((group) => ({ id: group.id, label: group.label, count: GROUP_COUNTS.get(group.id) ?? 0 }))].map(
            (tab) => {
              const selected = filters.group === tab.id;
              return (
                <button
                  key={tab.id ?? "all"}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectGroup(tab.id)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-button font-medium whitespace-nowrap transition-colors",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent-subtle hover:text-accent-foreground",
                  )}
                >
                  {tab.label} <span className="text-caption text-muted-foreground">{tab.count}</span>
                </button>
              );
            },
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="order-2 lg:sticky lg:top-[calc(var(--navbar-height)+24px)] lg:order-1 lg:max-h-[calc(100vh-var(--navbar-height)-48px)] lg:self-start lg:overflow-y-auto">
            <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4 lg:border-0 lg:bg-transparent lg:p-0">
              <div>
                <h2 className="text-caption font-medium text-muted-foreground">Categories</h2>
                <div className="mt-2 flex flex-col gap-3">
                  {sidebarGroups.map((group) => (
                    <div key={group.id}>
                      <h3 className="text-caption font-medium text-foreground">{group.label}</h3>
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {categoriesOf(group.id).map((category) => {
                          const checked = filters.categories.includes(category.id);
                          return (
                            <li key={category.id}>
                              <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                                <Checkbox checked={checked} onCheckedChange={(next) => toggleCategory(category.id, next)} />
                                <MarketGlyph icon={category.icon} tinted={false} className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate">{category.label}</span>
                                <span className="text-caption text-faint tabular-nums">{CATEGORY_COUNTS.get(category.id) ?? 0}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-caption font-medium text-muted-foreground">Freshness</h2>
                <div className="mt-2 flex flex-col gap-1.5">
                  {FRESHNESS_BUCKETS.map((bucket) => (
                    <label key={bucket.id} className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                      <input
                        type="radio"
                        name="freshness"
                        className="accent-[var(--primary-strong)]"
                        checked={maxFreshnessMs === bucket.maxMs}
                        onChange={() => setMaxFreshnessMs(bucket.maxMs)}
                      />
                      {bucket.label}
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                    <input
                      type="radio"
                      name="freshness"
                      className="accent-[var(--primary-strong)]"
                      checked={maxFreshnessMs === null}
                      onChange={() => setMaxFreshnessMs(null)}
                    />
                    Any
                  </label>
                </div>
              </div>
              <div>
                <h2 className="text-caption font-medium text-muted-foreground">Providers</h2>
                <div className="mt-2 flex flex-col gap-1.5">
                  {[4, 8].map((n) => (
                    <label key={n} className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                      <Checkbox checked={minProviders === n} onCheckedChange={() => setMinProviders(minProviders === n ? null : n)} />
                      {n}+ providers
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-caption font-medium text-muted-foreground">Settlement</h2>
                <p className="mt-2 flex items-center gap-1.5 text-body text-foreground">
                  <Badge tone="info" variant="soft">
                    USDC · x402
                  </Badge>
                </p>
              </div>
            </div>
          </aside>

          <div className="order-1 min-w-0 lg:order-2">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Search className="size-5" />}
                title="No markets match your filters"
                description="Try a different search or clear the filters."
                action={
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-button font-medium hover:bg-muted"
                  >
                    <X className="size-3.5" /> Clear filters
                  </button>
                }
              />
            ) : view === "list" ? (
              <div className="flex flex-col gap-3">
                {filtered.map((row) => (
                  <MarketCard key={row.id} row={row} />
                ))}
              </div>
            ) : (
              <DirectoryTable rows={filtered} />
            )}
            {filtersActive && filtered.length > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-caption text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

function MetaLine({ row }: { row: DirectoryRow }) {
  const parts = [
    `${row.providerCount} providers`,
    row.bestPrice !== null ? `from ${format.priceWithUnit(row.bestPrice)}` : null,
    row.bestP95 !== null ? `P95 from ${format.latency(row.bestP95)}` : null,
    row.freshestDataAgeMs !== null ? `freshest ${format.dataAge(row.freshestDataAgeMs)}` : null,
  ].filter(Boolean);
  return <p className="min-w-0 text-caption text-muted-foreground">{parts.join(" · ")}</p>;
}

function Thumbnail({ image, size }: { image?: MarketImage; size: number }) {
  if (!image) {
    return <span className="block shrink-0 rounded-md border border-border bg-muted" style={{ width: size, height: size }} />;
  }
  return (
    <picture className="block shrink-0 overflow-hidden rounded-md border border-border bg-muted" style={{ width: size, height: size }}>
      {image.avif ? <source srcSet={image.avif} type="image/avif" /> : null}
      <img src={image.src} alt={image.alt} width={size} height={size} loading="lazy" className="size-full object-cover grayscale contrast-110" />
    </picture>
  );
}

function MarketCard({ row }: { row: DirectoryRow }) {
  return (
    <Link
      href={row.href}
      className="group flex items-start gap-4 rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-primary-strong/40 hover:bg-card-hover max-sm:gap-3 max-sm:p-3"
    >
      <span className="max-sm:hidden">
        <Thumbnail image={row.image} size={64} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="sm:hidden">
              <Thumbnail image={row.image} size={36} />
            </span>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background max-sm:hidden">
              <MarketGlyph icon={row.icon} className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-body font-medium text-foreground">{row.name}</h3>
              <p className="truncate text-caption text-muted-foreground">{row.identifier}</p>
            </div>
          </div>
          {row.activeProviderName ? (
            <div className="flex shrink-0 items-center gap-1.5 text-caption text-muted-foreground">
              <ProviderLogo src={row.activeProviderLogo} name={row.activeProviderName} size={16} />
              <span className="text-foreground">{row.activeProviderName}</span>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-positive" />
            </div>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" variant="soft">
            <MarketGlyph icon={row.icon} tinted={false} />
            {row.groupLabel} · {row.categoryLabel}
          </Badge>
        </div>
        <p className="mt-2 line-clamp-2 text-body text-muted-foreground">{row.description}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <MetaLine row={row} />
          <div className="flex -space-x-1.5">
            {row.logos.map((l, i) => (
              <ProviderLogo key={`${l.name}-${i}`} src={l.logo} name={l.name} size={20} className="ring-2 ring-card" />
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function DirectoryTable({ rows }: { rows: readonly DirectoryRow[] }) {
  const router = useRouter();
  const navigate = (event: React.MouseEvent<HTMLTableRowElement>, href: string) => {
    if ((event.target as Element).closest("a")) return;
    router.push(href);
  };
  const navigateWithKeyboard = (event: React.KeyboardEvent<HTMLTableRowElement>, href: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    router.push(href);
  };
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Market</TableHead>
          <TableHead>Category</TableHead>
          <TableHead align="right">Providers</TableHead>
          <TableHead align="right">Qualify</TableHead>
          <TableHead align="right">Best price</TableHead>
          <TableHead align="right">Best P95</TableHead>
          <TableHead align="right">Freshest</TableHead>
          <TableHead>Active provider</TableHead>
          <TableHead>Mode</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            interactive
            tabIndex={0}
            aria-label={`Open ${row.name}`}
            onClick={(event) => navigate(event, row.href)}
            onKeyDown={(event) => navigateWithKeyboard(event, row.href)}
            className="focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            <TableRowHeader>
              <Link href={row.href} className="flex min-w-0 items-center gap-2 text-foreground no-underline">
                <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                  <MarketGlyph icon={row.icon} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs text-foreground">{row.name}</span>
                  <span className="block truncate text-micro text-faint">{row.identifier}</span>
                </span>
              </Link>
            </TableRowHeader>
            <TableCell>
              <span className="block truncate">{row.categoryLabel}</span>
              <span className="block truncate text-micro text-faint">{row.groupLabel}</span>
            </TableCell>
            <TableCell numeric>{row.providerCount}</TableCell>
            <TableCell numeric>
              {row.qualifiedCount} of {row.providerCount}
            </TableCell>
            <TableCell numeric>{row.bestPrice !== null ? format.priceWithUnit(row.bestPrice) : "—"}</TableCell>
            <TableCell numeric>{row.bestP95 !== null ? format.latency(row.bestP95) : "—"}</TableCell>
            <TableCell numeric>{row.freshestDataAgeMs !== null ? format.dataAge(row.freshestDataAgeMs) : "—"}</TableCell>
            <TableCell>
              {row.activeProviderName ? (
                <span className="flex items-center gap-1.5">
                  <ProviderLogo src={row.activeProviderLogo} name={row.activeProviderName} size={16} />
                  {row.activeProviderName}
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <Badge tone={row.mode === "pinned" ? "warning" : "neutral"} variant="soft">
                {row.mode === "pinned" ? "Pinned" : "Automatic"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
