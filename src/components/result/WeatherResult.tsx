import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { compassDirection, formatAge, formatNumber, formatTimeOfDay } from "@/components/viz/format";
import { ResultMeta } from "./ResultMeta";
import { ResultStatusLine } from "./ResultStatusLine";
import type { ResultRequest, WeatherReading } from "./types";
import { weatherCondition } from "./weather-condition";

export interface WeatherResultProps {
  /** Latest successful reading. When the latest request failed it stays on screen, dimmed. */
  reading: WeatherReading | null;
  /** Latest request (any outcome). Drives the status line and the provenance footer. */
  request?: ResultRequest | null;
  /** Display time zone. Default `America/Los_Angeles`. */
  timeZone?: string;
  /** Time zone suffix. Default `PT`. */
  timeZoneLabel?: string;
  /** Replaces the observed-time text, e.g. `Observed 12 s ago`. */
  observedLabel?: string;
  /** Show the provenance footer (Served by …). Default true. */
  showMeta?: boolean;
  className?: string;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-body leading-5 font-medium text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-0.5 font-normal text-muted-foreground">{children}</span>;
}

/**
 * San Francisco weather result: big temperature, condition with icon, feels-like, a meta row
 * (location, observed time, data age), the field grid, and the provenance footer.
 */
export function WeatherResult({
  reading,
  request,
  timeZone = "America/Los_Angeles",
  timeZoneLabel = "PT",
  observedLabel,
  showMeta = true,
  className,
}: WeatherResultProps) {
  const status = request?.status ?? "ok";
  const stale = status !== "ok";
  const condition = reading ? weatherCondition(reading.condition) : null;
  const Icon = condition?.icon;

  return (
    <div className={cn("@container flex min-w-0 flex-col", className)} data-status={status}>
      <div className={cn("transition-opacity duration-fast", stale && "opacity-45")}>
        <div className="flex items-center gap-4">
          <div className="text-[40px] leading-none font-semibold tracking-[-0.02em] text-foreground tabular-nums">
            {reading ? `${Math.round(reading.temperatureF)}°F` : "–"}
          </div>
          {reading && Icon && (
            <div className="flex min-w-0 items-center gap-2.5 border-l border-border pl-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Icon aria-hidden="true" className="size-4 text-muted-foreground" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-body leading-5 font-medium text-foreground">
                  {reading.conditionLabel ?? condition?.label}
                </div>
                <div className="truncate text-caption text-muted-foreground tabular-nums">
                  Feels like {Math.round(reading.feelsLikeF)}°F
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ResultStatusLine request={request} hasPrevious={reading !== null} className="mt-3">
        {reading ? (
          <>
            <span className="truncate text-foreground">{reading.location}</span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <span className="truncate tabular-nums">
              {observedLabel ?? `Observed ${formatTimeOfDay(reading.observedAt, timeZone)} ${timeZoneLabel}`}
            </span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <span className="truncate tabular-nums">Data age {formatAge(reading.dataAgeMs)}</span>
          </>
        ) : (
          <span>Run a request to see current conditions</span>
        )}
      </ResultStatusLine>

      <dl
        className={cn(
          "mt-4 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-border pt-4 transition-opacity duration-fast @xl:grid-cols-6",
          stale && "opacity-45",
        )}
      >
        <Field label="Humidity">
          {reading ? formatNumber(reading.humidityPct) : "–"}
          <Unit>%</Unit>
        </Field>
        <Field label="Wind">
          {reading ? formatNumber(reading.windMph) : "–"}
          <Unit>mph</Unit>
          {reading && <span className="ml-1">{compassDirection(reading.windDirectionDeg)}</span>}
        </Field>
        <Field label="Pressure">
          {reading ? formatNumber(reading.pressureHpa) : "–"}
          <Unit>hPa</Unit>
        </Field>
        <Field label="Visibility">
          {reading ? formatNumber(reading.visibilityMi, 1) : "–"}
          <Unit>mi</Unit>
        </Field>
        <Field label="Dew point">
          {reading ? formatNumber(reading.dewPointF) : "–"}
          <Unit>°F</Unit>
        </Field>
        <Field label="Cloud cover">
          {reading ? formatNumber(reading.cloudCoverPct) : "–"}
          <Unit>%</Unit>
        </Field>
      </dl>

      {showMeta && (
        <ResultMeta
          className="mt-4 border-t border-border pt-3"
          status={status}
          provider={request?.provider}
          latencyMs={request?.latencyMs}
          requestId={request?.id}
        />
      )}
    </div>
  );
}
