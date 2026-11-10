import { ppMori } from "@/fonts/pp-mori";
import "@/components/landing/landing-base.css";
import "@/components/landing/landing-hero.css";
import "@/components/landing/landing-agent.css";
import "@/components/landing/landing-pay.css";
import "@/components/landing/landing-markets.css";
import "@/components/landing/landing-product.css";
import "@/components/landing/landing-marketplace.css";
import { landingStyles as styles } from "@/components/landing/styles";

export default function LandingLayout({ children }: LayoutProps<"/landing">) {
  return <div className={`${styles.site} ${ppMori.variable}`}>{children}</div>;
}
