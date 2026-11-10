import { accountForApiKey } from "./keys";
import { accountFromRequest, bearerToken, cookieAccountForWrite, hasApiKey } from "./request";
import type { AccountResponse, AccountSummary, Actor, ApiKeySummary, ApiKeyView, LedgerEntry, LedgerEntryView, Mandate, MandateView } from "./types";

/**
 * JSON for the account routes: never cached, and no `Access-Control-Allow-Origin`, so other
 * sites cannot read a visitor's balance or keys.
 */
export function accountJson(body: unknown, status = 200, setCookie?: string | null): Response {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return Response.json(body, { status, headers });
}

export function accountError(status: number, code: string, message: string): Response {
  return accountJson({ error: { code, message } }, status);
}

/** Writes must send JSON. A cross-site form cannot, and a cross-site fetch then needs a preflight. */
export function requireJson(request: Request): Response | null {
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  return type === "application/json" ? null : accountError(415, "unsupported_media_type", "Send application/json");
}

/** Reads a small JSON object body; `{}` for an empty body. */
export async function readJsonObject(request: Request, maxBytes = 4096): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("Request body is too large");
  if (!text.trim()) return {};
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
}

const invalidKey = () => accountError(401, "invalid_api_key", "The API key is unknown or revoked");

/** Account a read route acts on: an API key, or the cookie alone. `null` when there is none yet. */
export async function readAccount(request: Request): Promise<{ accountId: string; actor: Actor } | null | Response> {
  const account = await accountFromRequest(request, { purpose: "read" });
  if (!account && hasApiKey(request)) return invalidKey();
  return account;
}

/** Account a write route acts on: an API key, or the cookie account (a new one, with its cookie, when missing). */
export async function writeAccount(request: Request): Promise<{ accountId: string; actor: Actor; setCookie: string | null } | Response> {
  if (hasApiKey(request)) {
    const accountId = await accountForApiKey(bearerToken(request) ?? "");
    return accountId ? { accountId, actor: "api_key", setCookie: null } : invalidKey();
  }
  return { ...cookieAccountForWrite(request), actor: "user" };
}

export function mandateView(mandate: Mandate | null): MandateView | null {
  return mandate && {
    weekly_cap_micros: mandate.weeklyCapMicros,
    spent_this_week_micros: mandate.spentThisWeekMicros,
    policy: mandate.policy,
    has_vault: mandate.hasVault,
    approved_at: mandate.approvedAt,
  };
}

/** Account JSON. The account id stays out of it: with the cookie it is a credential. */
export function accountView(account: AccountSummary | null): Omit<AccountResponse, "ledger"> {
  return { has_account: account !== null, balance_micros: account?.balanceMicros ?? 0, mandate: mandateView(account?.mandate ?? null) };
}

export function entryView(entry: LedgerEntry): LedgerEntryView {
  return {
    id: entry.id,
    kind: entry.kind,
    amount_micros: entry.amountMicros,
    balance_after_micros: entry.balanceAfterMicros,
    actor: entry.actor,
    market_id: entry.marketId,
    provider_id: entry.providerId,
    request_id: entry.requestId,
    paypal_order_id: entry.paypalOrderId,
    paypal_capture_id: entry.paypalCaptureId,
    auto_top_up: entry.metadata.auto_top_up === true,
    created_at: entry.createdAt,
  };
}

export function apiKeyView(key: ApiKeySummary): ApiKeyView {
  return { id: key.id, prefix: key.prefix, label: key.label, created_at: key.createdAt, last_used_at: key.lastUsedAt };
}
