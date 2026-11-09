import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Layers3 } from "lucide-react";
import {
  LandingHeader,
  LandingFooter,
  DEMO_HREF,
} from "@/components/landing/LandingChrome";
import {
  BitcoinMarketVisual,
  WeatherMarketVisual,
} from "@/components/landing/MarketVisuals";
import {
  HeroSelection,
  RequirementsExplorer,
  FailoverScene,
  PriceScene,
} from "@/components/landing/LandingScenes";
import { landingStyles as styles } from "@/components/landing/styles";

// Vercel supplies deployment identity; no product behavior is controlled by environment flags.
const deploymentHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(
    deploymentHost ? `https://${deploymentHost}` : "http://localhost:3417",
  ),
  title: "Tender — Make APIs compete for your traffic",
  description:
    "Compare API providers on price, speed, and data freshness. Explore Tender’s demo and see how requirements change where requests go.",
  openGraph: {
    title: "Tender — Make APIs compete for your traffic",
    description:
      "Compare API providers on price, speed, and data freshness. Explore Tender’s demo and see how requirements change where requests go.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tender — Make APIs compete for your traffic",
  },
};

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main id="main">
        <section
          className={`${styles.container} ${styles.hero}`}
          aria-labelledby="hero-title"
        >
          <div className={styles.heroCopy}>
            <h1 id="hero-title">
              Make APIs compete
              <br />
              for your traffic.
            </h1>
            <p>
              Compare API providers on price, speed, and data freshness. Set
              your requirements, and Tender routes requests to a provider that
              meets them.
            </p>
            <div className={styles.heroActions}>
              <Link href={DEMO_HREF} className={styles.primaryButton}>
                Explore the demo <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className={styles.textButton}>
                See how it works <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
            <p className={styles.disclosure}>
              Interactive demo with simulated providers and performance.
            </p>
          </div>
          <HeroSelection />
        </section>

        <section
          id="markets"
          className={`${styles.container} ${styles.section}`}
          aria-labelledby="markets-title"
        >
          <div className={styles.sectionIntro}>
            <h2 id="markets-title">
              Compare providers for
              <br />
              the data your app needs.
            </h2>
            <p>
              Start with Bitcoin prices or weather data. Compare providers in
              each market, set your requirements, and see which one gets the
              next request.
            </p>
          </div>
          <div className={styles.marketsGrid}>
            <article className={styles.marketColumn}>
              <BitcoinMarketVisual />
              <div className={styles.marketCopy}>
                <h3>Bitcoin price</h3>
                <p>
                  Compare price feeds by request cost, response time, and data
                  age.
                </p>
                <Link href="/markets/btc-usd" className={styles.inlineLink}>
                  Explore Bitcoin price{" "}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </article>
            <article className={styles.marketColumn}>
              <WeatherMarketVisual />
              <div className={styles.marketCopy}>
                <h3>Weather</h3>
                <p>
                  Compare weather providers by request cost, response time, and
                  update freshness.
                </p>
                <Link href="/markets/sf-weather" className={styles.inlineLink}>
                  Explore weather <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section
          id="how-it-works"
          className={`${styles.container} ${styles.section}`}
          aria-labelledby="requirements-title"
        >
          <div className={styles.sectionIntro}>
            <h2 id="requirements-title">
              Choose what your API
              <br />
              providers compete on.
            </h2>
            <p>
              Set limits for price, response time, data age, and request
              success. Tender filters out providers that miss your requirements,
              then chooses among the remaining options.
            </p>
          </div>
          <RequirementsExplorer />
        </section>

        <section
          id="switch-providers"
          className={styles.switchSection}
          aria-labelledby="switch-title"
        >
          <div className={`${styles.container} ${styles.section}`}>
            <div className={styles.sectionIntro}>
              <h2 id="switch-title">
                Switch API providers
                <br />
                when performance drops.
              </h2>
              <p>
                When a provider becomes too slow, returns stale data, or stops
                responding, Tender checks the alternatives and switches to one
                that still meets your requirements.
              </p>
            </div>
            <FailoverScene />
          </div>
        </section>

        <section
          id="better-prices"
          className={`${styles.container} ${styles.section}`}
          aria-labelledby="price-title"
        >
          <div className={styles.sectionIntro}>
            <h2 id="price-title">
              Pay less for API calls
              <br />
              that meet your requirements.
            </h2>
            <p>
              A lower price only wins when the provider meets your requirements.
              With price-based routing, Tender selects the lowest-priced
              eligible provider and reevaluates as prices change.
            </p>
          </div>
          <PriceScene />
          <p className={styles.priceSupport}>
            Providers that are too slow, too stale, or unreliable remain
            excluded.
          </p>
        </section>

        <section
          id="marketplace"
          className={`${styles.container} ${styles.section} ${styles.futureSection}`}
          aria-labelledby="future-title"
        >
          <div>
            <h2 id="future-title">
              Let API providers
              <br />
              bid for your traffic.
            </h2>
            <p className={styles.futureBody}>
              We’re building toward a market where API providers publish offers
              and compete to serve application demand. Apps state what they
              need. Providers win traffic by offering better prices and meeting
              those requirements.
            </p>
            <p className={styles.futureNote}>
              Today’s demo shows provider comparison and routing.
              Provider-submitted bids are the next stage of the marketplace.
            </p>
          </div>
          <figure className={styles.futureDiagram}>
            <div className={styles.futureRequirements}>
              <Layers3 size={20} strokeWidth={1.5} aria-hidden="true" />
              <span>Application requirements</span>
              <span className={styles.requirementsPips}>
                Price · Speed · Freshness · Reliability
              </span>
            </div>
            <div className={styles.conceptConnector} aria-hidden="true">
              <ArrowDown size={17} />
            </div>
            <div className={styles.futureOffers}>
              <div>
                Provider A<span>Offer</span>
              </div>
              <div className={styles.selectedOffer}>
                Provider B<span>Offer</span>
              </div>
              <div>
                Provider C<span>Offer</span>
              </div>
            </div>
            <div className={styles.conceptConnector} aria-hidden="true">
              <ArrowDown size={17} />
            </div>
            <div className={styles.futureSelected}>
              <Check size={17} aria-hidden="true" />
              <span>Selected provider</span>
              <strong>Provider B</strong>
            </div>
            <figcaption>Proposed marketplace flow</figcaption>
          </figure>
        </section>

        <section
          className={`${styles.container} ${styles.closing}`}
          aria-labelledby="closing-title"
        >
          <h2 id="closing-title">
            Find a better provider
            <br />
            for your next request.
          </h2>
          <p>
            Choose Bitcoin price or weather, set your requirements, and try
            Tender’s routing demo.
          </p>
          <Link href={DEMO_HREF} className={styles.primaryButton}>
            Explore the demo <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
