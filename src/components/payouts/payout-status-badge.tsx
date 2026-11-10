import { Badge, type BadgeTone } from "@/components/ui/badge";

/** PayPal batch statuses and item transaction statuses, plus our FAILED (PayPal rejected the batch). */
const TONES: Record<string, BadgeTone> = {
  SUCCESS: "positive",
  PENDING: "neutral",
  PROCESSING: "info",
  NEW: "neutral",
  ONHOLD: "warning",
  UNCLAIMED: "warning",
  DENIED: "negative",
  FAILED: "negative",
  CANCELED: "negative",
  BLOCKED: "negative",
  RETURNED: "negative",
  REFUNDED: "negative",
  REVERSED: "negative",
};

const LABELS: Record<string, string> = { ONHOLD: "On hold" };

const label = (status: string) => LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase();

export function PayoutStatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={TONES[status] ?? "neutral"} dot>
      {label(status)}
    </Badge>
  );
}
