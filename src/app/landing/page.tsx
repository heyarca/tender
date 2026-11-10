import type { Metadata } from "next";
import { AgentBanner } from "@/components/landing/AgentBanner";
import { ClosingSection, ManifestoSection } from "@/components/landing/ClosingSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { LandingFooter, LandingHeader } from "@/components/landing/LandingChrome";
import { LandingProductProviders } from "@/components/landing/LandingProductProviders";
import { MarketplaceSection } from "@/components/landing/MarketplaceSection";
import { MarketsSection } from "@/components/landing/MarketsSection";
import { PaySection } from "@/components/landing/PaySection";
import { PriceSection } from "@/components/landing/PriceSection";
import { RequirementsSection } from "@/components/landing/RequirementsSection";
import { SwitchSection } from "@/components/landing/SwitchSection";

const TITLE = "Tender — Always on the best API";
const DESCRIPTION =
  "If an API breaks, Tender switches. If a better one shows up, Tender switches. Your app never notices.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/landing" },
  openGraph: {
    type: "website",
    siteName: "Tender",
    locale: "en_US",
    url: "/landing",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <LandingProductProviders>
        <main id="main">
          <HeroSection />
          <AgentBanner />
          <PaySection />
          <MarketsSection />
          <RequirementsSection />
          <SwitchSection />
          <PriceSection />
          <MarketplaceSection />
          <ManifestoSection />
          <ClosingSection />
        </main>
      </LandingProductProviders>
      <LandingFooter />
    </>
  );
}
