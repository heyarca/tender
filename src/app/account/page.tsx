import type { Metadata } from "next";
import { AccountView } from "@/components/credits/account-view";
import { SimpleHeader } from "@/components/market/page/simple-header";
import { PageContainer } from "@/components/shell/page-container";

export const metadata: Metadata = {
  title: "Account",
  description: "Your Tender credits balance, transactions, and API keys.",
};

export default function AccountPage() {
  return (
    <>
      <SimpleHeader />
      <PageContainer className="max-w-5xl! pt-10">
        <AccountView />
      </PageContainer>
    </>
  );
}
