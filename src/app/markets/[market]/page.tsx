import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarketDefinition, isMarketId, MARKET_IDS } from "@/lib/tender";

/**
 * This segment renders no UI (the market page lives in the shared `/markets` layout and
 * switches in place), so it may block on `params`. Awaiting them outside `<Suspense>` lets an
 * unknown market answer with a real 404 status instead of a streamed not-found page.
 */
export const instant = false;

export function generateStaticParams() {
  return MARKET_IDS.map((market) => ({ market }));
}

export async function generateMetadata({ params }: PageProps<"/markets/[market]">): Promise<Metadata> {
  const { market } = await params;
  if (!isMarketId(market)) return { title: "Market not found" };
  const definition = getMarketDefinition(market);
  return { title: definition.name, description: definition.description };
}

/**
 * Validates the market id: unknown ids render the not-found page with a 404 status.
 * The market UI itself lives in `../layout.tsx`.
 */
export default async function MarketRoute({ params }: PageProps<"/markets/[market]">) {
  const { market } = await params;
  if (!isMarketId(market)) notFound();
  return null;
}
