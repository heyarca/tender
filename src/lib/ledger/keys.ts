import { sql } from "@/lib/db";
import { ensureAccount, textOrNull, toIso, toIsoOrNull } from "./accounts";
import { API_KEY_PATTERN, hashApiKey, isAccountId, newApiKeyId, newApiKeySecret } from "./ids";
import type { ApiKeySummary } from "./types";

type Row = Record<string, unknown>;

/** Characters of the secret after `tk_` kept for display. */
const PREFIX_LENGTH = 8;

/** Creates an API key. The secret is returned once; only its SHA-256 hash and an 8-character prefix are stored. */
export async function createApiKey(
  accountId: string,
  label?: string,
): Promise<{ id: string; secret: string; prefix: string; label: string | null; createdAt: string }> {
  await ensureAccount(accountId);
  const id = newApiKeyId();
  const secret = newApiKeySecret();
  const prefix = secret.slice(3, 3 + PREFIX_LENGTH);
  const cleanLabel = label?.trim().slice(0, 60) || null;
  const rows = (await sql.query(
    "insert into api_keys (id, account_id, hash, prefix, label) values ($1, $2, $3, $4, $5) returning created_at",
    [id, accountId, hashApiKey(secret), prefix, cleanLabel],
  )) as Row[];
  return { id, secret, prefix, label: cleanLabel, createdAt: toIso(rows[0]?.created_at) };
}

/** Active (not revoked) keys of an account, newest first. */
export async function listApiKeys(accountId: string): Promise<ApiKeySummary[]> {
  if (!isAccountId(accountId)) return [];
  const rows = (await sql.query(
    `select id, prefix, label, created_at, last_used_at, revoked_at from api_keys
     where account_id = $1 and revoked_at is null order by created_at desc limit 100`,
    [accountId],
  )) as Row[];
  return rows.map((row) => ({
    id: String(row.id),
    prefix: String(row.prefix),
    label: textOrNull(row.label),
    createdAt: toIso(row.created_at),
    lastUsedAt: toIsoOrNull(row.last_used_at),
    revokedAt: toIsoOrNull(row.revoked_at),
  }));
}

/** Revokes a key of this account. False when the key is unknown, revoked, or someone else's. */
export async function revokeApiKey(accountId: string, keyId: string): Promise<boolean> {
  if (!isAccountId(accountId) || !/^key_[a-z2-7]{16}$/.test(keyId)) return false;
  const rows = (await sql.query(
    "update api_keys set revoked_at = now() where id = $1 and account_id = $2 and revoked_at is null returning id",
    [keyId, accountId],
  )) as Row[];
  return rows.length > 0;
}

/** Account of an active API key, recording its use. Null for unknown or revoked keys. */
export async function accountForApiKey(secret: string): Promise<string | null> {
  if (!API_KEY_PATTERN.test(secret)) return null;
  const rows = (await sql.query(
    "update api_keys set last_used_at = now() where hash = $1 and revoked_at is null returning account_id",
    [hashApiKey(secret)],
  )) as Row[];
  return rows[0] ? String(rows[0].account_id) : null;
}
