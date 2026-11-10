import type { Metadata } from "next";

import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";
import { SimpleHeader } from "@/components/market/page/simple-header";
import { PageContainer } from "@/components/shell/page-container";

export const metadata: Metadata = {
  title: "Provider leaderboard",
  description: "Every Tender provider across the markets: markets won, bids, measured latency and success, and PayPal earnings.",
};

/** `/leaderboard`: providers ranked by the markets they win right now. */
export default function LeaderboardPage() {
  return (
    <>
      <SimpleHeader />
      <PageContainer>
        <LeaderboardView />
      </PageContainer>
    </>
  );
}
