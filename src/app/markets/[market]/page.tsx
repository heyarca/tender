import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMarketDefinition, isMarketId, MARKET_IDS } from "@/lib/tender";

export function generateStaticParams() {
  return MARKET_IDS.map((market) => ({ market }));
}

export async function generateMetadata({ params }: PageProps<"/markets/[market]">): Promise<Metadata> {
  const { market } = await params;
  if (!isMarketId(market)) return { title: "Market not found" };
  const definition = getMarketDefinition(market);
  return { title: definition.name, description: definition.description };
}

/** Unknown market ids render the not-found page. The market UI itself lives in `../layout.tsx`. */
async function MarketGuard({ params }: Pick<PageProps<"/markets/[market]">, "params">) {
  const { market } = await params;
  if (!isMarketId(market)) notFound();
  return null;
}

export default function MarketRoute({ params }: PageProps<"/markets/[market]">) {
  return (
    <Suspense fallback={null}>
      <MarketGuard params={params} />
    </Suspense>
  );
}
