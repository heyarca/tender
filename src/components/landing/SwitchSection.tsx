"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Clock, Gauge, RotateCcw } from "lucide-react";
import { ActivitySection } from "@/components/market/activity/activity-section";
import { ProviderConditionsSection } from "@/components/market/conditions/provider-conditions-section";
import { MarketSwitcher } from "@/components/market/page/market-header";
import { MarketOverview } from "@/components/market/page/market-overview";
import { ProvidersSection } from "@/components/market/providers/providers-section";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { fromDisplayValue, type ConditionsPatch, type MarketId, type MarketView, type NumericInputSpec } from "@/lib/tender";
import { useMarketView, usePendingSwitch, useTenderActions } from "@/lib/tender/client";
import { Button } from "./LandingButton";
import { useLandingMarket } from "./LandingProductProviders";
import { SectionHeader } from "./SectionHeader";
import { TenderWordmark } from "./TenderWordmark";
import { landingStyles as styles } from "./styles";

/** Twice the policy limit, kept inside the market's input range; `null` when that does not exceed the limit. */
function aboveLimit(spec: NumericInputSpec, limit: number): number | null {
  const target = Math.min(limit * 2, fromDisplayValue(spec, spec.max));
  return target > limit ? target : null;
}

/** Patch that puts the active provider's P95 latency above the policy limit, or `null` when there is nothing to raise. */
export function latencyBreach(view: MarketView): ConditionsPatch | null {
  const active = view.route.activeProvider;
  if (!active) return null;
  const target = aboveLimit(view.definition.conditionInputs.p95LatencyMs, view.policy.maxP95LatencyMs);
  return target !== null && target > active.conditions.p95LatencyMs ? { p95LatencyMs: target } : null;
}

/** Patch that makes the active provider's data older than the policy limit, or `null` when there is nothing to age. */
export function freshnessBreach(view: MarketView): ConditionsPatch | null {
  const active = view.route.activeProvider;
  if (!active) return null;
  const target = aboveLimit(view.definition.conditionInputs.dataAgeMs, view.policy.maxDataAgeMs);
  return target !== null && target > active.conditions.dataAgeMs ? { dataAgeMs: target } : null;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Night aerial of light trails behind the window. Decorative; hidden if the file fails to load. */
function NightPhoto() {
  const ref = useRef<HTMLImageElement>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth === 0) setMissing(true);
  }, []);
  return (
    <picture>
      <source srcSet="/landing/switch-night.avif" type="image/avif" />
      <img
        ref={ref}
        className={`${styles.mediaFill} ${styles.switchPhoto}`}
        src="/landing/switch-night.jpg"
        width={2400}
        height={1200}
        alt=""
        loading="lazy"
        decoding="async"
        data-missing={missing || undefined}
        onError={() => setMissing(true)}
      />
    </picture>
  );
}

/** Route status on the photo: the real active provider, or no route. */
function RouteStatus({ view }: { view: MarketView }) {
  const active = view.route.activeProvider;
  const pending = usePendingSwitch(view.id);
  return (
    <p className={styles.switchRoute} data-state={active ? "routing" : "none"}>
      <span className={styles.switchRouteDot} aria-hidden="true" />
      {active ? (
        <>
          <span className={styles.switchRouteText}>Routing to</span>
          <ProviderLogo src={active.logo} name={active.name} size={20} />
          <span className={styles.switchRouteName}>{active.name}</span>
          {pending ? (
            <span className={styles.switchRouteNext}>
              {pending.providerName} in {pending.secondsRemaining} s
            </span>
          ) : null}
        </>
      ) : (
        <span className={styles.switchRouteName}>No eligible provider</span>
      )}
    </p>
  );
}

/**
 * Switch providers: a night-traffic photo holding the real market UI in an app window. The
 * controls change the active provider's conditions in the shared Tender store, and the window
 * scrolls to the providers table so the failover is visible.
 */
export function SwitchSection() {
  const [marketId, setMarketId] = useLandingMarket();
  const view = useMarketView(marketId);
  const actions = useTenderActions();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  const latencyPatch = latencyBreach(view);
  const freshnessPatch = freshnessBreach(view);
  const activeId = view.route.activeProviderId;

  const updateFade = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setAtEnd(scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    updateFade();
    const observer = new ResizeObserver(updateFade);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [updateFade, marketId]);

  const showProviders = useCallback(() => {
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      const table = scroller?.querySelector<HTMLElement>("#providers");
      if (!scroller || !table) return;
      const top = table.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 16;
      scroller.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
  }, []);

  const apply = (patch: ConditionsPatch | null) => {
    if (!patch || !activeId) return;
    actions.updateProvider(marketId, activeId, patch);
    showProviders();
  };

  const reset = () => {
    actions.resetConditions(marketId);
    showProviders();
  };

  const switchMarket = (next: MarketId) => {
    setMarketId(next);
    scrollerRef.current?.scrollTo({ top: 0 });
  };

  return (
    <section id="switch-providers" className={styles.section} aria-labelledby="switch-title">
      <div className={styles.container}>
        <SectionHeader
          titleId="switch-title"
          title={
            <>
              Switch API providers
              <br />
              when performance drops.
            </>
          }
          lead="When a provider becomes too slow, returns stale data, or stops responding, Tender checks the alternatives and switches to one that still meets your requirements."
        />

        <div className={`${styles.mediaFrame} ${styles.switchStage}`}>
          <NightPhoto />
          <div className={styles.switchShade} aria-hidden="true" />

          <div className={styles.switchControls}>
            <RouteStatus view={view} />
            <div className={styles.switchActions} role="group" aria-label="Change the active provider">
              <Button
                variant="glass"
                size="lg"
                icon={<Gauge />}
                iconPosition="start"
                disabled={!latencyPatch}
                onClick={() => apply(latencyPatch)}
              >
                Raise latency
              </Button>
              <Button
                variant="glass"
                size="lg"
                icon={<Clock />}
                iconPosition="start"
                disabled={!freshnessPatch}
                onClick={() => apply(freshnessPatch)}
              >
                Make data stale
              </Button>
              <Button
                variant="glass"
                size="lg"
                icon={<RotateCcw />}
                iconPosition="start"
                disabled={!view.conditionsModified}
                onClick={reset}
              >
                Reset
              </Button>
            </div>
          </div>

          <div className={`${styles.window} ${styles.switchWindow}`}>
            <div className={styles.switchBar}>
              <div className={styles.switchBarTitle}>
                <TenderWordmark className={styles.switchBarLogo} />
                <span className={styles.switchBarSlash} aria-hidden="true">
                  /
                </span>
                <span className={styles.switchBarMarket}>{view.definition.name}</span>
              </div>
              <MarketSwitcher marketId={marketId} onSwitchMarket={switchMarket} />
            </div>
            <div ref={scrollerRef} className={styles.switchScroller} onScroll={updateFade}>
              <div className={`${styles.productUi} ${styles.switchProduct}`}>
                <MarketOverview key={marketId} view={view} />
                <ProvidersSection key={`providers-${marketId}`} marketId={marketId} />
                <ProviderConditionsSection key={`conditions-${marketId}`} marketId={marketId} />
                <ActivitySection key={`activity-${marketId}`} marketId={marketId} />
              </div>
            </div>
            <div className={styles.switchFade} data-hidden={atEnd || undefined} aria-hidden="true" />
          </div>
        </div>

        <Link href="/markets/btc-usd" className={styles.switchLink}>
          Open the Bitcoin market
          <ChevronRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
