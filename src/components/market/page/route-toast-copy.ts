import type { ToastTone } from "@/components/ui/toast";
import { NO_ELIGIBLE_TEXT, providerName, type MarketId, type ProviderId, type RouteEvent, type Tone } from "@/lib/tender";

/** What a toast action does; the page maps each kind to a handler. */
export type RouteToastAction =
  | { kind: "switch-to-recommended"; label: string }
  | { kind: "use-automatic"; label: string }
  | { kind: "edit-policy"; label: string }
  | { kind: "view-market"; label: string; marketId: MarketId };

export interface RouteToastSpec {
  /** One toast per market and kind, so a new event replaces the previous one instead of stacking. */
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: RouteToastAction;
}

export interface RouteToastContext {
  /** Display name of the event's market ("Bitcoin Price"). */
  marketName: string;
  /** The event belongs to the market on screen. Other markets get a name prefix and a "View" action. */
  current: boolean;
  /** Rank-1 provider when the toast is raised, for the pinned-violation action. */
  recommendedProviderId: ProviderId | null;
}

const TONES: Record<Tone, ToastTone> = { neutral: "info", positive: "positive", warning: "warning", negative: "negative" };

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** `Trigger: …` line of a route-switch or no-eligible entry, without the prefix. */
function triggerLine(details: readonly string[]): string | undefined {
  const line = details.find((detail) => detail.startsWith("Trigger: "));
  return line ? line.slice("Trigger: ".length) : undefined;
}

/** Toast copy for a route event (switch, no eligible provider, pinned violation). */
export function routeEventToast(event: RouteEvent, context: RouteToastContext): RouteToastSpec {
  const { marketId } = event;
  const prefix = context.current ? "" : `${context.marketName}: `;
  const viewMarket: RouteToastAction | undefined = context.current
    ? undefined
    : { kind: "view-market", label: "View market", marketId };

  switch (event.kind) {
    case "route-switch": {
      const to = providerName(marketId, event.toProviderId);
      return {
        id: `route-${marketId}`,
        title: `${prefix}${event.fromProviderId ? "Switched" : "Routing"} to ${to}`,
        description: triggerLine(event.details),
        tone: TONES[event.tone],
        action: viewMarket,
      };
    }
    case "no-eligible": {
      const failure = event.fromProviderId
        ? event.details.find((detail) => detail.startsWith(`${providerName(marketId, event.fromProviderId)} `))
        : undefined;
      return {
        id: `route-${marketId}`,
        title: `${prefix}No eligible provider`,
        description: failure ? `${sentence(failure)} Requests are rejected and nothing is sent.` : NO_ELIGIBLE_TEXT,
        tone: "negative",
        action: viewMarket ?? { kind: "edit-policy", label: "Edit policy" },
      };
    }
    case "pin-violation": {
      const name = providerName(marketId, event.providerId);
      const recommended = context.recommendedProviderId;
      const action: RouteToastAction =
        viewMarket ??
        (recommended && recommended !== event.providerId
          ? { kind: "switch-to-recommended", label: `Switch to ${providerName(marketId, recommended)}` }
          : { kind: "use-automatic", label: "Use automatic switching" });
      return {
        id: `pin-${marketId}`,
        title: `${prefix}Pinned provider ${name} fails your policy`,
        description: `${sentence(event.reasons.join("; "))} Requests still go to ${name}.`,
        tone: "negative",
        action,
      };
    }
  }
}
