import { sql } from "@/lib/db";
import { isAccountId, newAccountId } from "./ids";
import type { AccountSummary, Actor, LedgerEntry, LedgerKind, Mandate } from "./types";

/** Start of the ISO week (Monday 00:00 UTC), as a SQL expression. */
export const WEEK_START_SQL = "date_trunc('week', now() at time zone 'UTC') at time zone 'UTC'";

type Row = Record<string, unknown>;

/** Bigint and numeric columns arrive as strings. Amounts stay below 2^53. */
export const toNumber = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));
export const toIso = (value: unknown): string => (value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString());
export const toIsoOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : toIso(value));
export const textOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : String(value));

export function assertMicros(value: number, name = "amountMicros"): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer of micro-USD`);
}

function assertAccountId(id: string): void {
  if (!isAccountId(id)) throw new Error("Invalid account id");
}

const ACCOUNT_SELECT = `
  select a.id, a.balance_micros, a.mandate_weekly_cap_micros, a.mandate_policy,
    a.mandate_vault_id is not null as has_vault, a.mandate_approved_at, a.created_at,
    coalesce((select -sum(e.amount_micros) from ledger_entries e
      where e.account_id = a.id and e.kind = 'charge' and e.actor = 'agent'
        and e.created_at >= ${WEEK_START_SQL}), 0) as spent_this_week
  from accounts a where a.id = $1`;

function toSummary(row: Row): AccountSummary {
  const mandate: Mandate | null =
    row.mandate_weekly_cap_micros === null || row.mandate_weekly_cap_micros === undefined
      ? null
      : {
          weeklyCapMicros: toNumber(row.mandate_weekly_cap_micros),
          spentThisWeekMicros: toNumber(row.spent_this_week),
          policy: row.mandate_policy ?? null,
          hasVault: row.has_vault === true,
          approvedAt: toIso(row.mandate_approved_at ?? row.created_at),
        };
  return { id: String(row.id), balanceMicros: toNumber(row.balance_micros), mandate };
}

/** Inserts the account row if it is missing. Not a money change. */
export async function ensureAccount(id: string): Promise<void> {
  assertAccountId(id);
  await sql.query("insert into accounts (id) values ($1) on conflict (id) do nothing", [id]);
}

export async function getAccount(id: string): Promise<AccountSummary | null> {
  if (!isAccountId(id)) return null;
  const rows = (await sql.query(ACCOUNT_SELECT, [id])) as Row[];
  return rows[0] ? toSummary(rows[0]) : null;
}

/** The account with this id, created when missing. Without an id, a new account. */
export async function getOrCreateAccount(id?: string): Promise<AccountSummary> {
  const accountId = id ?? newAccountId();
  await ensureAccount(accountId);
  const account = await getAccount(accountId);
  if (!account) throw new Error("Account was not created");
  return account;
}

/** Approves an agent spending limit and routing policy. Keeps a stored vault token when none is given. */
export async function setMandate(accountId: string, input: { weeklyCapMicros: number; policy: unknown; vaultId?: string }): Promise<Mandate> {
  assertAccountId(accountId);
  if (!Number.isSafeInteger(input.weeklyCapMicros) || input.weeklyCapMicros < 0) {
    throw new Error("weeklyCapMicros must be a non-negative integer of micro-USD");
  }
  await sql.query(
    `insert into accounts (id, mandate_weekly_cap_micros, mandate_policy, mandate_vault_id, mandate_approved_at)
     values ($1, $2, $3::jsonb, $4, now())
     on conflict (id) do update set
       mandate_weekly_cap_micros = excluded.mandate_weekly_cap_micros,
       mandate_policy = excluded.mandate_policy,
       mandate_vault_id = coalesce(excluded.mandate_vault_id, accounts.mandate_vault_id),
       mandate_approved_at = excluded.mandate_approved_at`,
    [accountId, input.weeklyCapMicros, JSON.stringify(input.policy ?? null), input.vaultId ?? null],
  );
  const account = await getAccount(accountId);
  if (!account?.mandate) throw new Error("Mandate was not saved");
  return account.mandate;
}

function toEntry(row: Row): LedgerEntry {
  return {
    id: String(row.id),
    kind: row.kind as LedgerKind,
    amountMicros: toNumber(row.amount_micros),
    balanceAfterMicros: toNumber(row.balance_after_micros),
    actor: row.actor as Actor,
    marketId: textOrNull(row.market_id),
    providerId: textOrNull(row.provider_id),
    requestId: textOrNull(row.request_id),
    paypalOrderId: textOrNull(row.paypal_order_id),
    paypalCaptureId: textOrNull(row.paypal_capture_id),
    createdAt: toIso(row.created_at),
    metadata: (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>,
  };
}

/** Newest entries first. `limit` is clamped to 1..500. */
export async function listLedger(accountId: string, limit = 50): Promise<LedgerEntry[]> {
  if (!isAccountId(accountId)) return [];
  const bounded = Math.min(500, Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 50)));
  const rows = (await sql.query(
    `select id, kind, amount_micros, balance_after_micros, actor, market_id, provider_id, request_id,
       paypal_order_id, paypal_capture_id, created_at, metadata
     from ledger_entries where account_id = $1 order by created_at desc, id desc limit $2`,
    [accountId, bounded],
  )) as Row[];
  return rows.map(toEntry);
}

