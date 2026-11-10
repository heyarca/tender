import { Check } from "lucide-react";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { evaluateMarket, format, getDefaultPolicy, getProviderFixture, type ProviderFixture } from "@/lib/tender";
import { landingStyles as styles } from "./styles";

const MARKET_ID = "btc-usd";
/** Three Bitcoin price providers from the product fixtures, shown as offers. */
const OFFER_IDS = ["arca-labs", "bramblecore", "quarrystone"] as const;

export interface MarketplaceOffer {
  id: string;
  name: string;
  logo: string;
  bid: number;
}

export interface MarketplaceScene {
  requirements: { label: string; value: string }[];
  offers: MarketplaceOffer[];
  selected: MarketplaceOffer;
}

/**
 * Builds the figure from the real engine: the Bitcoin market's default
 * requirements, three fixture bids, and the offer the evaluator ranks first.
 */
export function buildMarketplaceScene(): MarketplaceScene {
  const policy = getDefaultPolicy(MARKET_ID);
  const fixtures = OFFER_IDS.map((id) => getProviderFixture(MARKET_ID, id)).filter(
    (fixture): fixture is ProviderFixture => fixture !== undefined,
  );
  const evaluation = evaluateMarket(
    fixtures.map(({ id, name, defaults }) => ({ id, name, conditions: defaults })),
    policy,
  );
  const offers = fixtures.map(({ id, name, logo, defaults }) => ({ id, name, logo, bid: defaults.bidPrice }));
  const selected = offers.find((offer) => offer.id === evaluation.recommendedId) ?? offers[0];
  return {
    requirements: [
      { label: "Price", value: `≤ ${format.priceWithUnit(policy.maxPrice)}` },
      { label: "Speed", value: `≤ ${format.latency(policy.maxP95LatencyMs)}` },
      { label: "Freshness", value: `≤ ${format.dataAge(policy.maxDataAgeMs)}` },
      { label: "Reliability", value: `≥ ${format.percent(policy.minSuccessRate, 1)}` },
    ],
    offers,
    selected,
  };
}

function Bid({ value }: { value: number }) {
  return (
    <span className={styles.marketplaceBid}>
      {format.price(value)}
      <span className={styles.marketplaceUnit}> {format.priceUnit}</span>
    </span>
  );
}

/** Offer rows are 52px tall with 12px gaps, so their centers sit at 14.4%, 50%, and 85.6%. */
const LANE_Y = [14.44, 50, 85.56];

function MarketplaceFigure({ scene }: { scene: MarketplaceScene }) {
  const { requirements, offers, selected } = scene;
  // One lane per offer row, converging on the selected offer; the selected lane is drawn last, on top.
  const lanes = offers
    .map((offer, index) => {
      const y = LANE_Y[index] ?? 50;
      return { id: offer.id, selected: offer.id === selected.id, d: `M0 ${y} C46 ${y} 38 50 78 50 L100 50` };
    })
    .sort((a, b) => Number(a.selected) - Number(b.selected));
  return (
    <div className={`${styles.mediaFrame} ${styles.marketplaceMedia}`}>
      <picture>
        <source srcSet="/landing/bids-lanes.avif" type="image/avif" />
        <img
          className={styles.mediaFill}
          src="/landing/bids-lanes.jpg"
          alt=""
          width={1600}
          height={1200}
          loading="lazy"
          decoding="async"
        />
      </picture>
      <div className={styles.marketplaceShade} aria-hidden="true" />
      <div className={styles.marketplaceOverlay}>
        <div className={styles.marketplaceAsk}>
          <p className={styles.marketplaceAskTitle}>Your requirements</p>
          <dl className={styles.marketplaceAskList}>
            {requirements.map((item) => (
              <div key={item.label} className={styles.marketplaceAskItem}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className={styles.marketplaceBook}>
          <ul className={styles.marketplaceOffers} aria-label="Provider offers">
            {offers.map((offer) => (
              <li key={offer.id} className={styles.marketplaceOffer} data-selected={offer.id === selected.id || undefined}>
                <ProviderLogo src={offer.logo} name={offer.name} size={24} />
                <span className={styles.marketplaceOfferName}>{offer.name}</span>
                <Bid value={offer.bid} />
              </li>
            ))}
          </ul>
          <svg className={styles.marketplaceLanes} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {lanes.map((lane) => (
              <g key={lane.id} className={lane.selected ? styles.marketplaceLaneSelected : styles.marketplaceLane}>
                <path className={styles.marketplaceLaneCasing} d={lane.d} vectorEffect="non-scaling-stroke" />
                <path d={lane.d} vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </svg>
          <span className={styles.marketplaceJoin} aria-hidden="true" />
          <p className={styles.marketplaceWinner}>
            <span className={styles.srOnly}>Selected offer: </span>
            <ProviderLogo src={selected.logo} name={selected.name} size={24} />
            <span className={styles.marketplaceWinnerText}>
              <span className={styles.marketplaceOfferName}>{selected.name}</span>
              <Bid value={selected.bid} />
            </span>
            <span className={styles.marketplaceWinnerMark} aria-hidden="true">
              <Check size={14} strokeWidth={2.5} />
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** #marketplace: where Tender is heading, told with real fixture bids. */
export function MarketplaceSection() {
  const scene = buildMarketplaceScene();
  return (
    <section id="marketplace" className={styles.section} aria-labelledby="marketplace-title">
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.marketplaceCard}`}>
          <div className={styles.marketplaceCopy}>
            <h2 id="marketplace-title" className={`${styles.sectionTitle} ${styles.marketplaceTitle}`}>
              <span>Let API providers</span> <span>bid for your traffic.</span>
            </h2>
            <p className={styles.marketplaceBody}>
              We’re building toward a market where API providers publish offers and compete to serve application
              demand. Apps state what they need. Providers win traffic by offering better prices and meeting those
              requirements.
            </p>
          </div>
          <MarketplaceFigure scene={scene} />
        </div>
      </div>
    </section>
  );
}
