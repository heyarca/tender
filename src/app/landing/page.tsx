import type { Metadata } from "next";
import { ClosingSection } from "@/components/landing/ClosingSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { LandingFooter, LandingHeader } from "@/components/landing/LandingChrome";
import { LandingProductProviders } from "@/components/landing/LandingProductProviders";
import { MarketplaceSection } from "@/components/landing/MarketplaceSection";
import { MarketsSection } from "@/components/landing/MarketsSection";
import { PriceSection } from "@/components/landing/PriceSection";
import { RequirementsSection } from "@/components/landing/RequirementsSection";
import { SwitchSection } from "@/components/landing/SwitchSection";

const TITLE = "Tender — Make APIs compete for your traffic";
const DESCRIPTION =
  "Compare API providers on price, speed, and data freshness. Set your requirements, and Tender routes each request to a provider that meets them.";

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
          <MarketsSection />
          <RequirementsSection />
          <SwitchSection />
          <PriceSection />
          <MarketplaceSection />
          <ClosingSection />
        </main>
      </LandingProductProviders>
      <LandingFooter />
    </>
  );
}
