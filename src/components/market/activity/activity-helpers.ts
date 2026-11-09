import type { ActivityEntry, ActivityKind, RouteTrigger } from "@/lib/tender";

export type ActivityFilter = "all" | "routing" | "requests" | "conditions" | "policy";

export const ACTIVITY_FILTERS: readonly { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "routing", label: "Routing" },
  { value: "requests", label: "Requests" },
  { value: "conditions", label: "Bids & conditions" },
  { value: "policy", label: "Policy" },
];

/** Filter group of every activity kind (each kind belongs to exactly one group). */
export const ACTIVITY_GROUP: Readonly<Record<ActivityKind, Exclude<ActivityFilter, "all">>> = {
  "route-established": "routing",
  "route-switch": "routing",
  "no-eligible": "routing",
  "switch-scheduled": "routing",
  "switch-cancelled": "routing",
  "pin-violation": "routing",
  "pin-recovered": "routing",
  "request-served": "requests",
  "request-failed": "requests",
  "request-rejected": "requests",
  "auto-run": "requests",
  "bid-updated": "conditions",
  "conditions-updated": "conditions",
  "provider-restored": "conditions",
  "conditions-reset": "conditions",
  "policy-updated": "policy",
  "policy-reset": "policy",
  "policy-restored": "policy",
  "mode-changed": "policy",
};

/** Entries of one filter group, keeping the feed order (newest first). */
export function filterActivity(entries: readonly ActivityEntry[], filter: ActivityFilter): ActivityEntry[] {
  if (filter === "all") return [...entries];
  return entries.filter((entry) => ACTIVITY_GROUP[entry.kind] === filter);
}

/** Number of entries per filter (for empty states and labels). */
export function countByFilter(entries: readonly ActivityEntry[]): Record<ActivityFilter, number> {
  const counts: Record<ActivityFilter, number> = { all: entries.length, routing: 0, requests: 0, conditions: 0, policy: 0 };
  for (const entry of entries) counts[ACTIVITY_GROUP[entry.kind]] += 1;
  return counts;
}

/** Entries shown by "Show more" pagination. */
export const ACTIVITY_PAGE_SIZE = 20;

export const TRIGGER_LABELS: Readonly<Record<RouteTrigger, string>> = {
  failover: "Failover",
  optimization: "Better offer",
  "policy-change": "Policy change",
  "mode-change": "Mode change",
  recovery: "Recovery",
  "operator-switch": "Operator switch",
  restored: "Restored",
};

/** Route-switch details split into the parts the feed renders separately. */
export interface RouteSwitchParts {
  /** Trigger sentence without the "Trigger: " prefix. */
  trigger: string | null;
  /** All four checks of a qualifying replacement ("Bid $22.00 ≤ $40.00 /M", …). */
  checks: string[];
  /** Name in the "X qualifies:" line. */
  qualifiedName: string | null;
  /** "X fails your policy: …" (pinned replacements that fail). */
  failure: string | null;
  /** Any other lines, unchanged ("Selected: ranked first for lowest cost."). */
  notes: string[];
}

const QUALIFIES_RE = /^(.+?) qualifies: (.+?)\.?$/;
const FAILS_RE = /^.+? fails your policy: .+$/;

/**
 * Parse the engine's route-switch detail lines. Unknown lines are kept as
 * notes, so copy changes in the engine degrade to plain text instead of breaking.
 */
export function parseRouteSwitchDetails(details: readonly string[]): RouteSwitchParts {
  const parts: RouteSwitchParts = { trigger: null, checks: [], qualifiedName: null, failure: null, notes: [] };
  for (const line of details) {
    if (line.startsWith("Trigger: ") && parts.trigger === null) {
      parts.trigger = line.slice("Trigger: ".length);
      continue;
    }
    const qualifies = QUALIFIES_RE.exec(line);
    if (qualifies && parts.checks.length === 0) {
      parts.qualifiedName = qualifies[1];
      parts.checks = qualifies[2].split(" · ").map((check) => check.trim()).filter(Boolean);
      continue;
    }
    if (FAILS_RE.test(line) && parts.failure === null) {
      parts.failure = line;
      continue;
    }
    parts.notes.push(line);
  }
  return parts;
}

/** Copy for the empty state of a filter. */
export const EMPTY_COPY: Readonly<Record<ActivityFilter, { title: string; description: string }>> = {
  all: { title: "No activity yet", description: "Requests, bids, policy edits, and routing decisions appear here." },
  routing: {
    title: "No routing events",
    description: "Route switches, scheduled switches, and pinned-provider alerts appear here.",
  },
  requests: { title: "No requests yet", description: "Run a request to see which provider served it." },
  conditions: {
    title: "No bid or condition changes",
    description: "Bid updates and provider condition edits appear here.",
  },
  policy: { title: "No policy changes", description: "Edits to limits, preference, and mode appear here." },
};
