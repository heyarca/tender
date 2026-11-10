/** PayPal REST client (server only): OAuth token cache and a JSON fetch wrapper. */

const SANDBOX_API_BASE = "https://api-m.sandbox.paypal.com";
/** Refresh the access token this long before PayPal says it expires. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const REQUEST_TIMEOUT_MS = 20_000;

export class PayPalError extends Error {
  status: number;
  debugId?: string;
  details?: unknown;

  constructor(message: string, status: number, debugId?: string, details?: unknown) {
    super(message);
    this.name = "PayPalError";
    this.status = status;
    this.debugId = debugId;
    this.details = details;
  }
}

/** REST API host: `PAYPAL_API_BASE`, else the sandbox. */
export function paypalApiBase(): string {
  return (process.env.PAYPAL_API_BASE || SANDBOX_API_BASE).replace(/\/+$/, "");
}

export function paypalCredentials(): { clientId: string; secret: string } {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new PayPalError("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set", 503);
  return { clientId, secret };
}

/** Reads a PayPal error body into a PayPalError (`name`, `message`, `debug_id`, `details`). */
async function toPayPalError(response: Response, fallback: string): Promise<PayPalError> {
  let body: Record<string, unknown> | undefined;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = undefined;
  }
  const message = typeof body?.message === "string" ? body.message
    : typeof body?.error_description === "string" ? body.error_description
    : typeof body?.name === "string" ? body.name
    : fallback;
  const debugId = typeof body?.debug_id === "string" ? body.debug_id : response.headers.get("paypal-debug-id") ?? undefined;
  return new PayPalError(message, response.status, debugId, body?.details ?? body);
}

/** `POST /v1/oauth2/token` with client credentials. `extra` adds form fields (for example a client token). */
export async function requestToken(extra: Record<string, string> = {}): Promise<{ access_token: string; expires_in: number }> {
  const { clientId, secret } = paypalCredentials();
  const response = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", ...extra }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw await toPayPalError(response, "PayPal authentication failed");
  return (await response.json()) as { access_token: string; expires_in: number };
}

let cached: { token: string; expiresAt: number } | undefined;
let pending: Promise<string> | undefined;

/** Server access token, cached until 60 s before it expires. Concurrent callers share one request. */
export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  pending ??= requestToken()
    .then(({ access_token, expires_in }) => {
      cached = { token: access_token, expiresAt: Date.now() + expires_in * 1000 - TOKEN_REFRESH_MARGIN_MS };
      return access_token;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}

/**
 * JSON request to the PayPal REST API with the cached Bearer token. `requestId` is sent as
 * `PayPal-Request-Id`, so PayPal answers a retried call with the first result. Throws
 * PayPalError on a non-2xx status.
 */
export async function paypalFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; requestId?: string; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getAccessToken()}`,
    Accept: "application/json",
    ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    ...init.headers,
  };
  const response = await fetch(`${paypalApiBase()}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 401) cached = undefined;
  if (!response.ok) throw await toPayPalError(response, `PayPal request failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
