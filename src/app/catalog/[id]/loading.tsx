import { PageContainer } from "@/components/shell/page-container";

/** Keeps the static catalog route calm while its segment resolves. */
export default function CatalogMarketLoading() {
  return (
    <PageContainer>
      <div className="animate-pulse space-y-5" aria-label="Loading catalog market">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-16 rounded-lg border border-border bg-card" />
        <div className="h-72 rounded-lg border border-border bg-card" />
      </div>
    </PageContainer>
  );
}
