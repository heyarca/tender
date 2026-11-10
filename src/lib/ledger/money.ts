import { isSerializationFailure, isUniqueViolation, sql } from "@/lib/db";
import { assertMicros, ensureAccount, getAccount, toNumber, WEEK_START_SQL } from "./accounts";
import { isAccountId } from "./ids";
import type { Actor, ChargeResult } from "./types";

type Row = Record<string, unknown>;

async function balanceOf(accountId: string): Promise<number> {
  return (await getAccount(accountId))?.balanceMicros ?? 0;
}

/**
 * Credits a captured PayPal payment. Exactly once per `captureId`: the balance update, the
 * ledger entry, and the order status change are one statement, and the unique index on
 * `ledger_entries.paypal_capture_id` rejects a second credit (a concurrent duplicate rolls back).
 * The capture of an automatic top-up also completes it and labels its entry `auto_top_up`.
 */
export async function creditTopUp(input: {
  accountId: string;
  amountMicros: number;
  orderId: string;
  captureId: string;
  actor: Actor;
}): Promise<{ credited: boolean; balanceMicros: number }> {
  assertMicros(input.amountMicros);
  if (!input.captureId || !input.orderId) throw new Error("orderId and captureId are required");
  await ensureAccount(input.accountId);
  try {
    const rows = (await sql.query(
      `with prior as (
         select 1 from ledger_entries where paypal_capture_id = $4
       ),
       credit as (
         update accounts set balance_micros = balance_micros + $2::bigint
         where id = $1 and not exists (select 1 from prior)
         returning id, balance_micros
       ),
       auto_top_up as (
         update auto_top_ups set status = 'COMPLETED', paypal_capture_id = $4, updated_at = now()
         where paypal_order_id = $3 and account_id = $1 and exists (select 1 from credit)
         returning id
       ),
       entry as (
         insert into ledger_entries (account_id, kind, amount_micros, balance_after_micros, actor, paypal_order_id, paypal_capture_id, metadata)
         select id, 'topup', $2::bigint, balance_micros, $5::text, $3, $4,
           case when exists (select 1 from auto_top_up) then '{"auto_top_up": true}'::jsonb else '{}'::jsonb end
         from credit
         returning id
       ),
       order_status as (
         update paypal_orders set status = 'COMPLETED', capture_id = $4, updated_at = now()
         where id = $3 and account_id = $1 and (capture_id is null or capture_id = $4)
         returning id
       )
       select (select balance_micros from credit) as credited_balance`,
      [input.accountId, input.amountMicros, input.orderId, input.captureId, input.actor],
    )) as Row[];
    const credited = rows[0]?.credited_balance;
    if (credited !== null && credited !== undefined) return { credited: true, balanceMicros: toNumber(credited) };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return { credited: false, balanceMicros: await balanceOf(input.accountId) };
}

/**
 * Debits one served request and records the provider's earning, in one statement.
 * Idempotent per `requestId` (a replay returns `ok: true` without a second debit). The
 * balance can never go below zero. With `actor: "agent"`, agent charges since the start of
 * the ISO week plus this amount must stay within the mandate cap.
 */
export async function chargeForRequest(input: {
  accountId: string;
  requestId: string;
  marketId: string;
  providerId: string;
  amountMicros: number;
  actor: Actor;
}): Promise<ChargeResult> {
  assertMicros(input.amountMicros);
  if (!input.requestId) throw new Error("requestId is required");
  if (!isAccountId(input.accountId)) return { ok: false, reason: "insufficient_credits", balanceMicros: 0 };
  for (let attempt = 1; ; attempt++) {
    try {
      return await chargeOnce(input);
    } catch (error) {
      // A concurrent charge on the same account committed first; retry on a fresh snapshot.
      if (!isSerializationFailure(error) || attempt >= CHARGE_ATTEMPTS) throw error;
    }
  }
}

/** Retries of a charge that lost a race on the same account row. */
const CHARGE_ATTEMPTS = 8;

/**
 * One charge statement in a REPEATABLE READ transaction. Concurrent charges on one account
 * update the same row, so the later one fails with a serialization error instead of reading
 * a stale weekly agent spend; the caller retries it.
 */
async function chargeOnce(input: Parameters<typeof chargeForRequest>[0]): Promise<ChargeResult> {
  try {
    const [rows] = (await sql.transaction((txn) => [txn.query(
      `with acct as (
         select a.id, a.balance_micros, a.mandate_weekly_cap_micros as cap,
           coalesce((select -sum(e.amount_micros) from ledger_entries e
             where e.account_id = a.id and e.kind = 'charge' and e.actor = 'agent'
               and e.created_at >= ${WEEK_START_SQL}), 0) as spent
         from accounts a where a.id = $1
       ),
       prior as (
         select 1 from ledger_entries where request_id = $2 and kind = 'charge'
       ),
       permitted as (
         select id from acct
         where not exists (select 1 from prior)
           and ($6::text <> 'agent' or (cap is not null and spent + $5::bigint <= cap))
       ),
       debit as (
         update accounts set balance_micros = balance_micros - $5::bigint
         where id = (select id from permitted) and balance_micros >= $5::bigint
         returning id, balance_micros
       ),
       entry as (
         insert into ledger_entries (account_id, kind, amount_micros, balance_after_micros, actor, market_id, provider_id, request_id)
         select id, 'charge', -$5::bigint, balance_micros, $6::text, $3, $4, $2 from debit
         returning id
       ),
       earning as (
         insert into provider_earnings (provider_id, request_id, account_id, market_id, amount_micros)
         select $4, $2, id, $3, $5::bigint from debit
         returning id
       )
       select
         (select balance_micros from debit) as charged_balance,
         exists (select 1 from prior) as replay,
         exists (select 1 from permitted) as permitted,
         exists (select 1 from acct) as account_exists,
         (select balance_micros from acct) as balance`,
      [input.accountId, input.requestId, input.marketId, input.providerId, input.amountMicros, input.actor],
    )], { isolationLevel: "RepeatableRead" })) as Row[][];
    const row = rows[0] ?? {};
    if (row.charged_balance !== null && row.charged_balance !== undefined) return { ok: true, balanceMicros: toNumber(row.charged_balance) };
    const balanceMicros = toNumber(row.balance);
    if (row.replay === true) return { ok: true, balanceMicros };
    if (row.account_exists === true && row.permitted !== true) return { ok: false, reason: "mandate_exceeded", balanceMicros };
    return { ok: false, reason: "insufficient_credits", balanceMicros };
  } catch (error) {
    // A concurrent charge with the same request id won; this one rolled back.
    if (!isUniqueViolation(error)) throw error;
    return { ok: true, balanceMicros: await balanceOf(input.accountId) };
  }
}
