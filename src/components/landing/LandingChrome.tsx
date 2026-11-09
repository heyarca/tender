import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TenderMark } from "@/components/shell/tender-mark";
import { landingStyles as styles } from "./styles";

export const DEMO_HREF = "/markets/btc-usd";

export function LandingLogo() {
  return (
    <Link href="/landing" className={styles.logo} aria-label="Tender home">
      <TenderMark title={null} className={styles.logoMark} />
      <span>Tender</span>
    </Link>
  );
}

export function LandingHeader() {
  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <LandingLogo />
          <nav aria-label="Main navigation" className={styles.navigation}>
            <Link href="/landing#markets" className={styles.navLink}>
              Markets
            </Link>
            <Link href="/landing#how-it-works" className={styles.navLink}>
              How it works
            </Link>
            <Link href={DEMO_HREF} className={styles.navAction}>
              Explore the demo <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div>
          <LandingLogo />
          <p>Make APIs compete for your traffic.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/landing#markets">Markets</Link>
          <Link href="/landing#how-it-works">How it works</Link>
          <Link href={DEMO_HREF}>
            Explore the demo <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </footer>
  );
}
