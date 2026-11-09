"use client";

import { ArrowLeft, Braces, CheckCircle2, Clock3, Route, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ProviderLogo } from "@/components/ui/provider-logo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import { PageContainer } from "@/components/shell/page-container";
import { TopNav } from "@/components/shell/top-nav";
import type { CatalogMarketDemo } from "@/lib/catalog";

export interface CatalogMarketDetailProps {
  market: CatalogMarketDemo;
}

function formatPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

function formatFreshness(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds} ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(milliseconds % 1_000 ? 1 : 0)} s`;
  return `${Math.round(milliseconds / 60_000)} min`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value * 100 % 1 ? 1 : 0)}%`;
}

/**
 * Read-only catalog fixture detail. This intentionally has no request execution,
 * state store, payment action, or network call.
 */
export function CatalogMarketDetail({ market }: CatalogMarketDetailProps) {
  const providers = [...market.providers].sort((a, b) => a.pricePerMillionUsd - b.pricePerMillionUsd);
  const lowestBid = providers[0]?.pricePerMillionUsd ?? 0;
  const freshest = Math.min(...providers.map((provider) => provider.freshnessMs));
  const lowestP95 = Math.min(...providers.map((provider) => provider.p95LatencyMs));
  const sampleResult = JSON.stringify(market.sampleResult, null, 2);
  const bidLimit = lowestBid * 1.2;
  const latencyLimit = Math.max(1_000, Math.ceil(lowestP95 / 100) * 200);
  const freshnessLimit = Math.max(1_000, Math.ceil(freshest / 1_000) * 2_000);

  return (
    <div className="min-h-full bg-background">
      <TopNav
        links={[{ label: "Markets", href: "/markets" }]}
        activeHref="/markets"
        onSearch={() => { window.location.assign("/markets"); }}
        searchLabel="Browse markets"
      />
      <PageContainer>
        <Link
          href="/markets"
          className="inline-flex items-center gap-1.5 text-button text-muted-foreground transition-colors hover:text-accent-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          All markets
        </Link>

        <header className="mt-5 border-b border-border pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="soft" tone="active">{market.category}</Badge>
                <span className="font-mono text-caption text-faint">{market.identifier}</span>
              </div>
              <h1 className="mt-3 text-display font-semibold tracking-[-0.02em] text-foreground">{market.name}</h1>
              <p className="mt-2 max-w-3xl text-body text-muted-foreground">{market.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-accent-border bg-accent-subtle px-3 py-2 text-caption text-accent-foreground">
              <Braces className="size-4" aria-hidden />
              <span>JSON response contract</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            <Metric label="Providers" value={String(providers.length)} detail="illustrative offers" />
            <Metric label="Lowest bid" value={`${formatPrice(lowestBid)} / 1M`} detail="illustrative offer" />
            <Metric label="Freshest data" value={formatFreshness(freshest)} detail="reported data age" />
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="contract-heading">
              <SectionHeading icon={<Braces />} title="Contract" description="A normalized result shape for this market." />
              <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                  <span className="font-mono text-caption text-muted-foreground">{market.contract}</span>
                  <Badge variant="outline" tone="neutral">GET</Badge>
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-caption leading-6 text-foreground"><code>{sampleResult}</code></pre>
              </div>
            </section>

            <section aria-labelledby="providers-heading">
              <SectionHeading icon={<Zap />} title="Provider offers" description="Illustrative provider terms for the same contract." />
              <div className="mt-3">
                <Table density="compact" containerClassName="shadow-none">
                  <TableHeader>
                    <TableRow static>
                      <TableHead>Provider</TableHead>
                      <TableHead align="right" unit="USD / 1M">Bid</TableHead>
                      <TableHead align="right" unit="ms">P95</TableHead>
                      <TableHead align="right">Freshness</TableHead>
                      <TableHead align="right">Success</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((provider, index) => {
                      const selected = index === 0;
                      return (
                        <TableRow key={provider.id} selected={selected}>
                          <TableRowHeader>
                            <div className="flex items-center gap-2">
                              <ProviderLogo src={provider.logo} name={provider.name} size={20} />
                              <span>{provider.name}</span>
                            </div>
                          </TableRowHeader>
                          <TableCell numeric strong>{formatPrice(provider.pricePerMillionUsd)}</TableCell>
                          <TableCell numeric>{provider.p95LatencyMs} ms</TableCell>
                          <TableCell numeric>{formatFreshness(provider.freshnessMs)}</TableCell>
                          <TableCell numeric>{formatPercent(provider.successRate)}</TableCell>
                          <TableCell>
                            <Badge variant="soft" tone={selected ? "active" : "neutral"} dot={selected}>
                              {selected ? "Lowest bid" : "Offer"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-[calc(var(--navbar-height)+24px)] xl:self-start">
            <section aria-labelledby="policy-heading" className="rounded-lg border border-border bg-card p-4">
              <SectionHeading icon={<Route />} title="Routing policy" description="Example thresholds" compact />
              <dl className="mt-4 divide-y divide-border">
                <PolicyRow label="Max bid" value={`${formatPrice(bidLimit)} / 1M`} />
                <PolicyRow label="P95 latency" value={`≤ ${latencyLimit} ms`} />
                <PolicyRow label="Data freshness" value={`≤ ${formatFreshness(freshnessLimit)}`} />
                <PolicyRow label="Success rate" value="≥ 99.0%" />
              </dl>
              <p className="mt-4 rounded-md bg-muted px-3 py-2 text-caption leading-5 text-muted-foreground">
                This example prefers the lowest bid. Ties use lower P95 latency, then fresher data.
              </p>
            </section>

            <section aria-labelledby="assurance-heading" className="rounded-lg border border-border bg-card p-4">
              <SectionHeading icon={<ShieldCheck />} title="Contract guide" compact />
              <ul className="mt-3 space-y-2.5 text-caption text-muted-foreground">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-positive-text" aria-hidden />One result shape keeps provider outputs comparable.</li>
                <li className="flex gap-2"><Clock3 className="mt-0.5 size-3.5 shrink-0 text-positive-text" aria-hidden />Freshness is one input to provider selection.</li>
              </ul>
            </section>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="mt-1 text-section font-medium text-foreground">{value}</p>
      <p className="mt-0.5 text-micro text-faint">{detail}</p>
    </div>
  );
}

function SectionHeading({ icon, title, description, compact = false }: { icon: ReactNode; title: string; description?: string; compact?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-accent-foreground [&_svg]:size-4" aria-hidden>{icon}</span>
      <div>
        <h2 className={compact ? "text-heading font-medium text-foreground" : "text-section font-medium text-foreground"}>{title}</h2>
        {description ? <p className="mt-0.5 text-caption text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-caption">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-medium text-foreground">{value}</dd>
    </div>
  );
}
