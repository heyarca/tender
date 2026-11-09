import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ButtonLink } from "./LandingButton";
import { TenderWordmark } from "./TenderWordmark";
import { landingStyles as styles } from "./styles";

export const DEMO_HREF = "/markets";

export function LandingLogo({ large = false }: { large?: boolean }) {
  return <Link href="/landing" className={`${styles.logo} ${large ? styles.logoLarge : ""}`} aria-label="Tender home"><TenderWordmark title={null} /></Link>;
}

export function LandingHeader() {
  return <><a className={styles.skipLink} href="#main">Skip to content</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <LandingLogo />
      <nav aria-label="Main navigation" className={styles.navigation}>
        <Link href="/markets" className={styles.navLink}>Markets</Link>
        <Link href="/landing#how-it-works" className={styles.navLink}>How it works</Link>
        <Link href="/landing#marketplace" className={styles.navLink}>Marketplace</Link>
      </nav>
      <ButtonLink href={DEMO_HREF} icon={<ArrowUpRight size={20} />}>Try Tender</ButtonLink>
    </div></header>
  </>;
}

export function LandingFooter() {
  return <footer className={styles.footer}><div className={styles.container}>
    <div className={styles.footerTop}><div className={styles.footerBrand}><LandingLogo large /><p>Make APIs compete<br />for your traffic.</p></div>
      <nav aria-label="Footer markets"><h3>Markets</h3><Link href="/markets/btc-usd">Bitcoin price <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/markets/sz-mlcc">Shenzhen MLCC spot <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/markets/freight-sha-lax">Container freight <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/catalog/web-search">Web search <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/catalog/chat-general">General chat <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/markets">Browse all APIs <ArrowUpRight size={16} aria-hidden="true" /></Link></nav>
      <nav aria-label="Footer product"><h3>Product</h3><Link href="/landing#how-it-works">Your requirements</Link><Link href="/landing#switch-providers">Automatic switching</Link><Link href="/landing#better-prices">Price competition</Link><Link href="/landing#marketplace">The marketplace</Link></nav>
    </div>
    <div className={styles.footerBottom}><span>Tender</span><Link href={DEMO_HREF}>Find your next provider <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
  </div></footer>;
}
