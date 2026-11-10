import { timeZoneLabel as zoneAt } from "@/lib/tender/time-zone";
import type { ContractSpec, FieldSpec } from "@/lib/registry";
import { readField } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { Delta } from "@/components/viz/Delta";
import { formatAge, formatClock, formatLatency, formatUsd } from "@/components/viz/format";
import { PriceChart } from "@/components/viz/PriceChart";
import type { PricePoint, VizProviders } from "@/components/viz/types";
import { displayUnit, formatMoney, formatPlainNumber, formatScalar, isAttachedUnit, tickDecimals, type FormatContext } from "./field-format";
import { FieldGrid, FieldUnit, ListValue, ObjectValue, ResultLink } from "./FieldGrid";
import { ResultMeta } from "./ResultMeta";
import { ResultStatusLine } from "./ResultStatusLine";
import type { FieldsReading, ResultRequest } from "./types";

const NUMERIC_TYPES = new Set<FieldSpec["type"]>(["number", "integer", "money", "percent"]);

export interface FieldsResultProps {
  /** Contract of the market: drives the headline, the field grid, and the chart. */
  contract: ContractSpec;
  /** Latest successful result. When the latest request failed it stays on screen, dimmed. */
  reading: FieldsReading | null;
  /** Latest request (any outcome). Drives the status line and the provenance footer. */
  request?: ResultRequest | null;
  /** Recent values of the contract's series field (oldest first). No chart without a series field. */
  points?: readonly PricePoint[];
  providers?: VizProviders;
  /** Display time zone. Default `UTC`. */
  timeZone?: string;
  /** Time zone suffix. Default `UTC`. */
  timeZoneLabel?: string;
  /** Chart height in px. Default 96. */
  chartHeight?: number;
  /** Show the provenance footer (Served by …). Default true. */
  showMeta?: boolean;
  className?: string;
}

/** Tooltip format for a series value: up to two decimals with the field's unit (`61.4 US AQI`, `$228.42`). */
export function seriesFormatter(field: FieldSpec): (value: number) => string {
  const unit = displayUnit(field);
  return (value) => {
    const text = field.type === "money" ? formatMoney(value, field.unit) : formatPlainNumber(value, 2);
    return unit ? `${text}${isAttachedUnit(unit) ? "" : " "}${unit}` : text;
  };
}

/** Axis tick format for a series value: the number only, with enough decimals to keep ticks distinct. */
export function seriesTickFormatter(field: FieldSpec, points: readonly PricePoint[] = []): (value: number) => string {
  const decimals = tickDecimals(points.map((point) => point.price));
  return (value) => (field.type === "money" ? formatUsd(value, decimals) : formatPlainNumber(value, decimals));
}

/** Big headline value of a result, by the primary field's type. */
function Headline({
  field,
  value,
  context,
  change,
}: {
  field: FieldSpec;
  value: unknown;
  context: FormatContext;
  change: number | null;
}) {
  if (value === null || value === undefined || value === "") {
    return <div className="text-[40px] leading-none font-semibold tracking-[-0.02em] text-foreground">–</div>;
  }
  if (NUMERIC_TYPES.has(field.type) && typeof value === "number") {
    const unit = displayUnit(field);
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="text-[40px] leading-none font-semibold tracking-[-0.02em] text-foreground tabular-nums">
          {formatScalar(field, value, context)}
          {unit ? <span className="ml-1.5 text-xl font-medium tracking-normal text-muted-foreground">{unit}</span> : null}
        </div>
        {change !== null ? (
          <span className="inline-flex items-center gap-1.5 text-caption">
            <Delta value={change} format={(v) => formatPlainNumber(v, 2)} />
            <span className="text-muted-foreground">vs previous</span>
          </span>
        ) : null}
      </div>
    );
  }
  if (field.type === "url" && typeof value === "string") {
    return <ResultLink href={value} className="block text-xl leading-tight font-medium" />;
  }
  if (field.type === "list" && Array.isArray(value)) {
    return (
      <div className="text-body font-medium text-foreground">
        <ListValue value={value} />
      </div>
    );
  }
  if (field.type === "object" && typeof value === "object") {
    return <ObjectValue value={value as Record<string, unknown>} />;
  }
  const text = formatScalar(field, value, context);
  if (text.length > 40) {
    return <p className="text-base leading-snug font-medium whitespace-normal text-foreground">{text}</p>;
  }
  return (
    <div className="text-[32px] leading-tight font-semibold tracking-[-0.02em] text-foreground [overflow-wrap:anywhere]">
      {text}
      {displayUnit(field) ? <FieldUnit unit={displayUnit(field)!} /> : null}
    </div>
  );
}

/** Source time, data age (the contract's freshness label), and latency of a reading. */
export function ReadingMeta({
  reading,
  label,
  timeZone,
  timeZoneLabel,
}: {
  reading: FieldsReading;
  label: string;
  timeZone: string;
  timeZoneLabel?: string;
}) {
  return (
    <>
      <span className="truncate tabular-nums">
        Source {formatClock(reading.sourceTimestamp, timeZone)} {timeZoneLabel ?? zoneAt(timeZone, reading.sourceTimestamp)}
      </span>
      <span aria-hidden="true" className="text-faint">
        ·
      </span>
      <span className="truncate tabular-nums">
        {label} {formatAge(reading.dataAgeMs)}
      </span>
      <span aria-hidden="true" className="text-faint">
        ·
      </span>
      <span className="truncate tabular-nums">Latency {formatLatency(reading.latencyMs)}</span>
    </>
  );
}

/**
 * Generic result of any contract: the primary field as the headline, the other output fields as a
 * label/value grid with units, a chart of the series field when the contract has one, and the
 * provenance footer.
 */
export function FieldsResult({
  contract,
  reading,
  request,
  points = [],
  providers,
  timeZone = "UTC",
  timeZoneLabel,
  chartHeight = 96,
  showMeta = true,
  className,
}: FieldsResultProps) {
  const status = request?.status ?? "ok";
  const stale = status !== "ok";
  const context: FormatContext = { timeZone, timeZoneLabel };
  const primary = contract.output.find((field) => field.primary) ?? contract.output[0];
  const series = contract.output.find((field) => field.series);
  const values = reading?.values ?? null;
  const rest = contract.output.filter((field) => field !== primary);
  const primaryValue = values && primary ? readField(values, primary.key) : undefined;
  const change = reading?.change ?? null;

  return (
    <div className={cn("@container flex min-w-0 flex-col", className)} data-status={status}>
      <div className={cn("min-w-0 transition-opacity duration-fast", stale && "opacity-45")}>
        {primary ? (
          <>
            <div className="text-caption font-medium text-muted-foreground">{primary.label}</div>
            <div className="mt-1 min-w-0">
              <Headline field={primary} value={primaryValue} context={context} change={series === primary ? change : null} />
            </div>
          </>
        ) : null}
      </div>

      <ResultStatusLine request={request} hasPrevious={reading !== null} className="mt-3">
        {reading ? (
          <ReadingMeta reading={reading} label={contract.freshness.label} timeZone={timeZone} timeZoneLabel={timeZoneLabel} />
        ) : (
          <span>Run a request to see the result</span>
        )}
      </ResultStatusLine>

      <FieldGrid
        fields={rest}
        values={values}
        context={context}
        change={series && series !== primary ? { key: series.key, value: change } : null}
        className={cn("mt-4 border-t border-border pt-4 transition-opacity duration-fast", stale && "opacity-45")}
      />

      {series ? (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-caption text-muted-foreground">{series.label}, recent requests</div>
          <PriceChart
            className="mt-1"
            points={points}
            providers={providers}
            timeZone={timeZone}
            timeZoneLabel={timeZoneLabel}
            height={chartHeight}
            formatPrice={seriesFormatter(series)}
            formatTick={seriesTickFormatter(series, points)}
            emptyLabel="No results yet"
            ariaLabel={`${series.label} over recent requests`}
          />
        </div>
      ) : null}

      {showMeta && (
        <ResultMeta
          className="mt-3 border-t border-border pt-3"
          status={status}
          provider={request?.provider}
          latencyMs={status === "ok" ? undefined : request?.latencyMs}
          requestId={request?.id}
          source={request?.source}
        />
      )}
    </div>
  );
}
