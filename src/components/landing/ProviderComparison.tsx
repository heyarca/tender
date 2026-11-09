import { ArrowLeftRight, Bitcoin, Check } from "lucide-react";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { format, type ActivityEntry, type CheckId, type MarketView, type ProviderRow } from "@/lib/tender";
import { landingStyles as styles } from "./styles";

/** Status pill: Active is a lime fill; excluded providers use amber text. */
export function ProviderState({ row }: { row: ProviderRow }) {
  const tone = row.isActive ? "active" : row.evaluation.qualifies ? "eligible" : "excluded";
  return (
    <span className={styles.heroState} data-tone={tone}>
      {row.isActive ? <Check size={15} strokeWidth={2.25} aria-hidden="true" /> : null}
      {row.isActive ? "Active" : row.statusLabel}
    </span>
  );
}

function failed(row: ProviderRow, check: CheckId): boolean {
  return row.evaluation.checks.some((result) => result.check === check && !result.passed);
}

function Limits({ view }: { view: MarketView }) {
  const { policy } = view;
  const limits = [
    { label: "Max price", value: format.price(policy.maxPrice), unit: "/M req" },
    { label: "Max P95", value: format.latency(policy.maxP95LatencyMs) },
    { label: "Max data age", value: format.dataAge(policy.maxDataAgeMs) },
    { label: "Min success", value: format.percent(policy.minSuccessRate) },
  ];
  return (
    <dl className={styles.heroLimits} aria-label="Your requirements">
      {limits.map((limit) => (
        <div key={limit.label} className={styles.heroLimit}>
          <dt>{limit.label}</dt>
          <dd>
            {limit.value}
            {limit.unit ? <span className={styles.heroUnit}> {limit.unit}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The hero's routing card: market, the policy limits, and four provider rows,
 * all read from a product engine view (see ./demo-model).
 */
export function RoutingCard({ view, ids }: { view: MarketView; ids: readonly string[] }) {
  const rows = ids.map((id) => view.providersById[id]).filter((row): row is ProviderRow => Boolean(row));
  return (
    <div className={styles.heroCard}>
      <div className={styles.heroCardHead}>
        <span className={styles.heroMarketIcon} aria-hidden="true">
          <Bitcoin size={18} strokeWidth={1.75} />
        </span>
        <div className={styles.heroCardHeading}>
          <p className={styles.heroCardTitle}>Bitcoin price</p>
          <p className={styles.heroCardRoute}>{view.decision.title}</p>
        </div>
      </div>
      <Limits view={view} />
      <div className={styles.heroTable} role="table" aria-label="Bitcoin price providers">
        <div role="rowgroup" className={styles.heroTableHead}>
          <div role="row" className={styles.heroRow}>
            <span role="columnheader" className={styles.heroCellName}>Provider</span>
            <span role="columnheader" className={styles.heroCellPrice}>Price</span>
            <span role="columnheader" className={styles.heroCellLatency}>P95</span>
            <span role="columnheader" className={styles.heroCellState}>Status</span>
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((row) => (
            <div key={row.id} role="row" className={styles.heroRow} data-active={row.isActive || undefined}>
              <span role="cell" className={styles.heroCellName}>
                <ProviderLogo src={row.logo} name={row.name} size={24} />
                <span className={styles.heroProviderName}>{row.name}</span>
              </span>
              <span role="cell" className={styles.heroCellPrice} data-failed={failed(row, "price") || undefined}>
                {format.price(row.conditions.bidPrice)}
                <span className={styles.heroUnit}> /M req</span>
              </span>
              <span role="cell" className={styles.heroCellLatency} data-failed={failed(row, "latency") || undefined}>
                <span className={styles.heroMobileLabel}>P95 </span>
                {format.latency(row.conditions.p95LatencyMs)}
              </span>
              <span role="cell" className={styles.heroCellState}>
                <ProviderState row={row} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The route-switch entry the engine wrote, and the check that triggered it. */
export function routeSwitchOf(view: MarketView): { title: string; trigger: string } | null {
  const entry = view.activity.find((item): item is Extract<ActivityEntry, { kind: "route-switch" }> => item.kind === "route-switch");
  if (!entry) return null;
  const from = entry.fromProviderId ? view.providersById[entry.fromProviderId] : undefined;
  const trigger = from?.evaluation.reasons.map((reason) => reason.message).join("; ") ?? "";
  return { title: entry.title, trigger };
}

/** Route event toast. The live region stays mounted so the switch is announced. */
export function RouteToast({ event }: { event: { title: string; trigger: string } | null }) {
  return (
    <div className={styles.heroToastRegion} role="status" aria-live="polite">
      {event ? (
        <div className={styles.heroToast}>
          <span className={styles.heroToastIcon} aria-hidden="true">
            <ArrowLeftRight size={18} strokeWidth={2} />
          </span>
          <span className={styles.heroToastText}>
            <span className={styles.heroToastTitle}>{event.title}</span>
            {event.trigger ? <span className={styles.heroToastDetail}>{event.trigger}</span> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
