import { Check, ChevronDown } from "lucide-react";
import {
  qualification,
  type Metric,
  type Policy,
  type Provider,
} from "./demo-model";
import { landingStyles as styles } from "./styles";

export function formatAge(ms: number) {
  return ms >= 1000 ? `${Number((ms / 1000).toFixed(2))} s` : `${ms} ms`;
}

export function ProviderStatus({
  provider,
  policy,
  activeId,
}: {
  provider: Provider;
  policy: Policy;
  activeId: Provider["id"] | null;
}) {
  const status = qualification(provider, policy);
  const active = provider.id === activeId && status === "Eligible";
  return (
    <span
      className={`${styles.status} ${active ? styles.activeStatus : status !== "Eligible" ? styles.warningStatus : ""}`}
    >
      {active ? (
        <Check size={12} aria-hidden="true" />
      ) : (
        <span className={styles.statusDot} />
      )}{" "}
      {active ? "Active" : status}
    </span>
  );
}

const metricLabel: Record<Metric, string> = {
  price: "Price / 1K",
  latency: "P95 latency",
  freshness: "Data age",
  success: "Request success",
};
function metricValue(provider: Provider, metric: Metric) {
  return {
    price: `$${provider.price.toFixed(2)}`,
    latency: `${provider.latency} ms`,
    freshness: formatAge(provider.dataAge),
    success: `${provider.success.toFixed(1)}%`,
  }[metric];
}

export function ProviderComparison({
  providers,
  policy,
  activeId,
  emphasis = "latency",
  label = "Provider comparison",
}: {
  providers: Provider[];
  policy: Policy;
  activeId: Provider["id"] | null;
  emphasis?: Metric;
  label?: string;
}) {
  const metrics: Metric[] = ["price", "latency", "freshness", "success"];
  return (
    <div className={styles.comparison}>
      <div className={styles.desktopTable}>
        <table className={styles.providerTable}>
          <caption className={styles.srOnly}>
            {label}. Prices in USD per 1,000 requests. All providers and metrics
            are simulated.
          </caption>
          <thead>
            <tr>
              <th scope="col">Provider</th>
              {metrics.map((metric) => (
                <th
                  key={metric}
                  scope="col"
                  data-emphasized={emphasis === metric}
                >
                  {metricLabel[metric]}
                </th>
              ))}
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr
                key={provider.id}
                data-active={provider.id === activeId}
                data-provider={provider.id}
              >
                <th scope="row">
                  <span className={styles.providerIdentity}>
                    <span className={styles.providerGlyph} aria-hidden="true">
                      {provider.id.toUpperCase()}
                    </span>
                    {provider.name}
                  </span>
                </th>
                {metrics.map((metric) => (
                  <td key={metric} data-emphasized={emphasis === metric}>
                    {metricValue(provider, metric)}
                  </td>
                ))}
                <td>
                  <ProviderStatus
                    provider={provider}
                    policy={policy}
                    activeId={activeId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.mobileProviders} aria-label={label}>
        <div className={styles.mobileTableHeading}>
          <span>Provider / state</span>
          <span>{metricLabel[emphasis]}</span>
        </div>
        {providers.map((provider) => (
          <details
            key={provider.id}
            data-active={provider.id === activeId}
            className={styles.mobileProvider}
          >
            <summary>
              <div>
                <span className={styles.providerIdentity}>
                  <span className={styles.providerGlyph} aria-hidden="true">
                    {provider.id.toUpperCase()}
                  </span>
                  {provider.name}
                </span>
                <ProviderStatus
                  provider={provider}
                  policy={policy}
                  activeId={activeId}
                />
              </div>
              <span>
                {metricValue(provider, emphasis)}
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </summary>
            <dl>
              {metrics.map((metric) => (
                <div key={metric}>
                  <dt>{metricLabel[metric]}</dt>
                  <dd>{metricValue(provider, metric)}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
        <p className={styles.mobileHint}>
          Select a provider to see all metrics.
        </p>
      </div>
    </div>
  );
}
