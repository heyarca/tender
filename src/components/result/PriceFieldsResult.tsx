import type { ContractSpec } from "@/lib/registry";
import { readField } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { Delta } from "@/components/viz/Delta";
import { PriceChart } from "@/components/viz/PriceChart";
import type { PricePoint, VizProviders } from "@/components/viz/types";
import { formatMoney, type FormatContext } from "./field-format";
import { FieldGrid } from "./FieldGrid";
import { ReadingMeta } from "./FieldsResult";
import { ResultMeta } from "./ResultMeta";
import { ResultStatusLine } from "./ResultStatusLine";
import type { FieldsReading, ResultRequest } from "./types";

export interface PriceFieldsResultProps {
  /** Contract of the market (stocks, commodities, components, freight). */
  contract: ContractSpec;
  /** Label above the price, e.g. `AAPL` or `SHA → LAX`. */
  title: string;
  /** Latest successful result. When the latest request failed it stays on screen, dimmed. */
  reading: FieldsReading | null;
  /** Latest request (any outcome). Drives the status line and the provenance footer. */
  request?: ResultRequest | null;
  /** Recent prices for the chart (oldest first). */
  points: readonly PricePoint[];
  providers?: VizProviders;
  /** Display time zone. Default `UTC`. */
  timeZone?: string;
  /** Time zone suffix. Default `UTC`. */
  timeZoneLabel?: string;
  /** Chart height in px. Default 160. */
  chartHeight?: number;
  /** Show the provenance footer (Served by …). Default true. */
  showMeta?: boolean;
  className?: string;
}

/**
 * Price result over a fields payload: the primary money field big with its trading unit, the change
 * against the previous request, a meta row, the recent-price chart, the other fields, and the
 * provenance footer.
 */
export function PriceFieldsResult({
  contract,
  title,
  reading,
  request,
  points,
  providers,
  timeZone = "UTC",
  timeZoneLabel = "UTC",
  chartHeight = 160,
  showMeta = true,
  className,
}: PriceFieldsResultProps) {
  const status = request?.status ?? "ok";
  const stale = status !== "ok";
  const context: FormatContext = { timeZone, timeZoneLabel };
  const primary = contract.output.find((field) => field.primary) ?? contract.output[0];
  const unitField = contract.output.find((field) => field.key === "unit" && field.type === "string");
  const values = reading?.values ?? null;
  const rawPrice = values && primary ? readField(values, primary.key) : undefined;
  const price = typeof rawPrice === "number" ? rawPrice : null;
  const rawUnit = values && unitField ? readField(values, unitField.key) : undefined;
  const tradingUnit = typeof rawUnit === "string" && rawUnit ? rawUnit : null;
  const change = reading?.change ?? null;
  const base = price !== null && change !== null ? price - change : 0;
  const changePct = change !== null && base !== 0 ? change / base : null;
  const format = (value: number) => formatMoney(value, primary?.unit);
  const rest = contract.output.filter((field) => field !== primary && field !== unitField);

  return (
    <div className={cn("@container flex min-w-0 flex-col", className)} data-status={status}>
      <div className={cn("transition-opacity duration-fast", stale && "opacity-45")}>
        <div className="truncate text-caption font-medium text-muted-foreground">{title}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="text-[40px] leading-none font-semibold tracking-[-0.02em] text-foreground tabular-nums">
            {price !== null ? format(price) : "–"}
            {price !== null && tradingUnit ? (
              <span className="ml-2 text-base font-medium tracking-normal text-muted-foreground">{tradingUnit}</span>
            ) : null}
          </div>
          {change !== null && (
            <span className="inline-flex items-center gap-1.5 text-caption">
              <Delta value={change} format={format} percent={changePct} percentDecimals={3} />
              <span className="text-muted-foreground">vs previous</span>
            </span>
          )}
        </div>
      </div>

      <ResultStatusLine request={request} hasPrevious={reading !== null} className="mt-3">
        {reading ? (
          <ReadingMeta reading={reading} label={contract.freshness.label} timeZone={timeZone} timeZoneLabel={timeZoneLabel} />
        ) : (
          <span>Run a request to see the current price</span>
        )}
      </ResultStatusLine>

      <PriceChart
        className="mt-3"
        points={points}
        providers={providers}
        timeZone={timeZone}
        timeZoneLabel={timeZoneLabel}
        height={chartHeight}
        formatPrice={format}
      />

      <FieldGrid
        fields={rest}
        values={values}
        context={context}
        className={cn("mt-3 border-t border-border pt-3 transition-opacity duration-fast", stale && "opacity-45")}
      />

      {showMeta && (
        <ResultMeta
          className="mt-3 border-t border-border pt-3"
          status={status}
          provider={request?.provider}
          latencyMs={status === "ok" ? undefined : request?.latencyMs}
          requestId={request?.id}
        />
      )}
    </div>
  );
}
