import type { AskUITools } from "@/lib/agent/types";
import { getMarketSpec } from "@/lib/registry";

export type ActivityTone = "pending" | "done" | "error";
export interface Activity {
  tone: ActivityTone;
  text: string;
}

/** The fields of a tool part that the activity row reads. */
export interface ToolPartState {
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

type Input<NAME extends keyof AskUITools> = Partial<AskUITools[NAME]["input"]> | undefined;
type Output<NAME extends keyof AskUITools> = AskUITools[NAME]["output"] | undefined;

const marketName = (id: string | undefined) => (id ? (getMarketSpec(id)?.name ?? id) : "the market");
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const PAYPAL_LABELS: Record<string, [pending: string, done: string]> = {
  paypal_get_order: ["Looking up a PayPal order…", "Looked up a PayPal order"],
  paypal_list_transactions: ["Listing PayPal transactions…", "Listed PayPal transactions"],
  paypal_create_invoice: ["Creating a PayPal invoice…", "Created PayPal invoice"],
  paypal_send_invoice: ["Sending the PayPal invoice…", "Sent PayPal invoice"],
};

/** Invoice id of a PayPal invoice call: its input, or the invoice link PayPal returns. */
function invoiceId(part: ToolPartState): string | null {
  const input = part.input as { invoice_id?: unknown } | undefined;
  if (typeof input?.invoice_id === "string") return input.invoice_id;
  const href = (part.output as { href?: unknown } | undefined)?.href;
  return typeof href === "string" ? (/INV2(?:-[A-Z0-9]{4}){4}/.exec(href)?.[0] ?? null) : null;
}

/** A top-up from the saved PayPal (automatic before a run, or asked for), or why it was refused. */
function savedPayPalTopUpText(topUp: { added: string } | { refused: string }, automatic: boolean): string {
  if ("refused" in topUp) return `${automatic ? "Automatic top-up" : "Top-up"} refused: ${topUp.refused}`;
  return automatic ? `Topped up ${topUp.added} automatically with your saved PayPal` : `Added ${topUp.added} from your saved PayPal`;
}

/** The `error` of a tool result (`{ error }`). */
function outputError(output: unknown): string | null {
  return output && typeof output === "object" && "error" in output ? String((output as { error: unknown }).error) : null;
}

/** Plain-English row for one tool call, or `null` when a card shows it instead. */
export function toolActivity(name: string, part: ToolPartState): Activity | null {
  const done = part.state === "output-available";
  if (part.state === "output-error" || part.state === "output-denied") {
    return { tone: "error", text: part.errorText ? `Could not finish: ${part.errorText}` : "Could not finish this step" };
  }
  const error = done ? outputError(part.output) : null;
  if (error) return { tone: "error", text: error };

  switch (name) {
    case "list_markets": {
      const input = part.input as Input<"list_markets">;
      const output = part.output as Output<"list_markets">;
      if (!done || !output) return { tone: "pending", text: "Searching markets…" };
      const count = output.markets.length;
      const best = output.markets[0]?.name;
      if (input?.query && best) return { tone: "done", text: `Searched markets for “${input.query}”: best match ${best}` };
      return { tone: "done", text: input?.query ? `Found ${plural(count, "market")} for “${input.query}”` : `Found ${plural(count, "market")}` };
    }
    case "get_market": {
      const input = part.input as Input<"get_market">;
      const output = part.output as Output<"get_market">;
      if (!done || !output || "error" in output) return { tone: "pending", text: `Checking bids for ${marketName(input?.marketId)}…` };
      return {
        tone: "done",
        text: output.serving
          ? `Checked bids for ${output.market.name}: ${output.serving.name} wins at ${output.serving.bid}`
          : `Checked bids for ${output.market.name}: no provider meets the policy`,
      };
    }
    case "get_balance": {
      const output = part.output as Output<"get_balance">;
      if (!done || !output) return { tone: "pending", text: "Checking your balance…" };
      const limit = output.spending_limit;
      return {
        tone: "done",
        text: limit
          ? `Balance ${output.balance}. ${limit.spent_this_week} of ${limit.weekly_cap} spent this week`
          : `Balance ${output.balance}. No spending limit yet`,
      };
    }
    case "run_request": {
      const input = part.input as Input<"run_request">;
      const output = part.output as Output<"run_request">;
      if (!done || !output || "error" in output) {
        return { tone: "pending", text: `Running ${plural(input?.count ?? 1, "request")} on ${marketName(input?.marketId)}…` };
      }
      const refused = "refused" in output ? output.refused : undefined;
      if (output.ran === 0 && refused) return { tone: "error", text: `Request refused: ${refused.message}` };
      if (!("market" in output)) return { tone: "error", text: "Request refused" };
      const topUp = "auto_top_up" in output ? output.auto_top_up : undefined;
      const ran = `${topUp ? `${savedPayPalTopUpText(topUp, true)}. ` : ""}Ran ${plural(output.ran, "request")} on ${output.market}: ${output.charged_total} charged to credits`;
      return refused ? { tone: "error", text: `${ran}. Then refused: ${refused.message}` } : { tone: "done", text: ran };
    }
    case "apply_policy": {
      const input = part.input as Input<"apply_policy">;
      const output = part.output as Output<"apply_policy">;
      if (!done || !output) return { tone: "pending", text: `Setting routing policy for ${marketName(input?.marketId)}…` };
      if (!output.applied) return { tone: "error", text: output.error ?? "Routing policy was not applied" };
      return { tone: "done", text: `Set routing policy for ${output.market}: ${output.policy}` };
    }
    case "request_spending_limit": {
      const output = part.output as Output<"request_spending_limit">;
      if (!done || !output) return null;
      return output.approved
        ? { tone: "done", text: `Spending limit approved: ${output.weekly_cap} per week` }
        : { tone: "error", text: "Spending limit declined" };
    }
    case "top_up": {
      const output = part.output as Output<"top_up">;
      return done && output && "automatic" in output ? { tone: "done", text: savedPayPalTopUpText(output, false) } : null;
    }
    default: {
      const labels = PAYPAL_LABELS[name];
      if (labels) {
        const transactions = done ? (part.output as { transaction_details?: unknown } | undefined)?.transaction_details : undefined;
        if (Array.isArray(transactions)) return { tone: "done", text: `Found ${plural(transactions.length, "PayPal transaction")}` };
        const invoice = invoiceId(part);
        return { tone: done ? "done" : "pending", text: done ? `${labels[1]}${invoice ? ` ${invoice}` : ""}` : labels[0] };
      }
      return { tone: done ? "done" : "pending", text: done ? `Used ${name}` : `Using ${name}…` };
    }
  }
}
