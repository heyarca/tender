/**
 * Activity entry builders with final product copy (SPEC §4.2–4.4).
 * Builders return `EntryFields`; `pushActivity` stamps ids and timestamps.
 */
import { getContract, readField } from "@/lib/registry";
import type { EntryFields } from "./context";
import { CHECK_LABELS, PREFERENCE_LABELS, qualificationLines, STATUS_LABELS } from "./evaluate";
import { getProviderFixture, MARKETS } from "./markets";
import * as format from "./format";
import type {
  ConditionChange,
  ExclusionReason,
  FieldsPayload,
  MarketId,
  PolicyChange,
  ProviderConditions,
  ProviderEvaluation,
  ProviderId,
  QualificationStatus,
  RequestResult,
  RequestSource,
  RouteTrigger,
  RoutingMode,
  RoutingPolicy,
  RoutingPreference,
} from "./types";

/** Display name of a provider (falls back to the id). */
export function providerName(marketId: MarketId, providerId: ProviderId | null): string {
  if (!providerId) return "No provider";
  return getProviderFixture(marketId, providerId)?.name ?? providerId;
}

/**
 * Data age in the market's display unit: ms-unit markets (BTC) keep millisecond
 * precision for sub-minute ages ("1,010 ms", not "1 s"); other markets use
 * `format.dataAge` ("6 min").
 */
function marketDataAge(marketId: MarketId, ms: number): string {
  return MARKETS[marketId].units.dataAge === "ms" && ms < 60_000 ? `${format.count(ms)} ms` : format.dataAge(ms);
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** Lowercase the first letter unless it starts an acronym ("P95 latency" stays). */
const lowerFirst = (text: string) => (/^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text);

/** "failed the latency check: P95 640 ms exceeds 400 ms" (all failing checks). */
export function failureText(reasons: readonly ExclusionReason[]): string {
  if (!reasons.length) return "no longer meets your policy";
  const checks = joinWords(reasons.map((r) => CHECK_LABELS[r.check]));
  const plural = reasons.length > 1 ? "checks" : "check";
  return `failed the ${checks} ${plural}: ${reasons.map((r) => r.message).join("; ")}`;
}

/** Copy for a policy field change: "Max P95 latency 400 ms → 200 ms". */
export function policyChangeText(marketId: MarketId, change: PolicyChange): string {
  switch (change.field) {
    case "maxPrice":
      return `Max price ${format.price(change.from as number)} → ${format.price(change.to as number)} /M`;
    case "maxP95LatencyMs":
      return `Max P95 latency ${format.latency(change.from as number)} → ${format.latency(change.to as number)}`;
    case "maxDataAgeMs":
      return `Max data age ${marketDataAge(marketId, change.from as number)} → ${marketDataAge(marketId, change.to as number)}`;
    case "minSuccessRate":
      return `Min success rate ${format.percent(change.from as number)} → ${format.percent(change.to as number)}`;
    case "preference":
      return `Preference ${PREFERENCE_LABELS[change.from as RoutingPreference]} → ${PREFERENCE_LABELS[change.to as RoutingPreference]}`;
  }
}

function conditionValue(field: keyof ProviderConditions, value: number | boolean): string {
  switch (field) {
    case "bidPrice":
      return format.price(value as number);
    case "p95LatencyMs":
      return format.latency(value as number);
    case "dataAgeMs":
      return format.dataAge(value as number);
    case "errorRate":
      return format.errorRate(value as number);
    case "available":
      return value ? "available" : "unavailable";
  }
}

const CONDITION_LABELS: Record<keyof ProviderConditions, string> = {
  bidPrice: "bid",
  p95LatencyMs: "P95 latency",
  dataAgeMs: "data age",
  errorRate: "error rate",
  available: "availability",
};

/** Copy for a condition change: "P95 latency changed from 640 ms to 350 ms". */
export function conditionChangeText(change: ConditionChange): string {
  if (change.field === "available") return change.to ? "Marked available" : "Marked unavailable";
  const unit = change.field === "bidPrice" ? " /M" : "";
  const label = CONDITION_LABELS[change.field];
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} changed from ${conditionValue(change.field, change.from)} to ${conditionValue(change.field, change.to)}${unit}`;
}

function statusLine(name: string, before: QualificationStatus, after: QualificationStatus): string[] {
  return before === after ? [] : [`${name} status: ${STATUS_LABELS[before]} → ${STATUS_LABELS[after]}`];
}

/** Entry for a provider condition edit (bid-only edits get the `bid-updated` kind). */
export function conditionsEntry(
  marketId: MarketId,
  providerId: ProviderId,
  changes: ConditionChange[],
  statusBefore: QualificationStatus,
  statusAfter: QualificationStatus,
): EntryFields {
  const name = providerName(marketId, providerId);
  const status = statusLine(name, statusBefore, statusAfter);
  if (changes.length === 1 && changes[0].field === "bidPrice") {
    const change = changes[0];
    return {
      kind: "bid-updated",
      providerId,
      from: change.from as number,
      to: change.to as number,
      title: `${name} bid changed from ${format.price(change.from as number)} to ${format.price(change.to as number)} /M`,
      details: status,
      tone: "neutral",
    };
  }
  if (changes.length === 1 && changes[0].field === "available") {
    return {
      kind: "conditions-updated",
      providerId,
      changes,
      title: changes[0].to ? `${name} is available again` : `${name} marked unavailable`,
      details: status,
      tone: changes[0].to ? "positive" : "negative",
    };
  }
  const lines = changes.map(conditionChangeText);
  return {
    kind: "conditions-updated",
    providerId,
    changes,
    title: changes.length === 1 ? `${name} ${lowerFirst(lines[0])}` : `${name} conditions updated`,
    details: [...(changes.length === 1 ? [] : lines), ...status],
    tone: "neutral",
  };
}

/** Lowercase a leading pronoun or article so the reason reads as a clause after a colon. */
function reasonClause(reason: string): string {
  const text = reason.trim().replace(/\s+/g, " ");
  const clause = /^(It|Its|It's|The|A|An|No|Nobody)\b/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
  return /[.!?]$/.test(clause) ? clause : `${clause}.`;
}

/**
 * Entry for a bid set by a provider's bidding agent:
 * "Kitefin lowered its bid from $22.00 to $19.50: it lost the last 5 requests to Fernline."
 */
export function agentBidEntry(
  marketId: MarketId,
  providerId: ProviderId,
  from: number,
  to: number,
  reason: string,
  model: string,
  statusBefore: QualificationStatus,
  statusAfter: QualificationStatus,
): EntryFields {
  const name = providerName(marketId, providerId);
  const verb = to < from ? "lowered" : "raised";
  return {
    kind: "bid-updated",
    providerId,
    from,
    to,
    agent: { reason, model },
    title: `${name} ${verb} its bid from ${format.price(from)} to ${format.price(to)}: ${reasonClause(reason)}`,
    details: statusLine(name, statusBefore, statusAfter),
    tone: "neutral",
  };
}

export function providerRestoredEntry(marketId: MarketId, providerId: ProviderId, changes: ConditionChange[]): EntryFields {
  return {
    kind: "provider-restored",
    providerId,
    title: `${providerName(marketId, providerId)} restored to default conditions`,
    details: changes.map(conditionChangeText),
    tone: "neutral",
  };
}

export function conditionsResetEntry(restoredProviderIds: ProviderId[], marketId: MarketId): EntryFields {
  const names = restoredProviderIds.map((id) => providerName(marketId, id));
  return {
    kind: "conditions-reset",
    title: "Provider conditions reset to defaults",
    details: names.length ? [`Restored ${joinWords(names)}.`] : [],
    tone: "neutral",
  };
}

export function policyUpdatedEntry(marketId: MarketId, changes: PolicyChange[]): EntryFields {
  const lines = changes.map((change) => policyChangeText(marketId, change));
  return {
    kind: "policy-updated",
    changes,
    title: changes.length === 1 ? `Policy updated: ${lowerFirst(lines[0])}` : "Routing policy updated",
    details: changes.length === 1 ? [] : lines,
    tone: "neutral",
  };
}

export function policyResetEntry(marketId: MarketId, changes: PolicyChange[], modeReset: boolean): EntryFields {
  return {
    kind: "policy-reset",
    title: "Routing policy reset to defaults",
    details: [
      ...changes.map((change) => policyChangeText(marketId, change)),
      ...(modeReset ? ["Automatic switching turned on"] : []),
    ],
    tone: "neutral",
  };
}

export function policyRestoredEntry(): EntryFields {
  return {
    kind: "policy-restored",
    title: "Saved routing policy restored",
    details: [],
    tone: "neutral",
  };
}

export function modeChangedEntry(marketId: MarketId, mode: RoutingMode): EntryFields {
  return {
    kind: "mode-changed",
    mode,
    title:
      mode.kind === "auto"
        ? "Automatic switching turned on"
        : `Pinned requests to ${providerName(marketId, mode.providerId)}`,
    details:
      mode.kind === "auto"
        ? ["Tender routes each request to the top-ranked provider that meets your policy."]
        : [`Requests always go to ${providerName(marketId, mode.providerId)}. Tender will not switch without your permission.`],
    tone: "neutral",
  };
}

export function autoRunEntry(enabled: boolean): EntryFields {
  return {
    kind: "auto-run",
    enabled,
    title: enabled ? "Auto-run turned on" : "Auto-run turned off",
    details: enabled ? ["Runs one request every 2 s."] : [],
    tone: "neutral",
  };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** Why rank 1 was selected, as one sentence: "Fernline is the lowest-priced provider that meets your policy." */
export function recommendedSummaryText(preference: RoutingPreference, name: string): string {
  switch (preference) {
    case "lowest-cost":
      return `${name} is the lowest-priced provider that meets your policy.`;
    case "lowest-latency":
      return `${name} has the lowest P95 latency among providers that meet your policy.`;
    case "freshest-data":
      return `${name} has the freshest data among providers that meet your policy.`;
  }
}

/** No-eligible copy shared by the decision callout, activity, and server responses. */
export const NO_ELIGIBLE_TEXT = "No provider meets your policy. Requests are rejected and nothing is sent.";

/** Copy for "B now ranks above A" on the preference's primary key. */
export function outrankText(
  marketId: MarketId,
  preference: RoutingPreference,
  toId: ProviderId,
  to: ProviderConditions,
  fromId: ProviderId,
  from: ProviderConditions,
): string {
  const toName = providerName(marketId, toId);
  const fromName = providerName(marketId, fromId);
  const basis = lowerFirst(PREFERENCE_LABELS[preference]);
  let compare: string;
  switch (preference) {
    case "lowest-cost":
      compare = `bid ${format.price(to.bidPrice)} vs ${format.price(from.bidPrice)} /M`;
      break;
    case "lowest-latency":
      compare = `P95 ${format.latency(to.p95LatencyMs)} vs ${format.latency(from.p95LatencyMs)}`;
      break;
    case "freshest-data":
      compare = `data age ${format.dataAge(to.dataAgeMs)} vs ${format.dataAge(from.dataAgeMs)}`;
      break;
  }
  return `${toName} now ranks above ${fromName} for ${basis} (${compare})`;
}

export interface RouteSwitchInput {
  marketId: MarketId;
  policy: RoutingPolicy;
  fromId: ProviderId | null;
  toId: ProviderId;
  toConditions: ProviderConditions;
  toEvaluation: ProviderEvaluation;
  trigger: RouteTrigger;
  /** One sentence, no trailing period needed. */
  triggerText: string;
}

const SWITCH_TONE: Record<RouteTrigger, "neutral" | "positive" | "warning"> = {
  failover: "warning",
  optimization: "positive",
  "policy-change": "neutral",
  "mode-change": "neutral",
  recovery: "positive",
  "operator-switch": "neutral",
  restored: "neutral",
};

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/**
 * Route switch entry: previous provider, new provider, trigger, and why the
 * replacement qualifies (all four checks with value vs limit).
 */
export function routeSwitchEntry(input: RouteSwitchInput): EntryFields {
  const { marketId, policy, fromId, toId, toConditions, toEvaluation } = input;
  const toName = providerName(marketId, toId);
  const fromName = fromId ? providerName(marketId, fromId) : null;
  const details = [`Trigger: ${sentence(input.triggerText)}`];
  if (toEvaluation.qualifies) {
    details.push(`${toName} qualifies: ${qualificationLines(toConditions, policy).join(" · ")}.`);
  } else {
    details.push(`${toName} fails your policy: ${toEvaluation.reasons.map((r) => r.message).join("; ")}.`);
  }
  if (policy.mode.kind === "pinned") {
    details.push(`Pinned: requests always go to ${toName}.`);
  } else if (toEvaluation.rank === 1) {
    details.push(`Selected: ranked first for ${lowerFirst(PREFERENCE_LABELS[policy.preference])}.`);
  }
  return {
    kind: "route-switch",
    fromProviderId: fromId,
    toProviderId: toId,
    trigger: input.trigger,
    title: fromName ? `Switched from ${fromName} to ${toName}` : `Routing to ${toName}`,
    details,
    tone: toEvaluation.qualifies ? SWITCH_TONE[input.trigger] : "negative",
    notify: true,
  };
}

export function routeEstablishedEntry(
  marketId: MarketId,
  toId: ProviderId,
  toConditions: ProviderConditions,
  policy: RoutingPolicy,
): EntryFields {
  const name = providerName(marketId, toId);
  return {
    kind: "route-established",
    toProviderId: toId,
    title: `Routing ${MARKETS[marketId].name} to ${name}`,
    details: [
      `${name} qualifies: ${qualificationLines(toConditions, policy).join(" · ")}.`,
      `Selected: ranked first for ${lowerFirst(PREFERENCE_LABELS[policy.preference])}.`,
    ],
    tone: "neutral",
  };
}

export function noEligibleEntry(
  marketId: MarketId,
  fromId: ProviderId | null,
  fromReasons: readonly ExclusionReason[],
  triggerText?: string,
  cancelledPendingId?: ProviderId | null,
): EntryFields {
  const details: string[] = [];
  if (triggerText) details.push(`Trigger: ${sentence(triggerText)}`);
  if (cancelledPendingId) details.push(`Scheduled switch to ${providerName(marketId, cancelledPendingId)} cancelled.`);
  if (fromId) details.push(`${providerName(marketId, fromId)} ${failureText(fromReasons)}.`);
  details.push(NO_ELIGIBLE_TEXT);
  return {
    kind: "no-eligible",
    fromProviderId: fromId,
    title: "No eligible provider",
    details,
    tone: "negative",
    notify: true,
  };
}

export function switchScheduledEntry(
  marketId: MarketId,
  fromId: ProviderId,
  toId: ProviderId,
  executeAt: number,
  now: number,
  reason: string,
): EntryFields {
  return {
    kind: "switch-scheduled",
    fromProviderId: fromId,
    toProviderId: toId,
    executeAt,
    title: `Switch to ${providerName(marketId, toId)} scheduled in ${format.countdown(executeAt, now)}`,
    details: [`${sentence(reason)}`, "Waiting for the 10 s switch cooldown."],
    tone: "neutral",
  };
}

export function switchCancelledEntry(marketId: MarketId, toId: ProviderId, activeId: ProviderId | null): EntryFields {
  return {
    kind: "switch-cancelled",
    toProviderId: toId,
    title: `Scheduled switch to ${providerName(marketId, toId)} cancelled`,
    details: activeId ? [`${providerName(marketId, activeId)} ranks first again.`] : [],
    tone: "neutral",
  };
}

/** Exact copy: "Pinned provider Fernline fails your policy: P95 640 ms exceeds 400 ms. Requests still go to Fernline." */
export function pinViolationText(marketId: MarketId, providerId: ProviderId, reasons: readonly ExclusionReason[]): string {
  const name = providerName(marketId, providerId);
  return `Pinned provider ${name} fails your policy: ${reasons.map((r) => r.message).join("; ")}. Requests still go to ${name}.`;
}

export function pinViolationEntry(
  marketId: MarketId,
  providerId: ProviderId,
  reasons: readonly ExclusionReason[],
  recommendedId: ProviderId | null,
): EntryFields {
  const name = providerName(marketId, providerId);
  const unavailable = reasons.some((r) => r.check === "availability");
  const details: string[] = [];
  if (unavailable) details.push(`Requests to ${name} fail until it responds again.`);
  details.push(
    recommendedId
      ? `Switch to ${providerName(marketId, recommendedId)} or use automatic switching.`
      : "Use automatic switching, or change your policy.",
  );
  return {
    kind: "pin-violation",
    providerId,
    reasons: reasons.map((r) => r.message),
    title: pinViolationText(marketId, providerId, reasons),
    details,
    tone: "negative",
    notify: true,
  };
}

export function pinRecoveredEntry(marketId: MarketId, providerId: ProviderId): EntryFields {
  return {
    kind: "pin-recovered",
    providerId,
    title: `Pinned provider ${providerName(marketId, providerId)} meets your policy again`,
    details: [],
    tone: "positive",
  };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

const MAX_SUMMARY = 80;

/** Primary field of a fields result: "Price $3.42", "AQI 61 US AQI", "Status scheduled". */
export function fieldsSummary(payload: FieldsPayload): string {
  const field = getContract(payload.contractId)?.output.find((f) => f.primary);
  if (!field) return "";
  const value = readField(payload.values, field.key);
  let text: string;
  if (typeof value === "number") {
    text =
      field.type === "money" && field.unit === "USD"
        ? format.usd(value)
        : `${format.number(value, field.type === "integer" ? 0 : Math.min(4, (String(value).split(".")[1] ?? "").length))}${field.unit ? ` ${field.unit}` : ""}`;
  } else if (typeof value === "string") {
    text = value.length > MAX_SUMMARY ? `${value.slice(0, MAX_SUMMARY - 1)}…` : value;
  } else if (typeof value === "boolean") {
    text = value ? "Yes" : "No";
  } else if (Array.isArray(value)) {
    text = `${value.length} ${value.length === 1 ? "item" : "items"}`;
  } else {
    text = "—";
  }
  return `${field.label} ${text}`;
}

/** Served / failed / rejected request line. */
export function requestEntry(result: RequestResult): EntryFields {
  if (result.status === "rejected") {
    return {
      kind: "request-rejected",
      requestId: result.requestId,
      title: `${result.requestId} rejected: no eligible provider`,
      details: ["Nothing was sent. No provider meets your policy."],
      tone: "negative",
    };
  }
  if (result.status === "failed") {
    return {
      kind: "request-failed",
      requestId: result.requestId,
      providerId: result.providerId,
      error: result.error,
      title: `${result.requestId} failed at ${result.providerName}`,
      details: [
        `${result.error.code} ${result.error.message} after ${format.latency(result.latencyMs)}`,
        ...(result.routingMode === "pinned" ? [`Pinned provider: the request was not rerouted.`] : []),
      ],
      tone: "negative",
    };
  }
  const value =
    result.payload.kind === "weather"
      ? `${format.temperature(result.payload.temperatureF)}, ${result.payload.condition}`
      : result.payload.kind === "btc"
        ? `${result.payload.pair} ${format.usd(result.payload.priceUsd)}`
        : fieldsSummary(result.payload);
  if (result.source) {
    return {
      kind: "request-served",
      requestId: result.requestId,
      providerId: result.providerId,
      latencyMs: result.latencyMs,
      cost: result.cost,
      source: result.source,
      title:
        result.source === "ask-tender"
          ? `Ask Tender bought ${shortRequestId(result.requestId)} from ${result.providerName} · ${format.cost(result.cost)} paid with credits`
          : `Bought ${shortRequestId(result.requestId)} from ${result.providerName} with credits · ${format.cost(result.cost)}`,
      details: [`${format.latency(result.latencyMs)} · data age ${format.dataAge(result.dataAgeMs)}`, value],
      tone: "neutral",
    };
  }
  return {
    kind: "request-served",
    requestId: result.requestId,
    providerId: result.providerId,
    latencyMs: result.latencyMs,
    cost: result.cost,
    title: `${result.requestId} served by ${result.providerName}`,
    details: [
      `${format.latency(result.latencyMs)} · data age ${format.dataAge(result.dataAgeMs)} · ${format.cost(result.cost)}`,
      value,
    ],
    tone: "neutral",
  };
}

/** Who bought a server-side request, as a short label. */
export const SOURCE_LABELS: Readonly<Record<RequestSource, string>> = {
  "ask-tender": "Ask Tender",
  credits: "Credits",
  usdc: "USDC",
};

/** Server request ids are `req_<uuid>`; activity titles show the first 8 characters of the uuid. */
function shortRequestId(requestId: string): string {
  return requestId.length > 16 ? `${requestId.slice(0, 12)}…` : requestId;
}
