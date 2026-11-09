"use client";

import { Bitcoin, Cloud, LayoutGrid, Search, Table2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { format, MARKET_IDS, type MarketId, type ProviderRow } from "@/lib/tender";
import { useMarketView } from "@/lib/tender/client";

/** Hard-coded: "cloud" markets are Weather, everything else is Crypto prices. */
function categoryFor(icon: "cloud" | "bitcoin"): "Weather" | "Crypto prices" {
  return icon === "cloud" ? "Weather" : "Crypto prices";
}

interface DirectoryRow {
  id: MarketId;
  name: string;
  identifier: string;
  contract: string;
  description: string;
  category: "Weather" | "Crypto prices";
  icon: "cloud" | "bitcoin";
  priceUnit: string;
  providerCount: number;
  qualifiedCount: number;
  bestPrice: number | null;
  bestPriceProviderName: string | null;
  bestP95: number | null;
  freshestDataAgeMs: number | null;
  activeProviderId: string | null;
  activeProviderName: string | null;
  activeProviderLogo: string | undefined;
  successRate: number | null;
  mode: "auto" | "pinned";
  logos: { name: string; logo?: string }[];
}

function qualified(providers: readonly ProviderRow[]): ProviderRow[] {
  return providers.filter((p) => p.evaluation.qualifies);
}

function useDirectoryRows(): DirectoryRow[] {
  // MARKET_IDS is a fixed-length constant, so a fixed number of hook calls is safe here.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const views = MARKET_IDS.map((id) => useMarketView(id));
  return useMemo(
    () =>
      views.map((view) => {
        const q = qualified(view.providers);
        const active = view.metrics.activeProviderId ? view.providersById[view.metrics.activeProviderId] : null;
        return {
          id: view.id,
          name: view.definition.name,
          identifier: view.definition.identifier,
          contract: view.definition.contract,
          description: view.definition.description,
          category: categoryFor(view.definition.icon),
          icon: view.definition.icon,
          priceUnit: view.definition.units.price,
          providerCount: view.providers.length,
          qualifiedCount: view.qualifiedCount,
          bestPrice: view.bestPrice?.conditions.bidPrice ?? null,
          bestPriceProviderName: view.bestPrice?.identity.name ?? null,
          bestP95: q.length ? Math.min(...q.map((p) => p.conditions.p95LatencyMs)) : null,
          freshestDataAgeMs: q.length ? Math.min(...q.map((p) => p.conditions.dataAgeMs)) : null,
          activeProviderId: view.metrics.activeProviderId,
          activeProviderName: view.metrics.activeProviderName,
          activeProviderLogo: active?.identity.logo,
          successRate: view.metrics.successRate,
          mode: view.policy.mode.kind,
          logos: view.providers.slice(0, 5).map((p) => ({ name: p.identity.name, logo: p.identity.logo })),
        } satisfies DirectoryRow;
      }),
    [views],
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
  recommended: (a, b) => b.qualifiedCount - a.qualifiedCount || (a.bestPrice ?? Infinity) - (b.bestPrice ?? Infinity),
  price: (a, b) => (a.bestPrice ?? Infinity) - (b.bestPrice ?? Infinity),
  latency: (a, b) => (a.bestP95 ?? Infinity) - (b.bestP95 ?? Infinity),
  freshness: (a, b) => (a.freshestDataAgeMs ?? Infinity) - (b.freshestDataAgeMs ?? Infinity),
  providers: (a, b) => b.providerCount - a.providerCount,
};

function matchesSearch(row: DirectoryRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.name, row.identifier, row.contract, row.category, ...row.logos.map((l) => l.name)]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

const FRESHNESS_BUCKETS = [
  { id: "1s", label: "\u2264 1 s", maxMs: 1_000 },
  { id: "1m", label: "\u2264 1 min", maxMs: 60_000 },
  { id: "15m", label: "\u2264 15 min", maxMs: 900_000 },
] as const;

const CATEGORY_ICON: Record<DirectoryRow["category"], React.ReactNode> = {
  Weather: <Cloud className="size-4" />,
  "Crypto prices": <Bitcoin className="size-4" />,
};

export function MarketDirectory() {
  const rows = useDirectoryRows();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | DirectoryRow["category"]>("All");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [view, setView] = useState<"list" | "table">(() => {
    if (typeof window === "undefined") return "list";
    return window.localStorage.getItem("tender:v1:directory-view") === "table" ? "table" : "list";
  });
  const [minProviders, setMinProviders] = useState<number | null>(null);
  const [maxFreshnessMs, setMaxFreshnessMs] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const setViewPersist = (next: "list" | "table") => {
    setView(next);
    if (typeof window !== "undefined") window.localStorage.setItem("tender:v1:directory-view", next);
  };

  const categories = useMemo(() => {
    const counts = new Map<DirectoryRow["category"], number>();
    for (const row of rows) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    return counts;
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows
        .filter((row) => matchesSearch(row, query))
        .filter((row) => category === "All" || row.category === category)
        .filter((row) => minProviders === null || row.providerCount >= minProviders)
        .filter((row) => maxFreshnessMs === null || (row.freshestDataAgeMs ?? Infinity) <= maxFreshnessMs)
        .sort(sorters[sort]),
    [rows, query, category, minProviders, maxFreshnessMs, sort],
  );

  const clearFilters = () => {
    setQuery("");
    setCategory("All");
    setMinProviders(null);
    setMaxFreshnessMs(null);
  };
  const filtersActive = query !== "" || category !== "All" || minProviders !== null || maxFreshnessMs !== null;

  return (
    <div className="flex min-h-full flex-col">
      <TopNav
        links={[{ label: "Markets", href: "/markets" }]}
        activeHref="/markets"
        onSearch={() => searchRef.current?.focus()}
      />
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-title font-semibold text-foreground">Markets</h1>
            <p className="mt-1 max-w-2xl text-body text-muted-foreground">
              APIs where providers compete to serve your requests on price, latency, freshness, and
              reliability.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
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
          <Select
            items={SORT_OPTIONS}
            value={sort}
            onValueChange={setSort}
            aria-label="Sort markets"
            className="shrink-0"
          />
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

        <div className="mt-3 flex flex-wrap items-center gap-1 border-b border-border pb-3">
          {(["All", ...Array.from(categories.keys())] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-button font-medium transition-colors",
                category === c
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent-subtle hover:text-accent-foreground",
              )}
            >
              {c} <span className="text-caption text-muted-foreground">{c === "All" ? rows.length : categories.get(c)}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
          <aside className="order-2 lg:order-1 lg:sticky lg:top-[calc(var(--navbar-height)+24px)] lg:self-start">
            <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4 lg:border-0 lg:bg-transparent lg:p-0">
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
                      <input
                        type="checkbox"
                        className="accent-[var(--primary-strong)]"
                        checked={minProviders === n}
                        onChange={() => setMinProviders(minProviders === n ? null : n)}
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
                  every market
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
  return <p className="text-caption text-muted-foreground">{parts.join(" · ")}</p>;
}

function MarketCard({ row }: { row: DirectoryRow }) {
  return (
    <Link
      href={`/markets/${row.id}`}
      className="group block rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-primary-strong/40 hover:bg-card-hover"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
            {CATEGORY_ICON[row.category]}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-body font-medium text-foreground">{row.name}</h3>
              <Badge tone="neutral" variant="soft">
                {row.category}
              </Badge>
              <Badge tone="info" variant="soft">
                USDC
              </Badge>
            </div>
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
      <p className="mt-2 line-clamp-2 text-body text-muted-foreground">{row.description}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <MetaLine row={row} />
        <div className="flex -space-x-1.5">
          {row.logos.map((l, i) => (
            <ProviderLogo key={`${l.name}-${i}`} src={l.logo} name={l.name} size={20} className="ring-2 ring-card" />
          ))}
        </div>
      </div>
    </Link>
  );
}

function DirectoryTable({ rows }: { rows: DirectoryRow[] }) {
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
          <TableRow key={row.id} interactive>
            <TableRowHeader>
              <Link href={`/markets/${row.id}`} className="flex min-w-0 items-center gap-2 text-foreground no-underline">
                <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                  {CATEGORY_ICON[row.category]}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs text-foreground">{row.name}</span>
                  <span className="block truncate text-micro text-faint">{row.identifier}</span>
                </span>
              </Link>
            </TableRowHeader>
            <TableCell>{row.category}</TableCell>
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
