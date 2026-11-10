import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatAge, formatLatency } from "@/components/viz/format";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { CircleDollarSign, Sparkles, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ResultProvider, ResultSource, ResultStatus } from "./types";

export interface ResultMetaProps {
  /** Outcome of the request. Changes the lead-in: Served by / Failed at / Not sent. Default `ok`. */
  status?: ResultStatus;
  provider?: ResultProvider | null;
  latencyMs?: number | null;
  /** Data age at response. Omit to hide. */
  dataAgeMs?: number | null;
  /** `req_000123`. */
  requestId?: string | null;
  /** Who bought the request on the server; adds an "Ask Tender" or "Credits" tag after the provider. */
  source?: ResultSource;
  className?: string;
}

const SOURCE_TAGS: Record<ResultSource, { label: string; icon: ReactNode }> = {
  "ask-tender": { label: "Ask Tender", icon: <Sparkles aria-hidden="true" /> },
  credits: { label: "Credits", icon: <Wallet aria-hidden="true" /> },
  usdc: { label: "USDC", icon: <CircleDollarSign aria-hidden="true" /> },
};

function Separator() {
  return (
    <span aria-hidden="true" className="text-faint">
      ·
    </span>
  );
}

/**
 * Provenance line: `Served by [logo] Fernline · 84 ms · data age 220 ms · req_000123`.
 * Fields that are not passed are left out.
 */
export function ResultMeta({
  status = "ok",
  provider,
  latencyMs,
  dataAgeMs,
  requestId,
  source,
  className,
}: ResultMetaProps) {
  const items: { key: string; node: ReactNode }[] = [];

  if (status === "rejected") {
    items.push({ key: "lead", node: <span className="text-warning-text">Not sent</span> });
  } else if (provider) {
    items.push({
      key: "lead",
      node: (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className={status === "failed" ? "text-negative-text" : undefined}>
            {status === "failed" ? "Failed at" : "Served by"}
          </span>
          <ProviderLogo src={provider.logo} name={provider.name} size={16} />
          <span className="truncate font-medium text-foreground">{provider.name}</span>
          {source ? (
            <Badge tone="active" icon={SOURCE_TAGS[source].icon} data-slot="result-source">
              {SOURCE_TAGS[source].label}
            </Badge>
          ) : null}
        </span>
      ),
    });
  }
  if (latencyMs !== null && latencyMs !== undefined && status !== "rejected") {
    items.push({ key: "latency", node: <span className="tabular-nums">{formatLatency(latencyMs)}</span> });
  }
  if (dataAgeMs !== null && dataAgeMs !== undefined && status === "ok") {
    items.push({ key: "age", node: <span className="tabular-nums">data age {formatAge(dataAgeMs)}</span> });
  }
  if (requestId) {
    items.push({ key: "id", node: <span className="font-mono text-[11px] tracking-tight">{requestId}</span> });
  }
  if (!items.length) {
    items.push({ key: "empty", node: <span>No requests yet</span> });
  }

  return (
    <div
      className={cn(
        "flex min-h-5 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-muted-foreground",
        className,
      )}
      data-status={status}
    >
      {items.map((item, i) => (
        <span key={item.key} className="inline-flex min-w-0 items-center gap-1.5">
          {i > 0 && <Separator />}
          {item.node}
        </span>
      ))}
    </div>
  );
}
