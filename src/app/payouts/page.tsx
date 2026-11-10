import type { Metadata } from "next";

import { SimpleHeader } from "@/components/market/page/simple-header";
import { PayoutsView } from "@/components/payouts/payouts-view";
import { PageContainer } from "@/components/shell/page-container";

export const metadata: Metadata = {
  title: "Payouts",
  description: "Provider earnings and PayPal payout batches.",
};

/** `/payouts`: provider earnings and PayPal Payouts batches. */
export default function PayoutsPage() {
  return (
    <>
      <SimpleHeader />
      <PageContainer>
        <PayoutsView />
      </PageContainer>
    </>
  );
}
