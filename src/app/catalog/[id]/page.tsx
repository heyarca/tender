import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogMarketDetail } from "@/components/market/catalog/catalog-market-detail";
import { CATALOG_MARKETS, getCatalogMarket } from "@/lib/catalog";

/** Fixture catalog pages are generated at build time; no market request is made here. */
export function generateStaticParams() {
  return CATALOG_MARKETS.map((market) => ({ id: market.id }));
}

export async function generateMetadata({ params }: PageProps<"/catalog/[id]">): Promise<Metadata> {
  const { id } = await params;
  const market = getCatalogMarket(id);
  if (!market) return { title: "Catalog market not found" };
  return {
    title: market.name,
    description: market.description,
  };
}

export default async function CatalogMarketPage({ params }: PageProps<"/catalog/[id]">) {
  const { id } = await params;
  const market = getCatalogMarket(id);
  if (!market) notFound();
  return <CatalogMarketDetail market={market} />;
}
