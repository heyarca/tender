import {
  PREFERENCE_LABELS,
  SWITCH_COOLDOWN_MS,
  type MarketView,
  type ProviderId,
  type ProviderRow,
  type Tone,
} from "@/lib/tender";

/** What an operator edit changed: eligibility and the route, as short product copy. */
export interface ChangeNote {
  tone: Tone;
  lines: string[];
  /** `decisionFingerprint` of the view right after the change. */
  fingerprint: string;
}

const TONE_RANK: Record<Tone, number> = { neutral: 0, positive: 1, warning: 2, negative: 3 };

/** "Fernline", "Fernline and Mossgate", "Fernline, Mossgate and Owlbridge". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const reasonsOf = (row: ProviderRow) => row.evaluation.reasons.map((reason) => reason.message).join("; ");
const qualifiedIds = (view: MarketView) =>
  new Set(view.providers.filter((row) => row.evaluation.qualifies).map((row) => row.id));

/**
 * Compare two views of the same market around one operator action and explain
 * the effect: the focused provider's qualification, other providers that
 * gained or lost eligibility, and what happened to the route.
 */
export function describeMarketChange(before: MarketView, after: MarketView, focusId?: ProviderId | null): ChangeNote {
  const lines: string[] = [];
  let tone: Tone = "neutral";
  const raise = (next: Tone) => {
    if (TONE_RANK[next] > TONE_RANK[tone]) tone = next;
  };
  const nameOf = (id: ProviderId) => after.providersById[id]?.name ?? before.providersById[id]?.name ?? id;

  const focusBefore = focusId ? before.providersById[focusId] : undefined;
  const focusAfter = focusId ? after.providersById[focusId] : undefined;
  if (focusBefore && focusAfter) {
    const was = focusBefore.evaluation.qualifies;
    const is = focusAfter.evaluation.qualifies;
    if (was && !is) {
      lines.push(`${focusAfter.name} no longer qualifies: ${reasonsOf(focusAfter)}.`);
      raise("warning");
    } else if (!was && is) {
      lines.push(`${focusAfter.name} now qualifies.`);
      raise("positive");
    } else if (!is && reasonsOf(focusAfter) !== reasonsOf(focusBefore)) {
      lines.push(`${focusAfter.name} is still excluded: ${reasonsOf(focusAfter)}.`);
    }
  }

  const wasQualified = qualifiedIds(before);
  const isQualified = qualifiedIds(after);
  const others = after.providers.filter((row) => row.id !== focusId);
  const gained = others.filter((row) => isQualified.has(row.id) && !wasQualified.has(row.id)).map((row) => row.name);
  const lost = others.filter((row) => !isQualified.has(row.id) && wasQualified.has(row.id)).map((row) => row.name);
  if (gained.length) {
    lines.push(`${joinNames(gained)} now ${gained.length === 1 ? "qualifies" : "qualify"}.`);
    raise("positive");
  }
  if (lost.length) {
    lines.push(`${joinNames(lost)} no longer ${lost.length === 1 ? "qualifies" : "qualify"}.`);
    raise("warning");
  }

  const fromId = before.route.activeProviderId;
  const toId = after.route.activeProviderId;
  const pinnedFailing = after.decision.kind === "pinned-failing";
  let routeLine = false;
  if (fromId !== toId) {
    routeLine = true;
    if (!toId) {
      lines.push("No eligible provider. Requests are rejected until a provider qualifies.");
      raise("negative");
    } else if (!fromId) {
      lines.push(`Route restored: requests go to ${nameOf(toId)}.`);
      raise(pinnedFailing ? "negative" : "positive");
    } else {
      const ranksFirst = after.route.mode.kind === "auto" && after.recommended?.id === toId;
      const why = ranksFirst
        ? `, which ranks first for ${PREFERENCE_LABELS[after.policy.preference].toLowerCase()}`
        : "";
      lines.push(`Route switched from ${nameOf(fromId)} to ${nameOf(toId)}${why}.`);
      raise(pinnedFailing ? "negative" : "positive");
    }
  }

  if (pinnedFailing && (before.decision.kind !== "pinned-failing" || fromId !== toId)) {
    lines.push(after.decision.summary);
    raise("negative");
    routeLine = true;
  } else if (!pinnedFailing && before.decision.kind === "pinned-failing" && after.decision.kind === "pinned" && toId) {
    lines.push(`Pinned provider ${nameOf(toId)} meets your policy again.`);
    raise("positive");
    routeLine = true;
  }

  const pendingBefore = before.route.pending;
  const pendingAfter = after.route.pending;
  if (pendingAfter && pendingAfter.providerId !== pendingBefore?.providerId) {
    lines.push(
      `${pendingAfter.providerName} now ranks first. The route switches when the ${SWITCH_COOLDOWN_MS / 1000} s cooldown ends.`,
    );
    raise("positive");
    routeLine = true;
  } else if (pendingBefore && !pendingAfter && fromId === toId) {
    lines.push(`Scheduled switch to ${pendingBefore.providerName} cancelled.`);
    routeLine = true;
  }

  if (!routeLine) {
    if (toId) lines.push(`Route unchanged: ${nameOf(toId)} keeps serving.`);
    else {
      lines.push("Still no eligible provider. Requests are rejected.");
      raise("negative");
    }
  }
  return { tone, lines, fingerprint: decisionFingerprint(after) };
}

/**
 * Fingerprint of everything that decides eligibility and the route: policy,
 * provider conditions, the serving provider, and a pending switch. Monitor
 * samples and requests do not change it, so a change note stays visible until
 * something it describes changes.
 */
export function decisionFingerprint(view: MarketView): string {
  const conditions = [...view.providers]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((row) => [row.id, row.conditions]);
  return JSON.stringify([view.policy, conditions, view.route.activeProviderId, view.route.pending?.providerId ?? null]);
}
