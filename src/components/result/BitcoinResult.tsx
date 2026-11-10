import { timeZoneLabel as zoneAt } from "@/lib/tender/time-zone";
import { cn } from "@/lib/utils";
import { Delta } from "@/components/viz/Delta";
import { formatAge, formatClock, formatLatency, formatUsd } from "@/components/viz/format";
import { PriceChart } from "@/components/viz/PriceChart";
import type { PricePoint, VizProviders } from "@/components/viz/types";
import { ResultMeta } from "./ResultMeta";
import { ResultStatusLine } from "./ResultStatusLine";
import type { BitcoinQuote, ResultRequest } from "./types";

export interface BitcoinResultProps {
  /** Latest successful quote. When the latest request failed it stays on screen, dimmed. */
  quote: BitcoinQuote | null;
  /** Latest request (any outcome). Drives the status line and the provenance footer. */
  request?: ResultRequest | null;
  /** Recent prices for the chart (oldest first). */
  points: readonly PricePoint[];
  /** Provider identities for the chart tooltip and switch markers. */
  providers?: VizProviders;
  /** Display time zone. Default `UTC`. */
  timeZone?: string;
  /** Time zone suffix. Default `UTC`. */
  timeZoneLabel?: string;
  /** Chart height in px. Default 160. */
  chartHeight?: number;
  /** Show the provenance footer (Served by …). Default true. */
  showMeta?: boolean;
  /** Preview: elapsed chart time and data age at response, without a wall-clock freshness claim. */
  preview?: boolean;
  className?: string;
}

/** Change against the previous request: `change` when given, else derived from `previousPrice`. */
export function quoteChange(quote: BitcoinQuote): number | null {
  if (quote.change !== null && quote.change !== undefined && Number.isFinite(quote.change)) return quote.change;
  if (quote.previousPrice !== null && quote.previousPrice !== undefined && Number.isFinite(quote.previousPrice)) {
    return quote.price - quote.previousPrice;
  }
  return null;
}

/**
 * BTC/USD result: big price with the change against the previous request, a meta row (source
 * time, data age, latency), the recent-price chart, and the provenance footer.
 */
export function BitcoinResult({
  quote,
  request,
  points,
  providers,
  timeZone = "UTC",
  timeZoneLabel,
  chartHeight = 160,
  showMeta = true,
  preview = false,
  className,
}: BitcoinResultProps) {
  const status = request?.status ?? "ok";
  const stale = status !== "ok";
  const change = quote ? quoteChange(quote) : null;
  const base = quote && change !== null ? quote.price - change : 0;
  const changePct = change !== null && base !== 0 ? change / base : null;

  return (
    <div className={cn("@container flex min-w-0 flex-col", className)} data-status={status}>
      <div className={cn("transition-opacity duration-fast", stale && "opacity-45")}>
        <div className="text-caption font-medium text-muted-foreground">{quote?.pair ?? "BTC/USD"}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="text-[40px] leading-none font-semibold tracking-[-0.02em] text-foreground tabular-nums">
            {quote ? formatUsd(quote.price) : "–"}
          </div>
          {change !== null && (
            <span className="inline-flex items-center gap-1.5 text-caption">
              <Delta value={change} format={(v) => formatUsd(v)} percent={changePct} percentDecimals={3} />
              <span className="text-muted-foreground">vs previous</span>
            </span>
          )}
        </div>
      </div>

      <ResultStatusLine request={request} hasPrevious={quote !== null} className="mt-3">
        {quote ? (
          <>
            {!preview ? <>
              <span className="truncate tabular-nums">
                Source {formatClock(quote.sourceTimestamp, timeZone, { milliseconds: true })} {timeZoneLabel ?? zoneAt(timeZone, quote.sourceTimestamp)}
              </span>
              <span aria-hidden="true" className="text-faint">·</span>
            </> : null}
            <span className="truncate tabular-nums">Data age{preview ? " at response" : ""} {formatAge(quote.dataAgeMs)}</span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <span className="truncate tabular-nums">Latency {formatLatency(quote.latencyMs)}</span>
          </>
        ) : (
          <span>No result yet. The next request shows the current price here.</span>
        )}
      </ResultStatusLine>

      <PriceChart
        className="mt-3"
        points={points}
        providers={providers}
        timeZone={timeZone}
        timeZoneLabel={timeZoneLabel}
        height={chartHeight}
        elapsedTime={preview}
      />

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
