/**
 * Routing state machine (SPEC §4.2).
 *
 * Automatic mode:
 * 1. Failover — the active provider stops qualifying → switch to rank 1 now.
 * 2. Operator change — policy/mode edits re-route immediately.
 * 3. Optimization — another provider outranks the active one after a bid or
 *    condition change → switch only after `SWITCH_COOLDOWN_MS` since the last
 *    switch; until then keep a pending switch that the clock tick executes.
 * 4. No eligible provider → route is `null`; requests are rejected.
 *
 * Pinned mode never switches by itself; violations are surfaced once per
 * distinct set of failing checks.
 */
import {
  failureText,
  noEligibleEntry,
  outrankText,
  pinRecoveredEntry,
  pinViolationEntry,
  providerName,
  routeSwitchEntry,
  switchCancelledEntry,
  switchScheduledEntry,
} from "./activity";
import { SWITCH_COOLDOWN_MS } from "./constants";
import { pushActivity, type EntryFields, type StepContext } from "./context";
import { evaluateMarket } from "./evaluate";
import { getProviderFixture } from "./fixtures";
import type { MarketEvaluation, MarketState, ProviderId, RouteState, RouteTrigger } from "./types";

/** Why the route is being reconciled. */
export type ReconcileCause =
  /** Operator edits (policy, mode, reset policy, switch now) re-route immediately. */
  | { kind: "operator"; trigger: Extract<RouteTrigger, "policy-change" | "mode-change" | "operator-switch" | "restored">; text: string }
  /** Provider bid/condition edits (cooldown applies to optimization switches). */
  | { kind: "conditions" }
  /** Monitor tick re-evaluation. */
  | { kind: "monitor" }
  /** Clock tick (executes a due pending switch). */
  | { kind: "tick" };

/** Evaluate the market's providers against its policy. */
export function evaluateMarketState(market: MarketState): MarketEvaluation {
  return evaluateMarket(
    market.providers.map((p) => ({
      id: p.id,
      name: getProviderFixture(market.id, p.id)?.name ?? p.id,
      conditions: p.conditions,
    })),
    market.policy,
  );
}

function conditionsOf(market: MarketState, providerId: ProviderId) {
  return market.providers.find((p) => p.id === providerId)!.conditions;
}

function switchTo(
  market: MarketState,
  ctx: StepContext,
  evaluation: MarketEvaluation,
  toId: ProviderId,
  trigger: RouteTrigger,
  triggerText: string,
  extra: EntryFields[] = [],
): MarketState {
  const route: RouteState = {
    ...market.route,
    activeProviderId: toId,
    since: ctx.now,
    lastSwitchAt: ctx.now,
    pending: null,
  };
  const entry = routeSwitchEntry({
    marketId: market.id,
    policy: market.policy,
    fromId: market.route.activeProviderId,
    toId,
    toConditions: conditionsOf(market, toId),
    toEvaluation: evaluation.byId[toId],
    trigger,
    triggerText,
  });
  return pushActivity(ctx, { ...market, route }, ...extra, entry);
}

function reconcileAuto(market: MarketState, ctx: StepContext, cause: ReconcileCause, evaluation: MarketEvaluation): MarketState {
  const route: RouteState = market.route.pinViolation ? { ...market.route, pinViolation: null } : market.route;
  market = route === market.route ? market : { ...market, route };
  const activeId = route.activeProviderId;
  const recommendedId = evaluation.recommendedId;
  const operatorText = cause.kind === "operator" ? cause.text : undefined;

  // 4. No eligible provider.
  if (recommendedId === null) {
    if (activeId === null) {
      return route.pending ? { ...market, route: { ...route, pending: null } } : market;
    }
    const reasons = evaluation.byId[activeId]?.reasons ?? [];
    return pushActivity(
      ctx,
      { ...market, route: { ...route, activeProviderId: null, since: ctx.now, lastSwitchAt: ctx.now, pending: null } },
      noEligibleEntry(market.id, activeId, reasons, operatorText),
    );
  }

  // Recovery from no route (or first route after an operator change).
  if (activeId === null) {
    const trigger: RouteTrigger = cause.kind === "operator" ? cause.trigger : "recovery";
    const text = operatorText ?? `${providerName(market.id, recommendedId)} meets your policy again`;
    return switchTo(market, ctx, evaluation, recommendedId, trigger, text);
  }

  // 1. Failover: the active provider stopped qualifying.
  const active = evaluation.byId[activeId];
  if (!active || !active.qualifies) {
    const failure = `${providerName(market.id, activeId)} ${failureText(active?.reasons ?? [])}`;
    if (cause.kind === "operator") {
      return switchTo(market, ctx, evaluation, recommendedId, cause.trigger, `${cause.text}. ${failure}`);
    }
    return switchTo(market, ctx, evaluation, recommendedId, "failover", failure);
  }

  // Active is still the best provider: cancel any pending switch.
  if (recommendedId === activeId) {
    if (!route.pending) return market;
    return pushActivity(
      ctx,
      { ...market, route: { ...route, pending: null } },
      switchCancelledEntry(market.id, route.pending.providerId, activeId),
    );
  }

  // 2. Operator change: immediate.
  if (cause.kind === "operator") {
    return switchTo(market, ctx, evaluation, recommendedId, cause.trigger, cause.text);
  }

  // 3. Optimization: respect the cooldown.
  const reason = outrankText(
    market.id,
    market.policy.preference,
    recommendedId,
    conditionsOf(market, recommendedId),
    activeId,
    conditionsOf(market, activeId),
  );
  const dueAt = route.lastSwitchAt + SWITCH_COOLDOWN_MS;
  if (ctx.now >= dueAt) {
    return switchTo(market, ctx, evaluation, recommendedId, "optimization", reason);
  }
  if (route.pending && route.pending.providerId === recommendedId) return market;
  return pushActivity(
    ctx,
    { ...market, route: { ...route, pending: { providerId: recommendedId, executeAt: dueAt, scheduledAt: ctx.now } } },
    switchScheduledEntry(market.id, activeId, recommendedId, dueAt, ctx.now, reason),
  );
}

function reconcilePinned(
  market: MarketState,
  ctx: StepContext,
  cause: ReconcileCause,
  evaluation: MarketEvaluation,
  pinnedId: ProviderId,
): MarketState {
  const pinned = evaluation.byId[pinnedId];
  if (!pinned) return market;
  if (market.route.pending) market = { ...market, route: { ...market.route, pending: null } };

  if (market.route.activeProviderId !== pinnedId) {
    const trigger: RouteTrigger = cause.kind === "operator" ? cause.trigger : "mode-change";
    const text = cause.kind === "operator" ? cause.text : `Pinned to ${providerName(market.id, pinnedId)}`;
    market = switchTo(market, ctx, evaluation, pinnedId, trigger, text);
  }

  if (!pinned.qualifies) {
    const key = pinned.reasons.map((r) => r.check).join(",");
    const current = market.route.pinViolation;
    if (current && current.providerId === pinnedId && current.key === key) return market;
    return pushActivity(
      ctx,
      { ...market, route: { ...market.route, pinViolation: { providerId: pinnedId, key } } },
      pinViolationEntry(market.id, pinnedId, pinned.reasons, evaluation.recommendedId),
    );
  }
  if (market.route.pinViolation && market.route.pinViolation.providerId !== pinnedId) {
    // A different provider is pinned now; the old violation no longer applies.
    return { ...market, route: { ...market.route, pinViolation: null } };
  }
  if (market.route.pinViolation) {
    return pushActivity(
      ctx,
      { ...market, route: { ...market.route, pinViolation: null } },
      pinRecoveredEntry(market.id, pinnedId),
    );
  }
  return market;
}

/**
 * Re-evaluate the market and apply the routing rules. Returns the same market
 * object when nothing changes.
 */
export function reconcileRoute(market: MarketState, ctx: StepContext, cause: ReconcileCause): MarketState {
  const evaluation = evaluateMarketState(market);
  const mode = market.policy.mode;
  if (mode.kind === "pinned") return reconcilePinned(market, ctx, cause, evaluation, mode.providerId);
  return reconcileAuto(market, ctx, cause, evaluation);
}

/** Whether a pending switch is due at `now`. */
export function isPendingDue(market: MarketState, now: number): boolean {
  return market.route.pending !== null && market.route.pending.executeAt <= now;
}
