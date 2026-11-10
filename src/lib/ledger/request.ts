import { isAccountId, newAccountId } from "./ids";
import { accountForApiKey } from "./keys";
import type { Actor } from "./types";

export const ACCOUNT_COOKIE = "tender_account";
/** Header a cookie-authenticated request must carry to spend credits (`Tender-Payment: credits`). */
export const PAYMENT_HEADER = "Tender-Payment";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/** Account id in the `tender_account` cookie, if it is well formed. */
export function accountIdFromCookie(request: Request): string | null {
  const value = readCookie(request, ACCOUNT_COOKIE);
  return isAccountId(value) ? value : null;
}

/** The bearer token of the `Authorization` header. */
export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

/** True when the request names an API key (`Authorization: Bearer tk_...`), valid or not. */
export function hasApiKey(request: Request): boolean {
  return bearerToken(request)?.startsWith("tk_") ?? false;
}

/** True when the request asks to pay with credits (`Tender-Payment: credits`). */
export function wantsCredits(request: Request): boolean {
  return request.headers.get(PAYMENT_HEADER)?.trim().toLowerCase() === "credits";
}

/**
 * The paying account of a request: an API key (`Authorization: Bearer tk_...`), or the
 * `tender_account` cookie. For spending, the cookie counts only with `Tender-Payment: credits`
 * (the custom header forces a CORS preflight, so other sites cannot spend a visitor's credits).
 * `purpose: "read"` accepts the cookie alone.
 */
export async function accountFromRequest(
  request: Request,
  options: { purpose?: "spend" | "read" } = {},
): Promise<{ accountId: string; actor: Actor } | null> {
  const token = bearerToken(request);
  if (token?.startsWith("tk_")) {
    const accountId = await accountForApiKey(token);
    return accountId ? { accountId, actor: "api_key" } : null;
  }
  const accountId = accountIdFromCookie(request);
  if (!accountId) return null;
  if ((options.purpose ?? "spend") === "spend" && !wantsCredits(request)) return null;
  return { accountId, actor: "user" };
}

/** `Set-Cookie` value that stores an account id for a year. */
export function accountCookie(accountId: string): string {
  return `${ACCOUNT_COOKIE}=${accountId}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * The cookie account of a request that is about to write (top-up, API key, mandate).
 * Returns a new id and its `Set-Cookie` value when the browser has none yet.
 */
export function cookieAccountForWrite(request: Request): { accountId: string; setCookie: string | null } {
  const existing = accountIdFromCookie(request);
  if (existing) return { accountId: existing, setCookie: null };
  const accountId = newAccountId();
  return { accountId, setCookie: accountCookie(accountId) };
}
