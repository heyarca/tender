import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ComponentType } from "react";
import { BitcoinMarketVisual, WeatherMarketVisual } from "./MarketVisuals";
import { SectionHeader } from "./SectionHeader";
import { landingStyles as styles } from "./styles";

interface MarketCard {
  id: "btc-usd" | "sf-weather";
  title: string;
  description: string;
  href: string;
  Visual: ComponentType;
}

const MARKET_CARDS: readonly MarketCard[] = [
  {
    id: "btc-usd",
    title: "Bitcoin price",
    description: "Compare price feeds by request cost, response time, and data age.",
    href: "/markets/btc-usd",
    Visual: BitcoinMarketVisual,
  },
  {
    id: "sf-weather",
    title: "Weather",
    description: "Compare weather providers by request cost, response time, and update freshness.",
    href: "/markets/sf-weather",
    Visual: WeatherMarketVisual,
  },
];

/** #markets: two example markets as tall cards, each with the product's own result at the bottom. */
export function MarketsSection() {
  return (
    <section id="markets" className={styles.section} aria-labelledby="markets-title">
      <div className={styles.container}>
        <SectionHeader
          titleId="markets-title"
          title={
            <>
              Compare providers for
              <br />
              the data your app needs.
            </>
          }
          lead="Tender runs multiple markets, from weather and crypto prices to currencies, and AI agents can create more. Compare the providers in each market, set your requirements, and see which one gets the next request."
        />
        <div className={styles.marketGrid}>
          {MARKET_CARDS.map(({ id, title, description, href, Visual }) => (
            <article key={id} className={`${styles.card} ${styles.marketCard}`} aria-labelledby={`market-card-${id}`}>
              <h3 id={`market-card-${id}`} className={styles.marketHeading}>
                <Link href={href} className={styles.marketLink}>
                  {title}
                  <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                </Link>
              </h3>
              <p className={styles.marketDescription}>{description}</p>
              <Visual />
            </article>
          ))}
        </div>
        <Link href="/markets" className={styles.marketCatalogLink}>
          Browse all APIs
          <ChevronRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}
