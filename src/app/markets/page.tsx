import type { Metadata } from "next";
import { MarketDirectory } from "@/components/market/directory/market-directory";

export const metadata: Metadata = {
  title: "Markets",
  description: "APIs where providers compete on price, latency, freshness, and reliability.",
};

/** `/markets` lists every API market, like OpenRouter's model directory. */
export default function MarketsIndex() {
  return <MarketDirectory />;
}
