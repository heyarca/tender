"use client";

import { useId, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
import { ChevronRight } from "lucide-react";
import { MarketSwitcher } from "@/components/market/page/market-header";
import type { PolicyField } from "@/components/market/policy/policy-helpers";
import { RoutingPolicySection } from "@/components/market/policy/routing-policy-section";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { type MarketId } from "@/lib/tender";

/** A short, representative set for this illustration — the live switcher has many more markets. */
const LANDING_DEMO_MARKET_IDS: readonly MarketId[] = ["btc-usd", "sf-weather", "eth-usd", "sz-mlcc"];
import { useMarketView, usePendingSwitch } from "@/lib/tender/client";
import { useLandingMarket } from "./LandingProductProviders";
import { SectionHeader } from "./SectionHeader";
import { landingStyles as styles } from "./styles";

/** The four requirement modules, in the order of the product's policy form. */
export const REQUIREMENT_MODULES: readonly { field: PolicyField; title: string; body: string }[] = [
  {
    field: "maxPrice",
    title: "Pay within your budget.",
    body: "Set a maximum price per request. Providers above your limit stay out of consideration.",
  },
  {
    field: "maxP95LatencyMs",
    title: "Keep responses fast.",
    body: "Set a latency limit so a lower price does not come with responses that are too slow for your app.",
  },
  {
    field: "maxDataAgeMs",
    title: "Keep data fresh.",
    body: "Set a maximum data age. A fast response still has to contain information recent enough for your app.",
  },
  {
    field: "minSuccessRate",
    title: "Avoid unreliable providers.",
    body: "Set a minimum request-success rate and exclude providers that fall below it.",
  },
];

/** Id of the policy form's number input for a requirement (set by the product's SpecField). */
export function policyInputId(marketId: MarketId, field: PolicyField): string {
  return `policy-${marketId}-${field}`;
}

/** Requirement whose policy field holds `element`, if any. */
function fieldOf(element: Element): PolicyField | null {
  const input = element.closest('[data-slot="spec-field"]')?.querySelector<HTMLInputElement>('input[id^="policy-"]');
  if (!input) return null;
  return REQUIREMENT_MODULES.find(({ field }) => input.id.endsWith(`-${field}`))?.field ?? null;
}

/** Move keyboard focus into the real policy input, scrolling only when it is out of view. */
function focusPolicyInput(id: string) {
  const input = document.getElementById(id);
  if (!input) return;
  input.focus({ preventScroll: true });
  const rect = input.getBoundingClientRect();
  if (rect.top < 112 || rect.bottom > window.innerHeight - 32) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    input.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }
}

/** #how-it-works: requirement modules beside the product's routing policy form. */
export function RequirementsSection() {
  const [marketId, setMarketId] = useLandingMarket();
  const [active, setActive] = useState<PolicyField>("maxPrice");
  const baseId = useId();
  const triggerId = (field: PolicyField) => `${baseId}-${field}-trigger`;

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = REQUIREMENT_MODULES.length - 1;
    const next =
      event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    document.getElementById(triggerId(REQUIREMENT_MODULES[next].field))?.focus();
  };

  const onSetLimit = (event: MouseEvent<HTMLAnchorElement>, field: PolicyField) => {
    event.preventDefault();
    setActive(field);
    focusPolicyInput(policyInputId(marketId, field));
  };

  // Focusing a field in the form opens its module, so the explanation follows the form.
  const onPanelFocus = (event: FocusEvent<HTMLDivElement>) => {
    const field = event.target instanceof Element ? fieldOf(event.target) : null;
    if (field) setActive(field);
  };

  return (
    <section id="how-it-works" className={styles.section} aria-labelledby="requirements-title">
      <div className={styles.container}>
        <SectionHeader
          titleId="requirements-title"
          title={
            <>
              Choose what your API
              <br />
              providers compete on.
            </>
          }
          lead="Set limits for price, response time, data age, and request success. Tender filters out providers that miss your requirements, then chooses among the remaining options."
        />
        <div className={styles.reqLayout}>
          <div className={styles.reqAccordion}>
            {REQUIREMENT_MODULES.map(({ field, title, body }, index) => {
              const open = field === active;
              const bodyId = `${baseId}-${field}-body`;
              return (
                <div key={field} className={styles.reqItem} data-open={open || undefined}>
                  <h3 className={styles.reqItemHeading}>
                    <button
                      type="button"
                      id={triggerId(field)}
                      className={styles.reqTrigger}
                      aria-expanded={open}
                      aria-controls={bodyId}
                      onClick={() => setActive(field)}
                      onKeyDown={(event) => onTriggerKeyDown(event, index)}
                    >
                      {title}
                    </button>
                  </h3>
                  <div
                    id={bodyId}
                    role="region"
                    aria-labelledby={triggerId(field)}
                    className={styles.reqBody}
                    data-open={open || undefined}
                    inert={!open}
                  >
                    <div className={styles.reqBodyInner}>
                      <p className={styles.reqBodyText}>{body}</p>
                      <a
                        href={`#${policyInputId(marketId, field)}`}
                        className={styles.reqLimitLink}
                        onClick={(event) => onSetLimit(event, field)}
                      >
                        Set your limit
                        <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.reqPanel} data-requirement={active} onFocus={onPanelFocus}>
            <div className={`${styles.window} ${styles.reqWindow}`}>
              <div className={styles.reqWindowBar}>
                <MarketSwitcher marketId={marketId} onSwitchMarket={setMarketId} marketIds={LANDING_DEMO_MARKET_IDS} />
              </div>
              <div className={`${styles.productUi} ${styles.reqProduct}`}>
                <RoutingPolicySection marketId={marketId} />
              </div>
            </div>
            <RouteSummary marketId={marketId} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** One live line under the form: how many providers qualify and who serves the next request. */
export function RouteSummary({ marketId }: { marketId: MarketId }) {
  const view = useMarketView(marketId);
  const pending = usePendingSwitch(marketId);
  const total = view.providers.length;
  const count = view.qualifiedCount;
  const active = view.route.activeProvider;
  const pinned = view.route.mode.kind === "pinned";

  const qualify = count === 0 ? "No provider qualifies." : `${count} of ${total} providers ${count === 1 ? "qualifies" : "qualify"}.`;
  let next: string;
  if (pending) next = `Switching to ${pending.providerName} in ${pending.secondsRemaining} s.`;
  else if (!active) next = "Requests wait until a provider meets your requirements.";
  else if (pinned) next = `Requests stay pinned to ${active.name}.`;
  else next = `${active.name} serves the next request.`;

  const tone = !active ? "negative" : view.decision.kind === "pinned-failing" ? "warning" : "positive";
  const logo = pending ? view.providersById[pending.providerId] : active;

  return (
    <p className={styles.reqSummary} data-tone={tone}>
      <span className={styles.reqSummaryDot} aria-hidden="true" />
      <span>{qualify}</span>
      <span className={styles.reqSummaryNext}>
        {logo ? <ProviderLogo src={logo.logo} name={logo.name} size={20} /> : null}
        {next}
      </span>
    </p>
  );
}
