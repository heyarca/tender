"use client";

import { Check, RotateCcw } from "lucide-react";
import { ProviderLogo } from "@/components/ui/provider-logo";
import {
  format,
  SWITCH_COOLDOWN_MS,
  type ActivityEntry,
  type MarketView,
  type ProviderId,
  type ProviderRow,
  type QualificationStatus,
} from "@/lib/tender";
import { useMarketView, useNow, usePendingSwitch, useTenderActions } from "@/lib/tender/client";
import { Button } from "./LandingButton";
import { SectionHeader } from "./SectionHeader";
import { landingStyles as styles } from "./styles";

const MARKET = "btc-usd";

/** The two bids the section walks through, in order. */
export const PRICE_STEPS: readonly { providerId: ProviderId; bid: number; label: string }[] = [
  { providerId: "inference-net", bid: 0.65, label: "inference.net bids $0.65" },
  { providerId: "parasail", bid: 0.6, label: "Parasail counters at $0.60" },
];

const sameBid = (bid: number | undefined, target: number) => bid !== undefined && Math.abs(bid - target) < 1e-9;

/** Which steps the store already reflects (derived from the live bids, never kept separately). */
export function priceStepsDone(view: MarketView): boolean[] {
  return PRICE_STEPS.map((step) => sameBid(view.providersById[step.providerId]?.conditions.bidPrice, step.bid));
}

/** Providers excluded by a check other than price, cheapest first. */
export function stillExcluded(view: MarketView, limit = 3): ProviderRow[] {
  return view.providers
    .filter((row) => row.status !== "eligible" && row.status !== "over-budget")
    .sort((a, b) => a.conditions.bidPrice - b.conditions.bidPrice)
    .slice(0, limit);
}

const ROUTE_KINDS: ReadonlySet<ActivityEntry["kind"]> = new Set(["route-established", "route-switch", "no-eligible"]);

const STATUS_TONE: Record<QualificationStatus, "warning" | "negative" | "neutral"> = {
  eligible: "neutral",
  "over-budget": "warning",
  "too-slow": "warning",
  "stale-data": "warning",
  unreliable: "negative",
  unavailable: "negative",
};

function PriceStat({ label, row }: { label: string; row: ProviderRow | null }) {
  const bid = row?.conditions.bidPrice ?? null;
  return (
    <div className={styles.priceStat}>
      <dt className={styles.priceStatLabel}>{label}</dt>
      <dd className={styles.priceStatValue}>
        <span key={bid ?? "none"} className={styles.priceNumber}>
          {bid !== null ? format.price(bid) : "–"}
        </span>
        {bid !== null ? <span className={styles.priceUnit}>/M req</span> : null}
      </dd>
      <dd className={styles.priceStatProvider}>
        {row ? (
          <>
            <ProviderLogo src={row.logo} name={row.name} size={24} />
            <span key={row.id} className={styles.priceProviderName}>
              {row.name}
            </span>
          </>
        ) : (
          <span>No eligible provider</span>
        )}
      </dd>
    </div>
  );
}

/** The newest route event, or the cooldown countdown with its progress while a switch waits. */
function PriceStatus({ view }: { view: MarketView }) {
  const pending = usePendingSwitch(MARKET);
  const now = useNow();
  if (pending) {
    const progress = Math.min(1, Math.max(0, 1 - (pending.executeAt - now) / SWITCH_COOLDOWN_MS));
    return (
      <div className={styles.priceStatus} data-state="pending">
        <p className={styles.priceStatusTitle}>{pending.label}</p>
        <div
          className={styles.priceProgress}
          role="progressbar"
          aria-label="Switch cooldown"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span className={styles.priceProgressFill} style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    );
  }
  const event = view.activity.find((entry) => ROUTE_KINDS.has(entry.kind));
  return (
    <div className={styles.priceStatus}>
      <p className={styles.priceStatusTitle}>{event ? event.title : view.decision.title}</p>
      {event ? <p className={styles.priceStatusMeta}>{format.relativeTime(event.at, now)}</p> : null}
    </div>
  );
}

/**
 * Better prices (Bitcoin): the real active bid against the best eligible offer, two bids applied
 * to the shared store (an immediate switch, then one that waits for the real switch cooldown), and
 * the cheaper offers that stay excluded.
 */
export function PriceSection() {
  const view = useMarketView(MARKET);
  const actions = useTenderActions();
  const done = priceStepsDone(view);
  const next = done.findIndex((isDone, index) => !isDone && done.slice(0, index).every(Boolean));
  const active = view.route.activeProvider;
  const excluded = stillExcluded(view);

  return (
    <section id="better-prices" className={styles.section} aria-labelledby="price-title">
      <div className={styles.container}>
        <SectionHeader
          titleId="price-title"
          title={
            <>
              Pay less for API calls
              <br />
              that meet your requirements.
            </>
          }
          lead="A lower price only wins when the provider meets your requirements. With price-based routing, Tender selects the lowest-priced eligible provider and reevaluates as prices change."
        />

        <div className={styles.priceGrid}>
          <dl className={styles.priceStats}>
            <PriceStat label="Current price" row={active} />
            <PriceStat label="Best eligible offer" row={view.bestPrice} />
          </dl>

          <div className={styles.priceControls}>
            <ol className={styles.priceSteps} aria-label="Change Bitcoin price bids">
              {PRICE_STEPS.map((step, index) => {
                const isDone = done[index];
                const isNext = index === next;
                return (
                  <li key={step.providerId} className={styles.priceStep} data-state={isDone ? "done" : isNext ? "next" : "waiting"}>
                    <Button
                      variant={isNext ? "primary" : "secondary"}
                      size="lg"
                      icon={
                        isDone ? (
                          <Check />
                        ) : (
                          <span className={styles.priceStepNumber}>{index + 1}</span>
                        )
                      }
                      iconPosition="start"
                      disabled={!isNext}
                      className={styles.priceStepButton}
                      onClick={() => actions.updateProvider(MARKET, step.providerId, { bidPrice: step.bid })}
                    >
                      {step.label}
                    </Button>
                  </li>
                );
              })}
            </ol>
            <PriceStatus view={view} />
            <Button
              variant="secondary"
              size="lg"
              icon={<RotateCcw />}
              iconPosition="start"
              disabled={!view.conditionsModified}
              className={styles.priceReset}
              onClick={() => actions.resetConditions(MARKET)}
            >
              Reset
            </Button>
          </div>
        </div>

        <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {active ? `Current price ${format.price(active.conditions.bidPrice)} per million requests from ${active.name}.` : "No eligible provider."}{" "}
          {view.decision.title}.
        </p>

        <div className={styles.priceExcluded}>
          <p className={styles.priceExcludedLead}>Providers that are too slow, too stale, or unreliable remain excluded.</p>
          <ul className={styles.priceOffers}>
            {excluded.map((row) => (
              <li key={row.id} className={styles.priceOffer}>
                <span className={styles.priceOfferName}>
                  <ProviderLogo src={row.logo} name={row.name} size={24} />
                  {row.name}
                </span>
                <span className={styles.priceOfferPrice}>
                  {format.price(row.conditions.bidPrice)}
                  <span className={styles.priceOfferUnit}>/M req</span>
                </span>
                <span className={styles.priceOfferStatus}>
                  <span className={styles.priceBadge} data-tone={STATUS_TONE[row.status]}>
                    {row.statusLabel}
                  </span>
                  {row.evaluation.reasons[0] ? (
                    <span className={styles.priceOfferReason}>{row.evaluation.reasons[0].message}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
