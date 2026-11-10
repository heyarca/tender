import { isSerializationFailure, sql } from "@/lib/db";
import { ensureAccount, textOrNull, toNumber, WEEK_START_SQL } from "./accounts";
import { LOW_BALANCE_MICROS } from "./auto-top-up";
import { isAccountId, randomBase32 } from "./ids";
import type { Actor } from "./types";

/** PayPal orders start at $1.00. */
const MIN_TOP_UP_MICROS = 1_000_000;
const MICROS_PER_CENT = 10_000;
/** Retries of a reservation that lost a race on the same account row. */
const RESERVE_ATTEMPTS = 8;

type Row = Record<string, unknown>;

/** Balance under which an agent charge of `nextChargeMicros` first tops up. */
export function lowBalanceThreshold(nextChargeMicros: number): number {
  return Math.max(LOW_BALANCE_MICROS, nextChargeMicros);
}

/** Automatic top-ups of an account: the saved PayPal, the weekly limit, and this week's top-ups. */
export interface Autopay {
  savedPayPal: { email: string | null } | null;
  weeklyCapMicros: number | null;
  /** Completed automatic top-ups since Monday 00:00 UTC. */
  topUpsThisWeekMicros: number;
}

export type AgentTopUpRefusal = "no_saved_paypal" | "no_spending_limit" | "not_needed" | "weekly_limit";

export type AgentTopUpReservation =
  | { ok: true; id: string; amountMicros: number; vaultId: string; weeklyCapMicros: number; topUpsThisWeekMicros: number }
  | { ok: false; reason: AgentTopUpRefusal; weeklyCapMicros: number | null; topUpsThisWeekMicros: number; balanceMicros: number };

const TOP_UPS_THIS_WEEK = (status: string) => `coalesce((select sum(t.amount_micros) from auto_top_ups t
  where t.account_id = a.id and t.status ${status} and t.created_at >= ${WEEK_START_SQL}), 0)`;

export async function getAutopay(accountId: string): Promise<Autopay> {
  const rows = isAccountId(accountId)
    ? ((await sql.query(
        `select a.mandate_vault_id is not null as has_vault, a.mandate_vault_email, a.mandate_weekly_cap_micros,
           ${TOP_UPS_THIS_WEEK("= 'COMPLETED'")} as top_ups
         from accounts a where a.id = $1`,
        [accountId],
      )) as Row[])
    : [];
  const row = rows[0];
  return {
    savedPayPal: row?.has_vault === true ? { email: textOrNull(row.mandate_vault_email) } : null,
    weeklyCapMicros: row && row.mandate_weekly_cap_micros !== null ? toNumber(row.mandate_weekly_cap_micros) : null,
    topUpsThisWeekMicros: toNumber(row?.top_ups),
  };
}

/** The saved PayPal payment token of an account. Server only: it never goes to the browser. */
export async function savedVaultId(accountId: string): Promise<string | null> {
  if (!isAccountId(accountId)) return null;
  const rows = (await sql.query("select mandate_vault_id from accounts where id = $1", [accountId])) as Row[];
  return textOrNull(rows[0]?.mandate_vault_id);
}

/** Saves a PayPal payment token for automatic top-ups. Returns the token it replaced, if any. */
export async function saveVault(accountId: string, input: { vaultId: string; email: string | null }): Promise<string | null> {
  await ensureAccount(accountId);
  const rows = (await sql.query(
    `with prior as (select mandate_vault_id from accounts where id = $1)
     update accounts set mandate_vault_id = $2, mandate_vault_email = $3 where id = $1
     returning (select mandate_vault_id from prior) as replaced`,
    [accountId, input.vaultId, input.email],
  )) as Row[];
  const replaced = textOrNull(rows[0]?.replaced);
  return replaced === input.vaultId ? null : replaced;
}

/** Forgets the saved PayPal, unless another one was saved since `vaultId` was read. */
export async function clearVault(accountId: string, vaultId: string): Promise<void> {
  await sql.query(
    "update accounts set mandate_vault_id = null, mandate_vault_email = null where id = $1 and mandate_vault_id = $2",
    [accountId, vaultId],
  );
}

/**
 * The rules of agent top-ups from the saved PayPal, checked and reserved in one statement: the
 * account needs a saved PayPal and an approved weekly limit, and automatic top-ups since Monday
 * 00:00 UTC (pending or completed) plus this one must stay within that limit, so the agent never
 * pulls more from PayPal than it may spend.
 *
 * With `belowMicros` it is a low-balance top-up: nothing happens unless the balance is below it, and
 * the amount shrinks to what the weekly limit leaves (whole cents, at least $1.00). Without it the
 * full `amountMicros` must fit. The PENDING row is written before PayPal is charged; concurrent
 * reservations update the same account row, so the later one retries on a fresh snapshot.
 */
export async function reserveAgentTopUp(
  accountId: string,
  input: { amountMicros: number; belowMicros?: number },
): Promise<AgentTopUpReservation> {
  if (!Number.isSafeInteger(input.amountMicros) || input.amountMicros < MIN_TOP_UP_MICROS || input.amountMicros % MICROS_PER_CENT !== 0) {
    throw new Error("Top-ups are whole cents, at least $1.00");
  }
  const id = `auto_${randomBase32(24)}`;
  for (let attempt = 1; ; attempt++) {
    try {
      return await reserveOnce(accountId, id, input);
    } catch (error) {
      if (!isSerializationFailure(error) || attempt >= RESERVE_ATTEMPTS) throw error;
    }
  }
}

async function reserveOnce(accountId: string, id: string, input: { amountMicros: number; belowMicros?: number }): Promise<AgentTopUpReservation> {
  const [rows] = (await sql.transaction((txn) => [txn.query(
    `with acct as (
       select a.id, a.balance_micros, a.mandate_weekly_cap_micros as cap, a.mandate_vault_id as vault_id,
         ${TOP_UPS_THIS_WEEK("<> 'FAILED'")} as used
       from accounts a where a.id = $1
     ),
     plan as (
       select id, cap, used, vault_id,
         case when $4::bigint is null then $3::bigint
           else least($3::bigint, greatest(cap - used, 0) / ${MICROS_PER_CENT} * ${MICROS_PER_CENT}) end as amount
       from acct
       where vault_id is not null and cap is not null and ($4::bigint is null or balance_micros < $4::bigint)
     ),
     permitted as (
       select id, amount from plan where amount >= ${MIN_TOP_UP_MICROS} and used + amount <= cap
     ),
     locked as (
       update accounts set mandate_vault_id = mandate_vault_id where id = (select id from permitted)
       returning id
     ),
     reservation as (
       insert into auto_top_ups (id, account_id, amount_micros, status)
       select $2, locked.id, permitted.amount, 'PENDING' from locked, permitted
       returning amount_micros
     )
     select (select amount_micros from reservation) as reserved,
       acct.vault_id, acct.cap, acct.used, acct.balance_micros
     from acct`,
    [accountId, id, input.amountMicros, input.belowMicros ?? null],
  )], { isolationLevel: "RepeatableRead" })) as Row[][];
  const row = rows[0];
  const weeklyCapMicros = row && row.cap !== null ? toNumber(row.cap) : null;
  const used = toNumber(row?.used);
  if (row && row.reserved !== null && row.reserved !== undefined && weeklyCapMicros !== null) {
    const amountMicros = toNumber(row.reserved);
    return { ok: true, id, amountMicros, vaultId: String(row.vault_id), weeklyCapMicros, topUpsThisWeekMicros: used + amountMicros };
  }
  const balanceMicros = toNumber(row?.balance_micros);
  const reason: AgentTopUpRefusal = !row?.vault_id
    ? "no_saved_paypal"
    : weeklyCapMicros === null
      ? "no_spending_limit"
      : input.belowMicros !== undefined && balanceMicros >= input.belowMicros
        ? "not_needed"
        : "weekly_limit";
  return { ok: false, reason, weeklyCapMicros, topUpsThisWeekMicros: used, balanceMicros };
}

/**
 * Links a reserved top-up to its PayPal order and records the order like any top-up order, so the
 * capture (here or from the webhook) credits it once and marks the top-up COMPLETED.
 */
export async function attachAutoTopUpOrder(input: { id: string; accountId: string; orderId: string; amountMicros: number; actor: Actor }): Promise<void> {
  await sql.query(
    `with linked as (
       update auto_top_ups set paypal_order_id = $3, updated_at = now() where id = $1 and account_id = $2
       returning id
     )
     insert into paypal_orders (id, account_id, amount_micros, status, actor)
     select $3, $2, $4, 'CREATED', $5 from linked
     on conflict (id) do nothing`,
    [input.id, input.accountId, input.orderId, input.amountMicros, input.actor],
  );
}

/** A reserved top-up PayPal did not pay. It no longer counts toward the weekly limit. */
export async function failAutoTopUp(id: string): Promise<void> {
  await sql.query("update auto_top_ups set status = 'FAILED', updated_at = now() where id = $1 and status = 'PENDING'", [id]);
}
