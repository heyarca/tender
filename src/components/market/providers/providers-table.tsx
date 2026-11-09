"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { motion, type Transition } from "motion/react";
import { Check, Pin, X } from "lucide-react";

import { badgeVariants, Badge, StatusDot } from "@/components/ui/badge";
import { ProviderLogo } from "@/components/ui/provider-logo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  TableSubheadRow,
  TableValue,
} from "@/components/ui/table";
import { InfoTooltip, Tooltip } from "@/components/ui/tooltip";
import { Sparkline, SuccessBars, usePrefersReducedMotion, type SparklineTone } from "@/components/viz";
import { format, type MarketView, type ProviderRow } from "@/lib/tender";
import { usePendingSwitch } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import { ProviderRowMenu } from "./provider-row-menu";
import {
  failingMetrics,
  groupProviders,
  metricReason,
  nextSort,
  providerTags,
  providerTrend,
  routeLabel,
  statusTone,
  successSamples,
  trendScale,
  valueParts,
  type MetricKey,
  type SignalTone,
  type SortKey,
  type SortState,
} from "./provider-table-model";

const MotionRow = motion.create(TableRow);
const MotionSubheadRow = motion.create(TableSubheadRow);

const COLUMN_COUNT = 9;
const LAYOUT_TRANSITION: Transition = { type: "tween", duration: 0.5, ease: [0.22, 1, 0.36, 1] };
const FLASH_MS = 1600;

const TINT: Record<SignalTone, string> = {
  warning: "text-warning-text",
  negative: "text-negative-text",
};

export interface ProvidersTableProps {
  view: MarketView;
  selectedId: string | null;
  onSelect: (providerId: string | null) => void;
}

/**
 * OpenRouter's provider table adapted to bids: routed providers first (active,
 * then qualified by rank), a muted "Excluded by your policy" divider, then the
 * excluded rows with their failing metric tinted. Rows animate when the route
 * changes; the new active row flashes once.
 */
export function ProvidersTable({ view, selectedId, onSelect }: ProvidersTableProps) {
  const [sort, setSort] = useState<SortState | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const { routed, excluded } = groupProviders(view.providers, sort);
  const order = [...routed.map((r) => r.id), "|", ...excluded.map((r) => r.id)].join(",");

  useActiveRowFlash(view, rowRefs, reduceMotion);

  const sortProps = (key: SortKey) => ({
    sort: sort?.key === key ? sort.direction : (false as const),
    onSort: () => setSort((current) => nextSort(current, key)),
  });

  const renderRow = (row: ProviderRow) => (
    <ProviderTableRow
      key={row.id}
      row={row}
      view={view}
      selected={selectedId === row.id}
      onSelect={onSelect}
      layoutKey={order}
      reduceMotion={reduceMotion}
      rowRef={(el) => {
        if (el) rowRefs.current.set(row.id, el);
        else rowRefs.current.delete(row.id);
      }}
    />
  );

  return (
    <Table
      aria-label={`${view.definition.name} providers`}
      data-slot="providers-table"
      // OpenRouter's `or-table--tight-x`: 10px inner cell padding, 16px at the row edges.
      className="[&_td]:px-2.5 [&_th]:px-2.5"
      // The provider column is sticky on small screens, so do not fade the start edge there.
      scrollClassName="max-md:data-overflow-start:mask-none"
    >
      <TableHeader>
        <TableRow>
          <TableHead {...sortProps("name")} className="max-md:sticky max-md:left-0 max-md:z-[2] max-md:bg-card">
            Provider
          </TableHead>
          <TableHead
            align="right"
            unit={view.definition.units.price}
            tooltip="What the provider bids to serve this contract, in USD per 1M requests."
            {...sortProps("bid")}
          >
            Bid
          </TableHead>
          <TableHead
            align="right"
            tooltip="95th-percentile request latency, as the monitor measures it now."
            {...sortProps("latency")}
          >
            P95
          </TableHead>
          <TableHead
            align="right"
            tooltip="Age of the data when the response is sent. This is freshness, not request latency."
            {...sortProps("dataAge")}
          >
            Data age
          </TableHead>
          <TableHead
            align="right"
            tooltip="Share of requests that succeed. Bars show the last three monitor samples."
            {...sortProps("success")}
          >
            Success
          </TableHead>
          <TableHead tooltip="Last 30 monitor samples of the metric that decides this row: the failing check, or the one your preference ranks on. Dashed line: your limit.">
            Trend
          </TableHead>
          <TableHead tooltip="Qualification against your routing policy. Focus or hover a status to see every check.">
            Status
          </TableHead>
          <TableHead tooltip="Active serves requests now. Standby providers qualify and take over in rank order.">
            Route
          </TableHead>
          <TableHead className="w-0 pl-1! last:pr-2">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      {/* One keyed list, so a provider that changes group moves (and animates) instead of remounting. */}
      <TableBody>
        {[
          ...routed.map(renderRow),
          excluded.length > 0 ? (
            <MotionSubheadRow
              key="excluded-divider"
              layout={reduceMotion ? false : "position"}
              layoutDependency={order}
              transition={LAYOUT_TRANSITION}
              colSpan={COLUMN_COUNT}
              data-slot="excluded-divider"
              // Let the sticky label below take the full-width cell as its containing block.
              className="[&>td>div>span:first-child]:contents"
            >
              {/* Sticky on small screens so the label stays beside the sticky provider column while scrolling. */}
              <span className="flex items-center gap-1.5 max-md:sticky max-md:left-4">
                Excluded by your policy ({excluded.length})
                <InfoTooltip
                  label="Why providers are excluded"
                  iconSize={12}
                  content="These providers fail at least one requirement in your routing policy. Automatic routing never sends them requests."
                />
              </span>
            </MotionSubheadRow>
          ) : null,
          ...excluded.map(renderRow),
        ]}
      </TableBody>
    </Table>
  );
}

/** Flash the row that just became active (Web Animations, so hover and selection classes keep working). */
function useActiveRowFlash(
  view: MarketView,
  rowRefs: RefObject<Map<string, HTMLTableRowElement>>,
  reduceMotion: boolean,
) {
  const activeId = view.route.activeProviderId;
  const previous = useRef<{ marketId: string; activeId: string | null } | null>(null);
  useEffect(() => {
    const prev = previous.current;
    previous.current = { marketId: view.id, activeId };
    if (!prev || prev.marketId !== view.id || prev.activeId === activeId || !activeId) return;
    const el = rowRefs.current.get(activeId);
    if (!el || typeof el.animate !== "function") return;
    // The selected-row wash (lime 25%): lime is a fill only, the row text stays ink.
    const flash = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    if (!flash) return;
    const rest = getComputedStyle(el).backgroundColor;
    const animation = el.animate([{ backgroundColor: flash }, { backgroundColor: rest }], {
      duration: FLASH_MS,
      easing: reduceMotion ? "steps(1, end)" : "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    el.dataset.flash = "";
    animation.onfinish = () => delete el.dataset.flash;
    return () => animation.cancel();
  }, [view.id, activeId, rowRefs, reduceMotion]);
}

interface ProviderTableRowProps {
  row: ProviderRow;
  view: MarketView;
  selected: boolean;
  onSelect: (providerId: string | null) => void;
  layoutKey: string;
  reduceMotion: boolean;
  rowRef: (el: HTMLTableRowElement | null) => void;
}

function ProviderTableRow({ row, view, selected, onSelect, layoutKey, reduceMotion, rowRef }: ProviderTableRowProps) {
  const excluded = row.role === "excluded";
  const failing = failingMetrics(row);
  const route = routeLabel(row);
  const trend = providerTrend(row, view.policy);
  const sparkTone: SparklineTone =
    row.role === "pinned-failing" ? "negative" : row.isActive ? "active" : excluded ? "muted" : "neutral";

  const tint = (metric: MetricKey) => {
    const tone = failing[metric];
    return tone ? TINT[tone] : undefined;
  };
  const reasonTooltip = (metric: MetricKey, node: ReactNode) => {
    const reason = metricReason(row, metric);
    if (!reason) return node;
    return (
      <Tooltip content={reason}>
        <span className="cursor-help underline decoration-current/40 decoration-dotted underline-offset-2">{node}</span>
      </Tooltip>
    );
  };

  return (
    <MotionRow
      ref={rowRef}
      layout={reduceMotion ? false : "position"}
      layoutDependency={layoutKey}
      transition={LAYOUT_TRANSITION}
      interactive
      selected={selected}
      onClick={() => onSelect(selected ? null : row.id)}
      data-provider={row.id}
      data-role={row.role}
      data-status={row.status}
      // Opaque rows, so a row sliding past others during a reorder covers them instead of overlapping text.
      className={cn("group/row", !selected && "bg-card")}
    >
      <TableRowHeader
        muted={excluded}
        className={cn(
          // Small screens: the provider column stays in view while the metrics scroll, and tags wrap under the name.
          // Wider screens: tags wrap under the name only when the table runs out of room.
          "whitespace-normal max-md:sticky max-md:left-0 max-md:z-[1] max-md:max-w-44 max-md:bg-card",
          selected && "shadow-[inset_2px_0_0_var(--primary-strong)]",
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            aria-pressed={selected}
            aria-label={`${row.name}, select to inspect`}
            className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-sm text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ProviderLogo src={row.logo} name={row.name} className={cn(excluded && "opacity-75")} />
            <span className={cn("truncate text-xs whitespace-nowrap", excluded ? "text-muted-foreground" : "text-foreground")}>
              {row.name}
            </span>
          </button>
          <ProviderTags row={row} />
        </div>
      </TableRowHeader>
      <TableCell numeric>
        <BidValue row={row} muted={excluded} tintClass={tint("bid")} wrap={(node) => reasonTooltip("bid", node)} />
      </TableCell>
      <TableCell numeric>
        {reasonTooltip(
          "latency",
          <PartsValue text={format.latency(row.conditions.p95LatencyMs)} muted={excluded} tintClass={tint("latency")} />,
        )}
      </TableCell>
      <TableCell numeric>
        {reasonTooltip(
          "dataAge",
          <PartsValue text={format.dataAge(row.conditions.dataAgeMs)} muted={excluded} tintClass={tint("dataAge")} />,
        )}
      </TableCell>
      <TableCell numeric>
        <SuccessBars
          values={successSamples(row)}
          threshold={view.policy.minSuccessRate}
          label={row.conditions.available ? format.percent(row.successRate) : "–"}
          ariaLabel={
            row.conditions.available
              ? `Success rate ${format.percent(row.successRate)}`
              : "No successful requests: the provider is not responding"
          }
          className={cn("[&>span]:w-14", excluded && !failing.success && "[&>span]:text-muted-foreground")}
        />
      </TableCell>
      <TableCell>
        <Tooltip content={trend.description}>
          <span className="flex w-fit cursor-help">
            <Sparkline
              values={trend.values}
              limit={trend.limit}
              tone={sparkTone}
              width={60}
              height={22}
              {...trendScale(trend)}
              ariaLabel={trend.description}
            />
          </span>
        </Tooltip>
      </TableCell>
      <TableCell>
        <StatusBadge row={row} />
      </TableCell>
      <TableCell>
        {row.isPendingTarget ? (
          <PendingRouteText marketId={view.id} />
        ) : (
          <RouteText route={route} />
        )}
      </TableCell>
      <TableCell className="py-0 pl-1! last:pr-2">
        <div className="flex justify-end">
          <ProviderRowMenu marketId={view.id} row={row} mode={view.policy.mode} onSelect={onSelect} />
        </div>
      </TableCell>
    </MotionRow>
  );
}

function ProviderTags({ row }: { row: ProviderRow }) {
  const tags = providerTags(row);
  if (!tags.length) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      {tags.map((tag) => {
        switch (tag) {
          case "active":
            return (
              <Badge key={tag} tone="active" data-tag="active">
                Active
              </Badge>
            );
          case "pinned":
            return (
              <Badge key={tag} tone={row.role === "pinned-failing" ? "negative" : "active"} icon={<Pin aria-hidden="true" />} data-tag="pinned">
                Pinned
              </Badge>
            );
          case "best-price":
            return (
              <span key={tag} className="shrink-0 text-xs font-medium text-positive-text" data-tag="best-price">
                Best price
              </span>
            );
        }
      })}
    </span>
  );
}

function PartsValue({ text, muted, tintClass }: { text: string; muted: boolean; tintClass?: string }) {
  return (
    <span className={cn("tabular-nums", tintClass ?? (muted ? "text-muted-foreground" : "text-foreground"))}>
      {valueParts(text).map((part, i) =>
        part.unit ? (
          <span key={i} className={tintClass ? undefined : "text-muted-foreground"}>
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function BidValue({
  row,
  muted,
  tintClass,
  wrap,
}: {
  row: ProviderRow;
  muted: boolean;
  tintClass?: string;
  wrap: (node: ReactNode) => ReactNode;
}) {
  const changed = row.modifiedFields.includes("bidPrice");
  const lowered = changed && row.conditions.bidPrice < row.defaults.bidPrice;
  const value = (
    <TableValue
      muted={muted}
      className={cn(tintClass ?? (lowered && !muted ? "text-positive-text" : undefined))}
    >
      {format.price(row.conditions.bidPrice)}
    </TableValue>
  );
  if (!changed) return <>{wrap(value)}</>;
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-2xs text-muted-foreground tabular-nums line-through" aria-label={`was ${format.price(row.defaults.bidPrice)}`}>
        {format.price(row.defaults.bidPrice)}
      </span>
      {wrap(value)}
    </span>
  );
}

function StatusBadge({ row }: { row: ProviderRow }) {
  const failing = row.evaluation.reasons;
  const label = failing.length
    ? `${row.statusLabel}. ${failing.map((r) => r.message).join(". ")}.`
    : `${row.statusLabel}. Meets every requirement.`;
  const passing = row.evaluation.checks.filter((c) => c.passed && c.check !== "availability");
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-1 py-0.5">
          <p className="font-medium text-foreground">
            {failing.length
              ? `Excluded: ${failing.length} ${failing.length === 1 ? "check fails" : "checks fail"}`
              : "Meets your policy"}
          </p>
          <ul className="flex flex-col gap-0.5">
            {failing.map((reason) => (
              <li key={reason.check} className="flex items-center gap-1.5">
                <X aria-hidden="true" className={cn("size-3 shrink-0", statusTone(reason.status) === "negative" ? "text-negative" : "text-warning")} strokeWidth={2.5} />
                <span>{reason.message}</span>
              </li>
            ))}
            {failing.length === 0
              ? passing.map((check) => (
                  <li key={check.check} className="flex items-center gap-1.5 text-muted-foreground">
                    <Check aria-hidden="true" className="size-3 shrink-0 text-positive" strokeWidth={2.5} />
                    <span>{check.message}</span>
                  </li>
                ))
              : null}
          </ul>
        </div>
      }
    >
      <button
        type="button"
        aria-label={label}
        className={cn(
          badgeVariants({ tone: statusTone(row.status) }),
          "cursor-help border-0 outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
        data-slot="status-badge"
      >
        {row.statusLabel}
      </button>
    </Tooltip>
  );
}

function RouteText({ route }: { route: ReturnType<typeof routeLabel> }) {
  switch (route.tone) {
    case "active":
      return (
        <span className="flex w-fit items-center gap-1.5 font-medium text-accent-foreground">
          <StatusDot tone="active" size="sm" pulse />
          {route.text}
        </span>
      );
    case "negative":
      return (
        <span className="flex w-fit items-center gap-1.5 font-medium text-negative-text">
          <StatusDot tone="negative" size="sm" />
          {route.text}
        </span>
      );
    case "warning":
      return <span className="text-warning-text">{route.text}</span>;
    case "neutral":
      return (
        <span className="text-muted-foreground">
          <span className="sr-only">Rank </span>
          {route.text}
        </span>
      );
    case "faint":
      return <span className="text-faint">{route.text}</span>;
  }
}

function PendingRouteText({ marketId }: { marketId: MarketView["id"] }) {
  const pending = usePendingSwitch(marketId);
  return (
    <span className="flex w-fit items-center gap-1.5 text-warning-text tabular-nums">
      <StatusDot tone="warning" size="sm" />
      {pending ? `Next in ${pending.secondsRemaining} s` : "Next route"}
    </span>
  );
}
