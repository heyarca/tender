"use client";

import { useEffect, useReducer, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  RotateCcw,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import {
  demoReducer,
  initialDemoState,
  type Metric,
  type Policy,
} from "./demo-model";
import { ProviderComparison, ProviderStatus } from "./ProviderComparison";
import { BitcoinChart } from "./MarketVisuals";
import { DEMO_HREF } from "./LandingChrome";
import { landingStyles as styles } from "./styles";

export function useLandingDemo() {
  const [state, dispatch] = useReducer(
    demoReducer,
    undefined,
    initialDemoState,
  );
  useEffect(() => {
    if (!state.pendingId) return;
    // Start with the user's action, so the ten-second scene never loses a partial second.
    const interval = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(interval);
  }, [state.pendingId]);
  return [state, dispatch] as const;
}

export function PolicySummary({ policy }: { policy: Policy }) {
  return (
    <dl className={styles.policySummary}>
      <div>
        <dt>Maximum price</dt>
        <dd>
          ${policy.maxPrice.toFixed(2)} <span>/ 1K requests</span>
        </dd>
      </div>
      <div>
        <dt>P95 latency limit</dt>
        <dd>
          {policy.maxLatency} <span>ms</span>
        </dd>
      </div>
      <div>
        <dt>Maximum data age</dt>
        <dd>
          {policy.maxDataAge / 1000} <span>s</span>
        </dd>
      </div>
      <div>
        <dt>Minimum request success</dt>
        <dd>
          {policy.minSuccess}
          <span>%</span>
        </dd>
      </div>
    </dl>
  );
}

export function HeroSelection() {
  const [state, dispatch] = useReducer(
    demoReducer,
    undefined,
    initialDemoState,
  );
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => dispatch({ type: "latency" }), 3500);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div
      className={styles.heroVisual}
      aria-label="Simulated Bitcoin price request and four competing API providers"
    >
      <div className={styles.diagramGrid} aria-hidden="true" />
      <div className={styles.requestNode}>
        <span className={styles.requestIcon}>
          <Zap size={19} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <div>
          <span>Request</span>
          <strong>Bitcoin price</strong>
        </div>
        <span className={styles.nodeDot} aria-hidden="true" />
      </div>
      <div className={styles.heroRequirements}>
        <span>
          Maximum price <strong>$0.50 / 1K</strong>
        </span>
        <span>
          P95 latency limit <strong>100 ms</strong>
        </span>
        <span>
          Data age limit <strong>2 s</strong>
        </span>
      </div>
      <div className={styles.singleConnection} aria-hidden="true">
        <span />
        <ArrowDown size={14} />
      </div>
      <div className={styles.heroProviders}>
        <div className={styles.heroTableHeading}>
          <span>Provider</span>
          <span>Price / 1K</span>
          <span>P95</span>
          <span>State</span>
        </div>
        {state.providers.map((provider) => (
          <div
            key={provider.id}
            className={styles.heroProviderRow}
            data-active={state.activeId === provider.id}
          >
            <span className={styles.providerIdentity}>
              <span className={styles.providerGlyph} aria-hidden="true">
                {provider.id.toUpperCase()}
              </span>
              {provider.name}
            </span>
            <span>${provider.price.toFixed(2)}</span>
            <span>{provider.latency} ms</span>
            <ProviderStatus
              provider={provider}
              policy={state.policy}
              activeId={state.activeId}
            />
          </div>
        ))}
      </div>
      <div className={styles.selectionNote}>
        <span className={styles.selectionDot} aria-hidden="true" />
        <span>Lowest price among eligible providers</span>
        <button
          type="button"
          aria-label={
            state.activeId === "a"
              ? "Simulate provider slowdown"
              : "Reset provider selection"
          }
          title={
            state.activeId === "a"
              ? "Simulate provider slowdown"
              : "Reset provider selection"
          }
          onClick={() => {
            dispatch({ type: state.activeId === "a" ? "latency" : "reset" });
          }}
        >
          <RotateCcw size={13} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.heroEvent} aria-live="polite">
        {state.activeId === "b"
          ? "A exceeds 100 ms. The next request goes to B."
          : "Provider A meets your requirements at the best price."}
      </p>
    </div>
  );
}

const requirements: {
  id: Metric;
  title: string;
  body: string;
  note: string;
}[] = [
  {
    id: "price",
    title: "Pay within your budget.",
    body: "Set a maximum price per request. Providers above your limit stay out of consideration.",
    note: "Maximum price: $0.50 / 1K requests",
  },
  {
    id: "latency",
    title: "Keep responses fast.",
    body: "Set a latency limit so a lower price does not come with responses that are too slow for your app.",
    note: "P95 latency limit: 100 ms",
  },
  {
    id: "freshness",
    title: "Keep data fresh.",
    body: "Set a maximum data age. A fast response still has to contain information recent enough for your app.",
    note: "Maximum data age: 2 seconds",
  },
  {
    id: "success",
    title: "Avoid unreliable providers.",
    body: "Set a minimum request-success rate and exclude providers that fall below it.",
    note: "Minimum request success: 99.5%",
  },
];

function RequirementPanel({ metric }: { metric: Metric }) {
  const state = initialDemoState();
  return (
    <div className={styles.requirementPanel}>
      <div className={styles.panelHeader}>
        <span>
          <SlidersHorizontal size={15} aria-hidden="true" /> Bitcoin price
        </span>
        <span>Simulated market</span>
      </div>
      <div className={styles.requirementLimit}>
        <span>{requirements.find((item) => item.id === metric)?.note}</span>
        <Check size={16} aria-hidden="true" />
      </div>
      <ProviderComparison {...state} emphasis={metric} />
      <p className={styles.panelFootnote}>
        Four requirements. One selected provider.
      </p>
    </div>
  );
}

export function RequirementsExplorer() {
  const [selected, setSelected] = useState<Metric>("price");
  return (
    <div className={styles.requirementsLayout}>
      <div>
        {requirements.map((item) => (
          <div
            className={styles.requirementItem}
            key={item.id}
            data-open={selected === item.id}
          >
            <h3>
              <button
                type="button"
                id={`requirement-${item.id}`}
                aria-expanded={selected === item.id}
                aria-controls={`explanation-${item.id}`}
                onClick={() => setSelected(item.id)}
              >
                {item.title}
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            </h3>
            <div
              id={`explanation-${item.id}`}
              role="region"
              aria-labelledby={`requirement-${item.id}`}
              hidden={selected !== item.id}
            >
              <p>{item.body}</p>
              {selected === item.id && (
                <div className={styles.mobileRequirementPanel}>
                  <RequirementPanel metric={selected} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.desktopRequirementPanel}>
        <RequirementPanel metric={selected} />
      </div>
    </div>
  );
}

export function FailoverScene() {
  const [state, dispatch] = useLandingDemo();
  const [metric, setMetric] = useState<Metric>("latency");
  return (
    <div data-story="failover">
      <div className={styles.sceneToolbar}>
        <div className={styles.sceneControls}>
          <button
            type="button"
            className={styles.controlButton}
            aria-pressed={state.providers[0].latency > 100}
            onClick={() => {
              dispatch({ type: "reset" });
              dispatch({ type: "latency" });
              setMetric("latency");
            }}
          >
            <Zap size={14} aria-hidden="true" /> Raise latency
          </button>
          <button
            type="button"
            className={styles.controlButton}
            aria-pressed={state.providers[0].dataAge > 2000}
            onClick={() => {
              dispatch({ type: "reset" });
              dispatch({ type: "stale" });
              setMetric("freshness");
            }}
          >
            <Clock3 size={14} aria-hidden="true" /> Make data stale
          </button>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => {
              dispatch({ type: "reset" });
              setMetric("latency");
            }}
          >
            <RotateCcw size={14} aria-hidden="true" /> Reset
          </button>
        </div>
        <span>Try a change. Watch the next route.</span>
      </div>
      <div className={styles.appWindow}>
        <div className={styles.windowHeader}>
          <span>
            <span className={styles.smallWordmark}>Tender</span>
            <span className={styles.slash}>/</span>Bitcoin price
          </span>
          <span>
            <span className={styles.quietDot} /> Simulated market
          </span>
        </div>
        <div className={styles.appWindowBody}>
          <PolicySummary policy={state.policy} />
          <div className={styles.tableTitle}>
            <h3>Available providers</h3>
            <span>Selection: lowest eligible price</span>
          </div>
          <ProviderComparison {...state} emphasis={metric} />
          <div className={styles.routeResult}>
            <div
              className={styles.routeEvent}
              aria-live="polite"
              aria-atomic="true"
            >
              <span className={styles.routeIcon}>
                <ArrowRight size={20} aria-hidden="true" />
              </span>
              <div>
                <strong>
                  {state.activeId
                    ? `Next request → Provider ${state.activeId.toUpperCase()}`
                    : "No eligible provider"}
                </strong>
                <p>{state.event}</p>
              </div>
            </div>
            <div className={styles.requestPreview}>
              <div>
                <span>Sample BTC / USD result</span>
                <strong>$75,230.75</strong>
              </div>
              <BitcoinChart compact />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.sceneCaption}>
        <p>
          Simulated provider conditions. Changes affect subsequent requests.
        </p>
        <Link href={DEMO_HREF}>
          Open the full demo <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export function PriceScene() {
  const [state, dispatch] = useLandingDemo();
  const changed = state.providers[1].price === 0.34;
  return (
    <div data-story="price">
      <div className={styles.priceComparison}>
        <div>
          <span className={styles.priceLabel}>Current provider price</span>
          <div className={styles.largePrice}>
            ${state.activeId === "b" ? "0.34" : "0.40"}
            <span>/ 1K requests</span>
          </div>
          <span className={styles.priceQualification}>
            <Check size={14} aria-hidden="true" /> Provider{" "}
            {state.activeId === "b" ? "B" : "A"} · Meets all requirements
          </span>
        </div>
        <ArrowRight
          className={styles.priceArrow}
          size={28}
          strokeWidth={1.2}
          aria-hidden="true"
        />
        <div>
          <span className={styles.priceLabel}>
            {state.activeId === "b"
              ? "Selected eligible option"
              : changed
                ? "Lower-priced eligible option"
                : "Eligible alternative"}
          </span>
          <div
            className={`${styles.largePrice} ${changed ? styles.bluePrice : ""}`}
          >
            ${changed ? "0.34" : "0.46"}
            <span>/ 1K requests</span>
          </div>
          <span className={styles.priceQualification}>
            <Check size={14} aria-hidden="true" /> Provider B ·{" "}
            {changed
              ? "Meets all requirements"
              : "Eligible, but currently costs more"}
          </span>
        </div>
      </div>
      <div className={styles.priceSceneActions}>
        <button
          type="button"
          className={styles.controlButton}
          disabled={changed}
          onClick={() => dispatch({ type: "lower-price" })}
        >
          <ArrowDown size={15} aria-hidden="true" /> Lower a provider’s price
        </button>
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => dispatch({ type: "reset" })}
        >
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </button>
        <div className={styles.cooldownStatus} role="status">
          {state.pendingId ? (
            <>
              <Clock3 size={15} aria-hidden="true" />
              <span>Switching after the optimization cooldown.</span>
              <strong>{state.cooldown} s</strong>
            </>
          ) : state.activeId === "b" ? (
            <>
              <Check size={15} aria-hidden="true" /> Provider B now receives the
              next request.
            </>
          ) : (
            <span>
              Lower B’s price to see how competition changes the route.
            </span>
          )}
        </div>
      </div>
      <div className={styles.excludedPrices}>
        <span>Still excluded</span>
        <span>
          <strong>Provider C</strong> $0.28{" "}
          <span className={styles.warningText}>Too slow</span>
        </span>
        <span>
          <strong>Provider D</strong> $0.22{" "}
          <span className={styles.warningText}>Stale data</span>
        </span>
      </div>
      <p className={styles.finePrint}>
        Illustrative unit prices only. Not a claim about real savings or total
        bills.
      </p>
    </div>
  );
}
