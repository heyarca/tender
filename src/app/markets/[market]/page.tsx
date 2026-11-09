import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarketSpec, isRegisteredMarket, MARKET_SPECS } from "@/lib/registry";

/**
 * This segment renders no UI (the market page lives in the shared `/markets` layout and
 * switches in place), so it may block on `params`. Awaiting them outside `<Suspense>` lets an
 * unknown market answer with a real 404 status instead of a streamed not-found page.
 */
export const instant = false;

/** Every registry market has a page. */
export function generateStaticParams() {
  return MARKET_SPECS.map((market) => ({ market: market.id }));
}

export async function generateMetadata({ params }: PageProps<"/markets/[market]">): Promise<Metadata> {
  const { market } = await params;
  const spec = getMarketSpec(market);
  if (!spec) return { title: "Market not found" };
  return { title: spec.name, description: spec.description };
}

/**
 * Validates the market id: unknown ids render the not-found page with a 404 status.
 * The market UI itself lives in `../layout.tsx`.
 */
export default async function MarketRoute({ params }: PageProps<"/markets/[market]">) {
  const { market } = await params;
  if (!isRegisteredMarket(market)) notFound();
  return null;
}
