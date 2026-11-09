import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketIconCircle } from "@/components/market/page/market-icon";
import { marketHref } from "@/components/market/page/routes";
import { SimpleHeader } from "@/components/market/page/simple-header";
import { PageContainer } from "@/components/shell/page-container";
import { MARKET_IDS, MARKETS } from "@/lib/tender";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <SimpleHeader />
      <PageContainer className="pt-16">
        <div className="max-w-2xl">
          <p className="text-caption font-medium text-muted-foreground">404</p>
          <h1 className="mt-1">This page does not exist</h1>
          <p className="mt-2 text-body text-muted-foreground">
            The market or page you opened is not available. Tender has many markets, and AI agents can create new
            ones. Here are a few:
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {MARKET_IDS.slice(0, 4).map((id) => {
              const market = MARKETS[id];
              return (
                <li key={id}>
                  <Link
                    href={marketHref(id)}
                    className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 no-underline transition-colors duration-quick hover:bg-card-hover focus-visible:border-focus-border focus-visible:shadow-focus focus-visible:outline-none"
                  >
                    <MarketIconCircle icon={market.icon} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-medium text-foreground">{market.name}</span>
                      <span className="truncate text-caption text-muted-foreground">{market.identifier}</span>
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-quick group-hover:translate-x-0.5 group-hover:text-accent-foreground motion-reduce:transition-none"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href="/markets"
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-button font-medium text-foreground no-underline hover:bg-muted"
          >
            Browse all markets
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </PageContainer>
    </>
  );
}
