import Link from "next/link";
import { PageContainer } from "@/components/shell/page-container";

export default function CatalogMarketNotFound() {
  return (
    <PageContainer>
      <div className="max-w-lg rounded-lg border border-border bg-card p-6">
        <p className="text-caption font-medium text-muted-foreground">Catalog</p>
        <h1 className="mt-2 text-title font-semibold text-foreground">Market not found</h1>
        <p className="mt-2 text-body text-muted-foreground">This market is not in the current catalog.</p>
        <Link href="/markets" className="mt-5 inline-flex text-button font-medium text-accent-foreground underline underline-offset-4">
          Browse markets
        </Link>
      </div>
    </PageContainer>
  );
}
