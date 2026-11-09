/**
 * Mutable counters for one reducer step. The engine creates a context from the
 * state, market-level functions advance it, and the engine writes it back.
 */
import type { ActivityEntry, MarketState } from "./types";
import { ACTIVITY_LIMIT } from "./constants";

export interface StepContext {
  /** Time of the action (ms). */
  now: number;
  /** Next activity sequence number. */
  activitySeq: number;
  /** Next request sequence number. */
  requestSeq: number;
  /** Whether new activity entries should raise toasts. */
  notify: boolean;
}

/** Fields every builder fills; `id`, `seq`, `marketId`, `at`, `notify` come from the context. */
export type EntryFields<E extends ActivityEntry = ActivityEntry> = E extends ActivityEntry
  ? Omit<E, "id" | "seq" | "marketId" | "at" | "notify"> & { notify?: boolean; at?: number }
  : never;

const pad = (value: number) => String(value).padStart(6, "0");

/** Request id for a sequence number: `formatRequestId(123)` → "req_000123". */
export function formatRequestId(seq: number): string {
  return `req_${pad(seq)}`;
}

/** Allocate the next request id (`req_000123`). */
export function nextRequestId(ctx: StepContext): string {
  const id = formatRequestId(ctx.requestSeq);
  ctx.requestSeq += 1;
  return id;
}

/** Turn builder fields into a full entry with the next activity id. */
export function stampEntry(ctx: StepContext, market: MarketState, fields: EntryFields): ActivityEntry {
  const seq = ctx.activitySeq;
  ctx.activitySeq += 1;
  return {
    ...fields,
    id: `act_${pad(seq)}`,
    seq,
    marketId: market.id,
    at: fields.at ?? ctx.now,
    notify: ctx.notify && (fields.notify ?? false),
  } as ActivityEntry;
}

/** Prepend entries (given oldest first) to the market's newest-first log. */
export function pushActivity(ctx: StepContext, market: MarketState, ...entries: EntryFields[]): MarketState {
  if (!entries.length) return market;
  const stamped = entries.map((fields) => stampEntry(ctx, market, fields)).reverse();
  return { ...market, activity: [...stamped, ...market.activity].slice(0, ACTIVITY_LIMIT) };
}
