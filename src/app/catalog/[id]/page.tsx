import { notFound, permanentRedirect } from "next/navigation";
import { isRegisteredMarket, MARKET_SPECS } from "@/lib/registry";

/** Old catalog URLs. Every market lives at `/markets/{id}` now. */
export const instant = false;

export function generateStaticParams() {
  return MARKET_SPECS.map((market) => ({ id: market.id }));
}

export default async function CatalogRedirect({ params }: PageProps<"/catalog/[id]">) {
  const { id } = await params;
  if (!isRegisteredMarket(id)) notFound();
  permanentRedirect(`/markets/${id}`);
}
