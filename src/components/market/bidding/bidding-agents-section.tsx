"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import {
  AUTO_ROUND_INTERVAL_MS,
  BIDDING_MODEL,
  buildRoundInput,
  type BiddingRoundError,
  type BiddingRoundResult,
} from "@/lib/bidding";
import { format, getMarketDefinition, type MarketId } from "@/lib/tender";
import { useTenderActions, useTenderSelector, useTenderStore } from "@/lib/tender/client";

import { BidHistoryGrid } from "./bid-history-grid";

interface RoundState {
  pending: boolean;
  last: BiddingRoundResult | null;
  error: string | null;
}

/** Run bidding rounds for a market: manual "Rebid now", plus one round every 45 s while auto-run is on. */
function useBiddingRounds(marketId: MarketId) {
  const store = useTenderStore();
  const actions = useTenderActions();
  const autoRun = useTenderSelector((state) => state.markets[marketId]?.autoRun ?? false);
  const [state, setState] = useState<RoundState>({ pending: false, last: null, error: null });
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const running = useRef(false);

  const run = useCallback(async () => {
    const market = store.api.getState().markets[marketId];
    if (!market || running.current) return;
    running.current = true;
    setState((s) => ({ ...s, pending: true, error: null }));
    try {
      const response = await fetch("/api/bidding/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRoundInput(market)),
      });
      const body = (await response.json()) as BiddingRoundResult | BiddingRoundError;
      if (!response.ok || "error" in body) {
        const message = "error" in body ? body.error.message : `The bidding round failed (HTTP ${response.status}).`;
        setState((s) => ({ ...s, pending: false, error: message }));
        return;
      }
      const updates = body.bids
        .filter((b) => b.changed && b.reason)
        .map((b) => ({ providerId: b.providerId, from: b.previousBid, bid: b.bid, reason: b.reason! }));
      if (updates.length) actions.applyAgentBids(marketId, updates, body.model);
      setState({ pending: false, last: body, error: null });
    } catch (error) {
      setState((s) => ({ ...s, pending: false, error: error instanceof Error ? error.message : "The bidding round failed." }));
    } finally {
      running.current = false;
      setFinishedAt(Date.now());
    }
  }, [actions, marketId, store]);

  useEffect(() => {
    if (!autoRun) return;
    const wait = finishedAt === null ? AUTO_ROUND_INTERVAL_MS : Math.max(0, finishedAt + AUTO_ROUND_INTERVAL_MS - Date.now());
    const timer = setTimeout(() => void run(), wait);
    return () => clearTimeout(timer);
  }, [autoRun, finishedAt, run]);

  return { ...state, autoRun, run };
}

export function BiddingAgentsSection({ marketId }: { marketId: MarketId }) {
  const { pending, last, error, autoRun, run } = useBiddingRounds(marketId);
  const { timeZone } = getMarketDefinition(marketId);
  const changed = last?.bids.filter((b) => b.changed) ?? [];

  return (
    <Section
      id="bidding"
      icon={<Bot aria-hidden="true" />}
      title="Bidding agents"
      description="Each provider has an agent that reprices its bid from recent wins and rival bids. Bids stay between 70% and 150% of the listed bid. Every change lands in the bid history below."
      actions={
        <Button variant="outline" size="sm" onClick={() => void run()} disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <Sparkles aria-hidden="true" />}
          Rebid now
        </Button>
      }
      framed={false}
      data-market={marketId}
    >
      <div className="flex flex-col gap-3 text-xs">
        <div aria-live="polite" className="flex flex-col gap-3">
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
            <div className="flex gap-1.5">
              <dt>Last round</dt>
              <dd className="text-foreground tabular-nums">
                {last ? format.time(last.at, timeZone, { seconds: true }) : "None yet"}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Model</dt>
              <dd className="font-mono text-foreground">{last?.model ?? BIDDING_MODEL}</dd>
            </div>
            {last ? (
              <div className="flex gap-1.5">
                <dt>Took</dt>
                <dd className="text-foreground tabular-nums">{(last.latencyMs / 1000).toFixed(1)} s</dd>
              </div>
            ) : null}
            <div className="flex gap-1.5">
              <dt>Auto rounds</dt>
              <dd className="text-foreground">{autoRun ? "Every 45 s while auto-run is on" : "Off (turn on auto-run)"}</dd>
            </div>
          </dl>
          {pending ? (
            <p className="text-muted-foreground">Agents are bidding…</p>
          ) : error ? (
            <p className="text-negative-text">{error}</p>
          ) : last ? (
            <p className="text-muted-foreground">
              {changed.length
                ? `${changed.length} of ${last.bids.length} agents changed their bids in the last round.`
                : "No agent changed its bid in the last round."}
            </p>
          ) : null}
        </div>
        <BidHistoryGrid marketId={marketId} />
      </div>
    </Section>
  );
}
