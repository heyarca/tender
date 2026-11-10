import { z } from "zod";
import { formatMicros } from "@/components/credits/money";
import { usdToMicros } from "@/lib/agent/money";
import { askPolicySchema, describePolicy, toRoutingPolicy, type MandatePolicy } from "@/lib/agent/policy";
import { MAX_WEEKLY_CAP_USD } from "@/lib/agent/tools";
import { cookieAccountForWrite, setMandate } from "@/lib/ledger";
import { accountError, accountJson, requireJson } from "@/lib/ledger/http";
import { isMarketId } from "@/lib/tender";

const bodySchema = z.object({
  weeklyCapUsd: z.number().positive().max(MAX_WEEKLY_CAP_USD),
  marketId: z.string(),
  policy: askPolicySchema,
});

/** `POST /api/ask/mandate`: the user approves an Ask Tender spending limit for the cookie account. */
export async function POST(request: Request) {
  const notJson = requireJson(request);
  if (notJson) return notJson;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isMarketId(parsed.data.marketId)) return accountError(400, "invalid_mandate", "Send a weekly limit, a market and a policy");
  const { weeklyCapUsd, marketId, policy } = parsed.data;
  const { accountId, setCookie } = cookieAccountForWrite(request);
  const routing = toRoutingPolicy(marketId, policy);
  const mandate = await setMandate(accountId, { weeklyCapMicros: usdToMicros(weeklyCapUsd), policy: { marketId, policy: routing } satisfies MandatePolicy });
  return accountJson(
    {
      weekly_cap: formatMicros(mandate.weeklyCapMicros),
      spent_this_week: formatMicros(mandate.spentThisWeekMicros),
      policy: describePolicy(marketId, routing),
    },
    200,
    setCookie,
  );
}
