import { sql } from "@/lib/db";
import { randomBase32 } from "@/lib/ledger/ids";
import { getProvider } from "@/lib/registry";
import { getAccessToken, PayPalError, paypalFetch } from "./client";
import { PAYOUT_RECEIVERS } from "./payout-receivers";
import type { PayPalWebhookEvent } from "./types";

/** Payouts are whole cents: 1 cent = 10_000 micro-USD. */
const MICROS_PER_CENT = 10_000;
/** Batch statuses that never change again. `FAILED` is ours: PayPal rejected the batch. */
const FINAL_BATCH_STATUSES = ["SUCCESS", "DENIED", "CANCELED", "FAILED"];
/** Carry rows keep a provider's sub-cent remainder unpaid for the next batch. */
const CARRY_PREFIX = "carry:";
const CARRY_SOURCE = "carry";
/** Minimum time between two status refreshes of one batch. */
const REFRESH_INTERVAL_MS = 10_000;
/**
 * A PENDING batch without a PayPal id is sent again only after this long, well past the
 * PayPal request timeout, so a resend never races the first request.
 */
const RESEND_AFTER_MS = 60_000;

export interface PayoutItem {
  id: string;
  providerId: string;
  receiver: string;
  amountMicros: number;
  paypalItemId: string | null;
  transactionStatus: string | null;
  updatedAt: string;
}

export interface PayoutBatch {
  id: string;
  paypalBatchId: string | null;
  status: string;
  totalMicros: number;
  createdAt: string;
  updatedAt: string;
  items: PayoutItem[];
}

export interface ProviderEarnings {
  providerId: string;
  /** Unpaid earnings, including carried sub-cent remainders. */
  unpaidMicros: number;
  /** Unpaid earnings rounded down to whole cents: what the next batch pays. */
  payableMicros: number;
  /** Served requests whose earnings are unpaid. */
  requests: number;
  /** A PayPal receiver is set for this provider. */
  connected: boolean;
}

export type SettleResult =
  | { status: "sent"; batch: PayoutBatch }
  | { status: "rejected"; batch: PayoutBatch; message: string }
  | { status: "nothing_to_pay" };

type Row = Record<string, unknown>;

const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));
const text = (value: unknown): string | null => (value === null || value === undefined ? null : String(value));
const iso = (value: unknown): string => (value instanceof Date ? value : new Date(String(value))).toISOString();

export const isFinalBatchStatus = (status: string) => FINAL_BATCH_STATUSES.includes(status);

/** `"12.34"` for 12_340_000 micro-USD. The amount must be whole cents. */
export function centsString(micros: number): string {
  const cents = micros / MICROS_PER_CENT;
  if (!Number.isSafeInteger(cents)) throw new Error("Payout amounts must be whole cents");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function receiverEntries(): { providerIds: string[]; receivers: string[] } {
  const entries = Object.entries(PAYOUT_RECEIVERS);
  return { providerIds: entries.map(([id]) => id), receivers: entries.map(([, email]) => email) };
}

/**
 * Pays every provider with a receiver and at least $0.01 of unpaid earnings in one PayPal
 * Payouts batch. The batch, its items, the paid marks on the earnings, and the carry rows
 * for sub-cent remainders are written in one statement BEFORE PayPal is called, so a crash
 * cannot pay the same earnings twice. If PayPal rejects the batch, the earnings are released.
 */
export async function settlePayouts(): Promise<SettleResult> {
  const { providerIds, receivers } = receiverEntries();
  if (providerIds.length === 0) return { status: "nothing_to_pay" };
  const batchId = `pyb_${randomBase32(20)}`;
  // REPEATABLE READ: a concurrent settle that marked the same earnings makes this one fail
  // instead of paying amounts summed from a stale snapshot.
  const [rows] = (await sql.transaction((txn) => [txn.query(
    `with receiver as (
       select * from unnest($2::text[], $3::text[]) as r(provider_id, receiver)
     ),
     picked as (
       select e.id, e.provider_id, e.amount_micros from provider_earnings e
       join receiver r on r.provider_id = e.provider_id
       where e.payout_item_id is null
     ),
     owed as (
       select p.provider_id, r.receiver, sum(p.amount_micros) as total,
         floor(sum(p.amount_micros) / $4::numeric)::bigint * $4::bigint as paid
       from picked p join receiver r on r.provider_id = p.provider_id
       group by p.provider_id, r.receiver
       having sum(p.amount_micros) >= $4::bigint
     ),
     item_ids as (
       select o.*, $1::text || '_' || row_number() over (order by o.provider_id) as item_id from owed o
     ),
     batch as (
       insert into payout_batches (id, status, total_micros)
       select $1, 'PENDING', sum(paid) from item_ids having count(*) > 0
       returning id
     ),
     items as (
       insert into payout_items (id, batch_id, provider_id, receiver, amount_micros)
       select i.item_id, b.id, i.provider_id, i.receiver, i.paid from item_ids i cross join batch b
       returning id
     ),
     paid_earnings as (
       update provider_earnings e set payout_item_id = i.item_id
       from picked p join item_ids i on i.provider_id = p.provider_id
       where e.id = p.id
       returning e.id
     ),
     carry as (
       insert into provider_earnings (provider_id, request_id, account_id, market_id, amount_micros)
       select provider_id, '${CARRY_PREFIX}' || $1 || ':' || provider_id, '${CARRY_SOURCE}', '${CARRY_SOURCE}', total - paid
       from item_ids where total > paid
       returning id
     )
     select (select count(*) from items) as items, (select count(*) from paid_earnings) as earnings,
       (select count(*) from carry) as carried`,
    [batchId, providerIds, receivers, MICROS_PER_CENT],
  )], { isolationLevel: "RepeatableRead" })) as Row[][];
  if (num(rows[0]?.items) === 0) return { status: "nothing_to_pay" };
  return submitBatch(batchId);
}

interface PayPalCreateBatchResponse {
  batch_header: { payout_batch_id: string; batch_status: string };
}

/**
 * Sends a stored PENDING batch to PayPal. `PayPal-Request-Id` is our batch id, so a resend
 * after an unclear failure returns the first result instead of a second batch.
 * PayPal answering 4xx, or no token, means no batch was created: the earnings are released.
 * A 5xx or network failure keeps the batch PENDING; the next refresh sends it again.
 */
async function submitBatch(batchId: string): Promise<SettleResult> {
  const batch = await getPayoutBatch(batchId);
  if (!batch) throw new Error(`Payout batch ${batchId} not found`);
  try {
    await getAccessToken();
  } catch (error) {
    return reject(batchId, error);
  }
  try {
    const response = await paypalFetch<PayPalCreateBatchResponse>("/v1/payments/payouts", {
      method: "POST",
      requestId: batchId,
      body: {
        sender_batch_header: {
          sender_batch_id: batchId,
          email_subject: "You have a payout from Tender",
          email_message: "Tender paid you for the API requests you served.",
        },
        items: batch.items.map((item) => ({
          recipient_type: "EMAIL",
          amount: { value: centsString(item.amountMicros), currency: "USD" },
          receiver: item.receiver,
          sender_item_id: item.id,
          note: `Earnings from requests served on Tender by ${getProvider(item.providerId)?.name ?? item.providerId}.`,
        })),
      },
    });
    await sql.query(
      `update payout_batches set paypal_batch_id = $2, status = $3, updated_at = now() where id = $1`,
      [batchId, response.batch_header.payout_batch_id, response.batch_header.batch_status],
    );
  } catch (error) {
    if (error instanceof PayPalError && error.status >= 400 && error.status < 500) return reject(batchId, error);
    throw error;
  }
  return { status: "sent", batch: (await getPayoutBatch(batchId))! };
}

/** Marks the batch FAILED and releases its earnings, in one statement. */
async function reject(batchId: string, error: unknown): Promise<SettleResult> {
  await sql.query(
    `with batch as (
       update payout_batches set status = 'FAILED', updated_at = now()
       where id = $1 and status = 'PENDING' and paypal_batch_id is null
       returning id
     ),
     released as (
       update provider_earnings set payout_item_id = null
       where payout_item_id in (select i.id from payout_items i join batch b on b.id = i.batch_id)
       returning id
     ),
     carry as (
       delete from provider_earnings
       where starts_with(request_id, '${CARRY_PREFIX}' || $1 || ':') and payout_item_id is null
         and exists (select 1 from batch)
       returning id
     )
     select (select count(*) from released) as released, (select count(*) from carry) as carry`,
    [batchId],
  );
  const message = error instanceof Error ? error.message : "PayPal rejected the payout batch";
  return { status: "rejected", batch: (await getPayoutBatch(batchId))!, message };
}

interface PayPalBatchDetails {
  batch_header: { payout_batch_id: string; batch_status: string };
  items?: { payout_item_id: string; transaction_status?: string; payout_item?: { sender_item_id?: string } }[];
}

/**
 * Reads a batch's status from PayPal and stores the batch status and each item's status and
 * PayPal item id. A PENDING batch that never reached PayPal is sent again.
 */
export async function refreshPayoutBatch(id: string): Promise<PayoutBatch | null> {
  const batch = await getPayoutBatch(id);
  if (!batch) return null;
  if (!batch.paypalBatchId) {
    if (batch.status !== "PENDING" || Date.now() - Date.parse(batch.createdAt) < RESEND_AFTER_MS) return batch;
    const result = await submitBatch(id);
    return result.status === "nothing_to_pay" ? batch : result.batch;
  }
  const details = await paypalFetch<PayPalBatchDetails>(`/v1/payments/payouts/${encodeURIComponent(batch.paypalBatchId)}`);
  await updateBatchStatus({ id, status: details.batch_header.batch_status });
  for (const item of details.items ?? []) {
    const senderItemId = item.payout_item?.sender_item_id;
    if (!senderItemId || !item.transaction_status) continue;
    await updateItemStatus({ id: senderItemId, paypalItemId: item.payout_item_id, status: item.transaction_status });
  }
  return getPayoutBatch(id);
}

const lastRefresh = new Map<string, number>();

/**
 * Refreshes every batch that is not final, each at most once per 10 s on this server.
 * A failed refresh keeps the stored status.
 */
export async function refreshOpenBatches(): Promise<void> {
  const rows = (await sql.query(
    `select id from payout_batches where status <> all($1::text[]) order by created_at desc limit 20`,
    [FINAL_BATCH_STATUSES],
  )) as Row[];
  const now = Date.now();
  const due = rows.map((row) => String(row.id)).filter((id) => now - (lastRefresh.get(id) ?? 0) >= REFRESH_INTERVAL_MS);
  for (const id of due) lastRefresh.set(id, now);
  await Promise.allSettled(due.map((id) => refreshPayoutBatch(id)));
}

/** Stores a batch status. A final status is never replaced by an older, non-final one. */
async function updateBatchStatus(input: { id?: string; paypalBatchId?: string; status: string }): Promise<void> {
  await sql.query(
    `update payout_batches set status = $3, updated_at = now()
     where (id = $1 or paypal_batch_id = $2) and status <> $3
       and (status <> all($4::text[]) or $3 = any($4::text[]))`,
    [input.id ?? null, input.paypalBatchId ?? null, input.status, FINAL_BATCH_STATUSES],
  );
}

async function updateItemStatus(input: { id?: string; paypalItemId?: string; status: string }): Promise<void> {
  await sql.query(
    `update payout_items set transaction_status = $3, paypal_item_id = coalesce($2, paypal_item_id), updated_at = now()
     where id = $1 or paypal_item_id = $2`,
    [input.id ?? null, input.paypalItemId ?? null, input.status],
  );
}

/**
 * Handles `PAYMENT.PAYOUTSBATCH.*` and `PAYMENT.PAYOUTS-ITEM.*` webhook events after the
 * webhook route verified and stored them. Replays set the same status again (idempotent).
 */
export async function handlePayoutsWebhook(event: PayPalWebhookEvent): Promise<void> {
  const resource = event.resource ?? {};
  if (event.event_type.startsWith("PAYMENT.PAYOUTSBATCH.")) {
    const header = resource.batch_header ?? {};
    const status = text(header.batch_status);
    if (!status) return;
    await updateBatchStatus({
      id: text(header.sender_batch_header?.sender_batch_id) ?? undefined,
      paypalBatchId: text(header.payout_batch_id) ?? undefined,
      status,
    });
  } else if (event.event_type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    const status = text(resource.transaction_status);
    if (!status) return;
    await updateItemStatus({
      id: text(resource.payout_item?.sender_item_id ?? resource.sender_item_id) ?? undefined,
      paypalItemId: text(resource.payout_item_id) ?? undefined,
      status,
    });
  }
}

const BATCH_COLUMNS = `b.id, b.paypal_batch_id, b.status, b.total_micros, b.created_at, b.updated_at,
  coalesce((select json_agg(json_build_object(
    'id', i.id, 'provider_id', i.provider_id, 'receiver', i.receiver, 'amount_micros', i.amount_micros,
    'paypal_item_id', i.paypal_item_id, 'transaction_status', i.transaction_status, 'updated_at', i.updated_at
  ) order by i.amount_micros desc, i.id) from payout_items i where i.batch_id = b.id), '[]') as items`;

function toBatch(row: Row): PayoutBatch {
  return {
    id: String(row.id),
    paypalBatchId: text(row.paypal_batch_id),
    status: String(row.status),
    totalMicros: num(row.total_micros),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    items: (row.items as Row[]).map((item) => ({
      id: String(item.id),
      providerId: String(item.provider_id),
      receiver: String(item.receiver),
      amountMicros: num(item.amount_micros),
      paypalItemId: text(item.paypal_item_id),
      transactionStatus: text(item.transaction_status),
      updatedAt: iso(item.updated_at),
    })),
  };
}

export async function getPayoutBatch(id: string): Promise<PayoutBatch | null> {
  const rows = (await sql.query(`select ${BATCH_COLUMNS} from payout_batches b where b.id = $1`, [id])) as Row[];
  return rows[0] ? toBatch(rows[0]) : null;
}

/** Newest batches first, with their items. */
export async function listPayoutBatches(limit = 50): Promise<PayoutBatch[]> {
  const rows = (await sql.query(`select ${BATCH_COLUMNS} from payout_batches b order by b.created_at desc, b.id desc limit $1`, [limit])) as Row[];
  return rows.map(toBatch);
}

/** Unpaid earnings per provider, plus providers with a receiver and nothing unpaid. Largest first. */
export async function listUnpaidEarnings(): Promise<ProviderEarnings[]> {
  const rows = (await sql.query(
    `select provider_id, sum(amount_micros) as unpaid,
       count(*) filter (where request_id not like '${CARRY_PREFIX}%') as requests
     from provider_earnings where payout_item_id is null
     group by provider_id`,
  )) as Row[];
  const byProvider = new Map(rows.map((row) => [String(row.provider_id), row]));
  const ids = new Set([...byProvider.keys(), ...Object.keys(PAYOUT_RECEIVERS)]);
  return [...ids]
    .map((providerId) => {
      const unpaidMicros = num(byProvider.get(providerId)?.unpaid);
      return {
        providerId,
        unpaidMicros,
        payableMicros: Math.floor(unpaidMicros / MICROS_PER_CENT) * MICROS_PER_CENT,
        requests: num(byProvider.get(providerId)?.requests),
        connected: providerId in PAYOUT_RECEIVERS,
      };
    })
    .sort((a, b) => b.unpaidMicros - a.unpaidMicros || a.providerId.localeCompare(b.providerId));
}
