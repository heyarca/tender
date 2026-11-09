"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";

import { Badge, StatusDot, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table";
import type { QualificationStatus } from "@/lib/tender";

import type { MarketSectionProps } from "../market-ui";

interface LiveProviderRow {
  id: string; name: string; status: QualificationStatus; rank: number | null; reasons: { message: string }[];
  measured: { ok: boolean; latency_ms: number; value: number | null; data_age_ms: number | null; error?: string; deviation_from_median: number | null };
  rolling: { samples: number; p95_latency_ms: number; success_rate: number };
}
interface LiveResult {
  contract: string; unit: string; measured_at: string;
  served_by: { provider: string; name: string; value: number | null; route_reason: string } | null;
  consensus: { median: number | null; spread: number | null; providers_ok: number; providers_total: number };
  providers: LiveProviderRow[];
}

const STATUS_TONE: Record<QualificationStatus, BadgeTone> = {
  eligible: "positive", unavailable: "negative", unreliable: "negative", "over-budget": "warning", "too-slow": "warning", "stale-data": "warning",
};
const STATUS_LABEL: Record<QualificationStatus, string> = {
  eligible: "Eligible", unavailable: "Unavailable", unreliable: "Unreliable", "over-budget": "Over budget", "too-slow": "Too slow", "stale-data": "Stale data",
};

function value(v: number | null, unit: string) {
  if (v == null) return "—";
  return unit === "USD" ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${v.toFixed(1)}${unit}`;
}
function age(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

/** Real upstreams, probed in parallel through `/api/v1/live/{market}` and routed by the shared engine. */
export function LiveSection({ marketId }: MarketSectionProps) {
  const [result, setResult] = useState<LiveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const inflight = useRef(false);

  const probe = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/live/${marketId}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setResult(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [marketId]);

  // Kick off the first probe after mount; probe() sets state asynchronously.
  useEffect(() => { const t = setTimeout(() => void probe(), 0); return () => clearTimeout(t); }, [probe]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => void probe(), 5000);
    return () => clearInterval(t);
  }, [auto, probe]);

  const unit = result?.unit ?? "";
  return (
    <Section
      id="live"
      icon={<Radio />}
      title="Live providers"
      description="The same contract fetched from every upstream in parallel. Latency, data age and success rate are measured on each call; the routing policy picks who serves."
      actions={
        <>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={auto} onCheckedChange={setAuto} aria-label="Probe every 5 seconds" />
            Every 5 s
          </label>
          <Button variant="outline" size="sm" onClick={() => void probe()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : undefined} />
            Probe now
          </Button>
        </>
      }
      framed={false}
    >
      {result ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            Served by <span className="font-medium text-foreground">{result.served_by?.name ?? "No eligible provider"}</span>
            {result.served_by ? <> · <span className="font-medium tabular-nums text-foreground">{value(result.served_by.value, unit)}</span> · {result.served_by.route_reason}</> : null}
          </span>
          <span className="tabular-nums">Median {value(result.consensus.median, unit)} · spread {result.consensus.spread == null ? "—" : value(result.consensus.spread, unit)}</span>
          <span className="tabular-nums">{result.consensus.providers_ok}/{result.consensus.providers_total} responded</span>
          <span className="font-mono">{result.contract}</span>
        </div>
      ) : null}
      {error ? <p className="mb-3 text-xs text-negative-text">Probe failed: {error}</p> : null}
      <Table density="compact">
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead align="right">Value</TableHead>
            <TableHead align="right">vs median</TableHead>
            <TableHead align="right">Latency</TableHead>
            <TableHead align="right">P95 (rolling)</TableHead>
            <TableHead align="right">Data age</TableHead>
            <TableHead align="right">Success</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(result?.providers ?? []).map((p) => (
            <TableRow key={p.id}>
              <TableRowHeader>
                <span className="flex items-center gap-2">
                  <StatusDot tone={p.id === result?.served_by?.provider ? "active" : p.measured.ok ? "positive" : "negative"} label={p.measured.ok ? "Responded" : "Failed"} />
                  {p.name}
                  {p.id === result?.served_by?.provider ? <Badge tone="active">Serving</Badge> : null}
                </span>
              </TableRowHeader>
              <TableCell numeric>{value(p.measured.value, unit)}</TableCell>
              <TableCell numeric>{p.measured.deviation_from_median == null ? "—" : `${p.measured.deviation_from_median >= 0 ? "+" : ""}${p.measured.deviation_from_median.toFixed(2)}`}</TableCell>
              <TableCell numeric>{p.measured.latency_ms} ms</TableCell>
              <TableCell numeric>{p.rolling.p95_latency_ms} ms</TableCell>
              <TableCell numeric>{age(p.measured.data_age_ms)}</TableCell>
              <TableCell numeric>{(p.rolling.success_rate * 100).toFixed(0)}% <span className="text-muted-foreground">/{p.rolling.samples}</span></TableCell>
              <TableCell>
                <span title={p.measured.error ?? p.reasons.map((r) => r.message).join(" · ")}>
                  <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                </span>
              </TableCell>
            </TableRow>
          ))}
          {!result ? (
            <TableRow><TableCell colSpan={8} className="text-muted-foreground">{loading ? "Probing providers…" : "No probe yet"}</TableCell></TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Section>
  );
}
