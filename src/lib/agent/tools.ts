import { tool, type JSONValue, type Tool } from "ai";
import { z } from "zod";
import { getAccount, getAutopay, listLedger, lowBalanceThreshold } from "@/lib/ledger";
import { PayPalError } from "@/lib/paypal/client";
import { paypalIssue } from "@/lib/paypal/http";
import { createTopUpOrder } from "@/lib/paypal/orders";
import { topUpBeforeAgentCharge, type VaultedTopUp } from "@/lib/paypal/vault";
import { serveWithCredits } from "@/lib/server/credits";
import { ApiError } from "@/lib/server/http";
import { getMarketDefinition, isMarketId, providerName, type MarketId, type RoutingPolicy, type ServedEnvelope } from "@/lib/tender";
import { findMarkets, marketBids, nextChargeMicros } from "./markets";
import { formatMicros } from "@/components/credits/money";
import { usdToMicros } from "./money";
import { askPolicySchema, describePolicy, readMandatePolicy, toRoutingPolicy, type AskPolicy } from "./policy";
import { hasPayPalCredentials, paypalToolkitTools } from "./paypal-tools";

/** Most requests one `run_request` call may run. */
export const MAX_RUN_COUNT = 5;
/** Highest weekly spending limit the agent may ask for. */
export const MAX_WEEKLY_CAP_USD = 100;

const marketIdSchema = z.string().describe("Market id, for example sf-weather");

/** Client tools run in the browser (no `execute`): they change the console or ask the user to approve. */
export const clientTools = {
  apply_policy: tool({
    description:
      "Apply a routing policy to a market in the user's console (the same as editing Routing policy). Opens the market page if needed.",
    inputSchema: z.object({ marketId: marketIdSchema, policy: askPolicySchema }),
    outputSchema: z.object({
      applied: z.boolean(),
      market: z.string().optional(),
      policy: z.string().optional(),
      serving: z.string().nullable().optional(),
      qualified: z.string().optional(),
      error: z.string().optional(),
    }),
  }),
  request_spending_limit: tool({
    description:
      "Apply the requested routing policy and show a weekly spending approval card with the current provider and bid. Use directly when the market and budget are known; no separate get_market or apply_policy is needed. The user must approve in the panel before any paid request. Applying routing alone never spends credits.",
    inputSchema: z.object({
      weeklyCapUsd: z.number().positive().max(MAX_WEEKLY_CAP_USD).describe("Weekly limit in USD, for example 5"),
      marketId: marketIdSchema,
      policy: askPolicySchema,
    }),
    outputSchema: z.object({
      approved: z.boolean(),
      weekly_cap: z.string().optional(),
      spent_this_week: z.string().optional(),
      policy: z.string().optional(),
      /** The user saved PayPal, so Ask Tender tops up by itself within the weekly limit. */
      automatic_top_ups: z.boolean().optional(),
      reason: z.string().optional(),
    }),
  }),
};

/** Ledger entries read for this week's usage, and the newest of them shown to the model. */
const MAX_LEDGER_ENTRIES = 500;
const RECENT_ENTRIES = 5;

/** Start of the ISO week (Monday 00:00 UTC), like the ledger's weekly spending limit. */
function weekStart(now = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
}

function errorMessage(error: unknown): string {
  if (error instanceof PayPalError) {
    return `PayPal refused: ${paypalIssue(error) ?? error.message}${error.debugId ? ` (debug id ${error.debugId})` : ""}`;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

/** Why the saved PayPal was not charged: this week's automatic top-ups reached the weekly limit. */
function weeklyLimitReached(result: Extract<VaultedTopUp, { status: "REFUSED" }>): string {
  return `weekly limit reached (${formatMicros(result.topUpsThisWeekMicros)} of ${formatMicros(result.weeklyCapMicros ?? 0)} added this week)`;
}

/** A completed automatic top-up from the saved PayPal, as the model and the panel read it. */
function autoTopUpView(result: Exclude<VaultedTopUp, { status: "REFUSED" }>) {
  return {
    added: formatMicros(result.amountMicros),
    status: result.status === "COMPLETED" ? "completed" : "pending",
    paypal_order_id: result.orderId,
    paypal_capture_id: result.captureId,
    balance: formatMicros(result.balanceMicros),
    top_ups_this_week: formatMicros(result.topUpsThisWeekMicros),
    top_ups_left_this_week: formatMicros(Math.max(0, result.weeklyCapMicros - result.topUpsThisWeekMicros)),
  };
}

/**
 * The automatic top-up before an agent charge (rules in `reserveAgentTopUp`). Nothing when it is not
 * needed or not set up; a refusal or a PayPal failure is reported, and the run goes on with the balance.
 */
async function autoTopUp(accountId: string, nextCharge: number) {
  try {
    const result = await topUpBeforeAgentCharge(accountId, nextCharge);
    if (result.status !== "REFUSED") return autoTopUpView(result);
    return result.reason === "weekly_limit" ? { refused: weeklyLimitReached(result) } : undefined;
  } catch (error) {
    return { refused: errorMessage(error) };
  }
}

function policyFor(marketId: MarketId, policy: AskPolicy | undefined, mandatePolicy: unknown): Partial<RoutingPolicy> {
  if (policy) return toRoutingPolicy(marketId, policy);
  const approved = readMandatePolicy(mandatePolicy);
  return approved?.marketId === marketId ? approved.policy : {};
}

type ContractBody = {
  request_id?: string;
  provider?: string;
  latency_ms?: number;
  data_age_ms?: number;
  price_usd?: number;
  data?: unknown;
  error?: { code?: string; message?: string };
  payment?: { charged_micros: number; balance_micros: number };
};

/** Server tools for one visitor's cookie account. */
function serverTools(accountId: string) {
  return {
    list_markets: tool({
      description: "Search Tender markets (APIs that providers bid to serve). Returns ids, names and the lowest bid.",
      inputSchema: z.object({
        query: z.string().optional().describe("Words to match, for example 'San Francisco weather'"),
        group: z.string().optional().describe("Group id or label"),
        category: z.string().optional().describe("Category id or label"),
      }),
      execute: async (input) => findMarkets(input),
    }),
    get_market: tool({
      description:
        "Bids of every provider in a market and which provider Tender routes to under a policy (unset fields use the market defaults).",
      inputSchema: z.object({ marketId: marketIdSchema, policy: askPolicySchema.optional() }),
      execute: async ({ marketId, policy }) => {
        if (!isMarketId(marketId)) return { error: `Unknown market: ${marketId}` };
        try {
          return marketBids(marketId, policy ? toRoutingPolicy(marketId, policy) : {});
        } catch (error) {
          if (error instanceof ApiError) return { error: error.message };
          throw error;
        }
      },
    }),
    get_balance: tool({
      description:
        "The user's Tender credits, the approved weekly spending limit with this week's agent spend, this week's usage (all paid requests), and the latest ledger entries.",
      inputSchema: z.object({}),
      execute: async () => {
        const account = await getAccount(accountId);
        const [entries, autopay] = account ? await Promise.all([listLedger(accountId, MAX_LEDGER_ENTRIES), getAutopay(accountId)]) : [[], null];
        const charges = entries.filter((entry) => entry.kind === "charge" && Date.parse(entry.createdAt) >= weekStart());
        const mandate = account?.mandate ?? null;
        const approved = readMandatePolicy(mandate?.policy);
        return {
          balance: formatMicros(account?.balanceMicros ?? 0),
          spending_limit: mandate
            ? {
                weekly_cap: formatMicros(mandate.weeklyCapMicros),
                spent_this_week: formatMicros(mandate.spentThisWeekMicros),
                left_this_week: formatMicros(Math.max(0, mandate.weeklyCapMicros - mandate.spentThisWeekMicros)),
                market: approved && isMarketId(approved.marketId) ? getMarketDefinition(approved.marketId).name : null,
                policy: approved && isMarketId(approved.marketId) ? describePolicy(approved.marketId, approved.policy) : null,
                automatic_top_ups: autopay?.savedPayPal
                  ? {
                      top_ups_this_week: formatMicros(autopay.topUpsThisWeekMicros),
                      top_ups_left_this_week: formatMicros(Math.max(0, mandate.weeklyCapMicros - autopay.topUpsThisWeekMicros)),
                    }
                  : "off: no saved PayPal",
              }
            : null,
          usage_this_week: { requests: charges.length, charged: formatMicros(-charges.reduce((sum, entry) => sum + entry.amountMicros, 0)) },
          recent: entries.slice(0, RECENT_ENTRIES).map((entry) => ({
            kind: entry.kind,
            amount: formatMicros(entry.amountMicros),
            by: entry.actor,
            market: entry.marketId,
            provider: entry.marketId && entry.providerId ? providerName(entry.marketId, entry.providerId) : null,
            at: entry.createdAt,
          })),
        };
      },
    }),
    run_request: tool({
      description:
        "Run paid requests on a market with the user's credits, as the agent. Each one is charged the winning bid. The ledger refuses any charge over the approved weekly limit. Without a policy, the approved limit's policy is used. Pass the user's text as params: text for translation, prompt for chat, query for geocoding.",
      inputSchema: z.object({
        marketId: marketIdSchema,
        policy: askPolicySchema.optional(),
        params: z
          .record(z.string(), z.string().max(500))
          .optional()
          .describe('Request inputs, for example { "text": "Where is the station?" } for translation or { "prompt": "..." } for chat'),
        count: z.number().int().min(1).max(MAX_RUN_COUNT).optional().describe(`How many requests, 1 to ${MAX_RUN_COUNT} (default 1)`),
      }),
      execute: async ({ marketId, policy, params, count = 1 }) => {
        if (!isMarketId(marketId)) return { ran: 0, error: `Unknown market: ${marketId}` };
        const before = await getAccount(accountId);
        if (!before?.mandate) {
          return { ran: 0, refused: { code: "no_spending_limit", message: "No spending limit is approved. Ask for one with request_spending_limit." } };
        }
        const routing = policyFor(marketId, policy, before.mandate.policy);
        const requests: { provider: string; latency_ms?: number; charged: string }[] = [];
        // What the console records for each request (the model sees `requests` instead).
        const served: ServedEnvelope[] = [];
        let chargedMicros = 0;
        let refused: { code: string; message: string } | undefined;
        let lastData: unknown;
        let balance = before.balanceMicros;
        let autoTopUpResult: Awaited<ReturnType<typeof autoTopUp>>;
        for (let index = 0; index < count; index++) {
          // With a saved PayPal, a low balance tops up by itself first (at most once per run).
          if (before.mandate.hasVault && !autoTopUpResult) {
            const nextCharge = chargeEstimate(marketId, routing);
            if (balance < lowBalanceThreshold(nextCharge)) autoTopUpResult = await autoTopUp(accountId, nextCharge);
          }
          const { status, body } = await serveWithCredits({ accountId, actor: "agent", marketId, params, policy: routing });
          const result = body as ContractBody;
          if (status !== 200 || !result.payment) {
            refused = { code: result.error?.code ?? `http_${status}`, message: result.error?.message ?? "The request failed" };
            break;
          }
          balance = result.payment.balance_micros;
          chargedMicros += result.payment.charged_micros;
          lastData = result.data;
          requests.push({
            provider: result.provider ? providerName(marketId, result.provider) : "Unknown",
            latency_ms: result.latency_ms,
            charged: formatMicros(result.payment.charged_micros),
          });
          served.push({
            request_id: result.request_id ?? "",
            market: marketId,
            provider: result.provider ?? "",
            provider_name: result.provider ? providerName(marketId, result.provider) : undefined,
            latency_ms: result.latency_ms ?? 0,
            data_age_ms: result.data_age_ms ?? 0,
            price_usd: result.price_usd ?? 0,
            charged_micros: result.payment.charged_micros,
            served_at: new Date().toISOString(),
            data: (result.data ?? {}) as Record<string, unknown>,
          });
        }
        const after = await getAccount(accountId);
        const mandate = after?.mandate;
        return {
          market: getMarketDefinition(marketId).name,
          policy: describePolicy(marketId, routing),
          ran: requests.length,
          requests,
          charged_total: formatMicros(chargedMicros),
          balance: formatMicros(after?.balanceMicros ?? 0),
          spent_this_week: mandate ? formatMicros(mandate.spentThisWeekMicros) : null,
          weekly_cap: mandate ? formatMicros(mandate.weeklyCapMicros) : null,
          last_result: lastData,
          ...(autoTopUpResult ? { auto_top_up: autoTopUpResult } : {}),
          served,
          // The run stops at the first refusal; later requests were not tried.
          ...(refused ? { refused, not_tried: count - requests.length - 1 } : {}),
        };
      },
      // The panel records `served` in the console; the model gets the summary without it.
      toModelOutput: ({ output }) => {
        if (!("served" in output)) return { type: "json", value: output };
        const summary = Object.fromEntries(Object.entries(output).filter(([key]) => key !== "served"));
        return { type: "json", value: summary as JSONValue };
      },
    }),
  };
}

/**
 * A one-off top-up the user approves in PayPal, even when PayPal is saved.
 * Only run_request may initiate automatic, allowance-reserved vault charges.
 */
function topUpTool(accountId: string, origin: string) {
  return tool({
    description:
      "Offer a one-off Tender credits top-up. The user must approve this payment in PayPal, even with a saved account. It does not use the automatic top-up allowance. Credits arrive only after approval and capture.",
    inputSchema: z.object({ amountUsd: z.union([z.literal(5), z.literal(10), z.literal(20)]).describe("5, 10 or 20") }),
    execute: async ({ amountUsd }) => {
      const amountMicros = usdToMicros(amountUsd);
      try {
        const order = await createTopUpOrder({
          accountId,
          amountMicros,
          actor: "user",
          returnUrl: `${origin}/api/ask/top-up`,
          cancelUrl: `${origin}/api/ask/top-up?cancel=1`,
        });
        return {
          order_id: order.orderId,
          approve_url: order.approveUrl,
          amount: formatMicros(amountMicros),
          status: "waiting_for_approval",
        };
      } catch (error) {
        return { error: errorMessage(error) };
      }
    },
    // The panel shows the approve link as a button; the model never repeats it.
    toModelOutput: ({ output }) => {
      if (!("approve_url" in output)) return { type: "json", value: output };
      return {
        type: "json",
        value: {
          order_id: output.order_id,
          amount: output.amount,
          status: output.status,
          approval: "The panel shows an Approve in PayPal button.",
        },
      };
    },
  });
}

/** The next request's cost for the low-balance check. 0 when the policy cannot be evaluated; the request then says why. */
function chargeEstimate(marketId: MarketId, routing: Partial<RoutingPolicy>): number {
  try {
    return nextChargeMicros(marketId, routing);
  } catch (error) {
    if (error instanceof ApiError) return 0;
    throw error;
  }
}

/** Every tool the UI renders by type. PayPal Agent Toolkit tools are added at runtime and rendered by name. */
export type AskTools = ReturnType<typeof serverTools> & { top_up: ReturnType<typeof topUpTool> } & typeof clientTools;

/** Tools of one Ask Tender turn. Top-ups and the PayPal Agent Toolkit need PayPal credentials. */
export async function createAskTools(input: { accountId: string; origin: string }): Promise<Record<string, Tool>> {
  return {
    ...serverTools(input.accountId),
    ...(hasPayPalCredentials() ? { top_up: topUpTool(input.accountId, input.origin) } : {}),
    ...clientTools,
    ...(await paypalToolkitTools(input.accountId)),
  };
}
