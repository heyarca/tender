"use client";

import { LayoutGrid, Search, Table2, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { GridApi } from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ExportCsvButton } from "@/components/ui/data-grid-features";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { Select, type SelectOption } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TopNav } from "@/components/shell/top-nav";
import { PageContainer } from "@/components/shell/page-container";
import { cn } from "@/lib/utils";
import { MarketGlyph } from "@/components/market/page/market-icon";
import { CATEGORIES, categoriesOf, getCategory, GROUPS, MARKET_SPECS } from "@/lib/registry";
import { format, MARKET_IDS, selectMarketView, type MarketState } from "@/lib/tender";
import { useTenderSelector, useTenderStore } from "@/lib/tender/client";
import { AgentInstallBanner } from "./agent-install-banner";
import { DirectoryGrid } from "./directory-grid";
import {
  CATEGORY_COUNTS,
  EMPTY_QUERY,
  filterRows,
  FRESHNESS_BUCKETS,
  GROUP_COUNTS,
  limitsActive,
  liveRow,
  parseQuery,
  PROVIDER_MINIMUMS,
  queryString,
  REGISTRY_ROWS,
  sameQuery,
  sidebarActive,
  SORT_PRESETS,
  sortKey,
  sortLabel,
  sortRows,
  type DirectoryLimits,
  type DirectoryQuery,
  type DirectoryRow,
  type DirectorySort,
} from "./directory-model";
import { MarketThumbnail } from "./market-thumbnail";

const rowCache = new WeakMap<MarketState, DirectoryRow>();

/**
 * One store subscription for the whole directory, and every market watched while it is open, so the
 * monitor samples them every 5 s and the table ticks. A market's row is rebuilt only when its state changes.
 */
function useDirectoryRows(): readonly DirectoryRow[] {
  const store = useTenderStore();
  useEffect(() => {
    const releases = MARKET_IDS.map((id) => store.watch(id));
    return () => releases.forEach((release) => release());
  }, [store]);
  const markets = useTenderSelector((state) => state.markets);
  return useMemo(
    () =>
      REGISTRY_ROWS.map((row) => {
        const state = markets[row.id];
        if (!state) return row;
        let live = rowCache.get(state);
        if (!live) {
          live = liveRow(row, selectMarketView(state));
          rowCache.set(state, live);
        }
        return live;
      }),
    [markets],
  );
}

const VIEW_STORAGE_KEY = "tender:v1:directory-view";

const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/** The last view chosen on this device (storage can be unavailable: then the list). */
function readStoredView(): "list" | "table" {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "table" ? "table" : "list";
  } catch {
    return "list";
  }
}

/** Reads the query from the URL (in its own Suspense boundary so the directory still prerenders). */
function QueryFromUrl({ onChange }: { onChange: (query: DirectoryQuery) => void }) {
  const params = useSearchParams();
  useEffect(() => onChange(parseQuery(params)), [params, onChange]);
  return null;
}

function limitChips(limits: DirectoryLimits): { key: keyof DirectoryLimits; label: string }[] {
  const chips: { key: keyof DirectoryLimits; label: string }[] = [];
  if (limits.maxBid !== undefined) chips.push({ key: "maxBid", label: `Winning bid \u2264 ${format.price(limits.maxBid)}` });
  if (limits.maxP95 !== undefined) chips.push({ key: "maxP95", label: `P95 \u2264 ${format.latency(limits.maxP95)}` });
  if (limits.minSuccess !== undefined) chips.push({ key: "minSuccess", label: `Success \u2265 ${format.percent(limits.minSuccess)}` });
  return chips;
}

export function MarketDirectory() {
  const rows = useDirectoryRows();
  const [query, setQuery] = useState<DirectoryQuery>(EMPTY_QUERY);
  const storedView = useSyncExternalStore(subscribeStorage, readStoredView, () => "list" as const);
  const [chosenView, setChosenView] = useState<"list" | "table" | null>(null);
  const [api, setApi] = useState<GridApi<DirectoryRow> | null>(null);
  const urlRead = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const view = query.view ?? chosenView ?? storedView;

  const applyUrlQuery = useCallback((next: DirectoryQuery) => {
    urlRead.current = true;
    setQuery((current) => (sameQuery(current, next) ? current : next));
  }, []);

  // Mirror the query in the URL, so a filtered, sorted view is a link (history.replaceState syncs with the router).
  useEffect(() => {
    if (!urlRead.current) return;
    const search = queryString(query);
    if (search !== window.location.search) window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  }, [query]);

  const update = useCallback((patch: Partial<DirectoryQuery>) => setQuery((current) => ({ ...current, ...patch })), []);
  const onSortChange = useCallback((sort: DirectorySort | null) => update({ sort }), [update]);
  const onLimitsChange = useCallback((limits: DirectoryLimits) => update({ limits }), [update]);
  const clearFilters = useCallback(
    () => update({ q: "", group: null, categories: [], maxFreshnessMs: null, minProviders: null, limits: {} }),
    [update],
  );

  const setView = (next: "list" | "table") => {
    setChosenView(next);
    update({ view: next === "table" ? "table" : null });
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Not persisted.
    }
  };

  const selectGroup = (group: string | null) => {
    const categories = group ? query.categories.filter((id) => getCategory(id)?.groupId === group) : query.categories;
    update({ group, categories });
  };

  const toggleCategory = (categoryId: string, checked: boolean) => {
    const categories = checked
      ? CATEGORIES.map((category) => category.id).filter((id) => id === categoryId || query.categories.includes(id))
      : query.categories.filter((id) => id !== categoryId);
    update({ categories });
  };

  const filtered = useMemo(() => filterRows(rows, query), [rows, query]);
  const listed = useMemo(() => (view === "list" ? sortRows([...filtered], query.sort) : []), [filtered, query.sort, view]);

  const filtersActive = query.q !== "" || sidebarActive(query) || limitsActive(query.limits);
  const sidebarGroups = query.group ? GROUPS.filter((group) => group.id === query.group) : GROUPS;
  const chips = limitChips(query.limits);

  const currentSortKey = sortKey(query.sort);
  const sortItems: SelectOption[] = SORT_PRESETS.some((preset) => preset.value === currentSortKey)
    ? SORT_PRESETS.map(({ value, label }) => ({ value, label }))
    : [...SORT_PRESETS.map(({ value, label }) => ({ value, label })), { value: currentSortKey, label: sortLabel(query.sort!) }];
  const onSortSelect = (value: string) => {
    const preset = SORT_PRESETS.find((item) => item.value === value);
    if (preset) update({ sort: preset.sort });
  };

  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={null}>
        <QueryFromUrl onChange={applyUrlQuery} />
      </Suspense>
      <TopNav links={[]} onSearch={() => searchRef.current?.focus()} />
      <PageContainer>
        <AgentInstallBanner />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-title font-semibold text-foreground">Markets</h1>
            <p className="mt-1 max-w-2xl text-body text-muted-foreground">
              APIs where providers compete to serve your requests on price, latency, freshness, and
              reliability. New markets open all the time, and AI agents can create more.
            </p>
          </div>
          <ButtonLink href="/leaderboard" variant="outline">
            <Trophy aria-hidden="true" />
            Provider leaderboard
          </ButtonLink>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query.q}
              onChange={(event) => update({ q: event.target.value })}
              placeholder="Search markets, providers, or contracts…"
              className="pl-8"
              aria-label="Search markets"
            />
          </div>
          <Select items={sortItems} value={currentSortKey} onValueChange={onSortSelect} aria-label="Sort markets" className="shrink-0" />
          <SegmentedControl
            items={[
              { value: "list", label: "List", icon: <LayoutGrid className="size-3.5" /> },
              { value: "table", label: "Table", icon: <Table2 className="size-3.5" /> },
            ]}
            value={view}
            onValueChange={setView}
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
              const selected = query.group === tab.id;
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
                          const checked = query.categories.includes(category.id);
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
                        checked={query.maxFreshnessMs === bucket.maxMs}
                        onChange={() => update({ maxFreshnessMs: bucket.maxMs })}
                      />
                      {bucket.label}
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                    <input
                      type="radio"
                      name="freshness"
                      className="accent-[var(--primary-strong)]"
                      checked={query.maxFreshnessMs === null}
                      onChange={() => update({ maxFreshnessMs: null })}
                    />
                    Any
                  </label>
                </div>
              </div>
              <div>
                <h2 className="text-caption font-medium text-muted-foreground">Providers</h2>
                <div className="mt-2 flex flex-col gap-1.5">
                  {PROVIDER_MINIMUMS.map((n) => (
                    <label key={n} className="flex cursor-pointer items-center gap-2 text-body text-foreground">
                      <Checkbox
                        checked={query.minProviders === n}
                        onCheckedChange={() => update({ minProviders: query.minProviders === n ? null : n })}
                      />
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
            <div className="mb-3 flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-caption text-muted-foreground tabular-nums" aria-live="polite">
                {filtered.length === MARKET_SPECS.length ? `${filtered.length} markets` : `${filtered.length} of ${MARKET_SPECS.length} markets`}
              </p>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => update({ limits: { ...query.limits, [chip.key]: undefined } })}
                  aria-label={`Remove filter ${chip.label}`}
                  className="inline-flex h-6 items-center gap-1 rounded-sm bg-accent px-1.5 text-overline font-medium text-accent-foreground hover:bg-primary-hover/40"
                >
                  {chip.label}
                  <X aria-hidden="true" className="size-3" />
                </button>
              ))}
              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-caption text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Clear filters
                </button>
              ) : null}
              {view === "table" ? (
                <span className="ml-auto">
                  <ExportCsvButton api={api} fileName="tender-markets.csv" />
                </span>
              ) : null}
            </div>
            {view === "table" ? (
              <DirectoryGrid
                rows={rows}
                query={query}
                visibleCount={filtered.length}
                onSortChange={onSortChange}
                onLimitsChange={onLimitsChange}
                onClear={clearFilters}
                onApi={setApi}
              />
            ) : listed.length === 0 ? (
              <EmptyState
                icon={<Search className="size-5" />}
                title="No markets match your filters"
                description="Try a different search, raise a limit, or clear the filters."
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    <X aria-hidden="true" /> Clear filters
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {listed.map((row) => (
                  <MarketCard key={row.id} row={row} />
                ))}
              </div>
            )}
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

function MarketCard({ row }: { row: DirectoryRow }) {
  return (
    <Link
      href={row.href}
      className="group flex items-start gap-4 rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-primary-strong/40 hover:bg-card-hover max-sm:gap-3 max-sm:p-3"
    >
      <span className="max-sm:hidden">
        <MarketThumbnail image={row.image} size={64} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="sm:hidden">
              <MarketThumbnail image={row.image} size={36} />
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
