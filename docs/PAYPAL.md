# PayPal edition: build contract

The shared spec for the PayPal lanes. Every lane builds against this file; change it only through the
orchestrator. Strategy and judging context: [`PAYPAL-HACKATHON.md`](PAYPAL-HACKATHON.md).

## 1. What we build

- **Buyers fund Tender credits with PayPal** (Checkout, Orders v2). Every successful paid request deducts
  the winning bid from the balance. Requests without credits still fall back to x402 USDC.
- **Providers are paid with PayPal Payouts** from the earnings their served requests accrue.
- **Ask Tender**, an AI agent, picks markets, writes policies, buys requests, and funds credits through
  the PayPal Agent Toolkit, within a spending limit the user approves.
- **Provider bidding agents**: an LLM reprices provider bids from load and competition, never below a
  floor price.

## 2. Environment

Secrets and endpoints only; no feature flags.

| Variable | Use |
|---|---|
| `DATABASE_URL` | Neon Postgres, pooled. Runtime queries. |
| `DATABASE_URL_UNPOOLED` | Neon Postgres, direct. Migrations only. |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | PayPal REST app (sandbox). Server only. |
| `PAYPAL_WEBHOOK_ID` | Webhook signature verification. |
| `PAYPAL_API_BASE` | Optional. Default `https://api-m.sandbox.paypal.com`. The JS SDK host follows it (`www.sandbox.paypal.com` for sandbox, `www.paypal.com` for live). |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway. On Vercel the gateway can also use the project's OIDC token. |

One Neon database (`tender-ledger`, region iad1) serves every environment. Local secrets for lanes are in
`/Users/junhoyeo/.cache/tender-agent/tender-secrets.env` (copy it to your worktree's `.env.local`; it is
git-ignored). Never print secret values.

AI Gateway is on the free tier: use `openai/gpt-5-mini` (default) or `google/gemini-2.5-flash`. Keep the
model id in one constant so it can move to a stronger model when credits are added.

## 3. Money

- All amounts are **integer micro-USD** (`bigint` in SQL, `number` in TypeScript is safe below 2^53):
  `1 USD = 1_000_000` micro-USD.
- A bid of **$X per million requests costs exactly X micro-USD per request** (`$18 /M req` = 18 micro-USD).
  Round fractional bids **up** to the next micro-USD.
- PayPal amounts are strings with two decimals (`"10.00"`). Convert with integer math only.
- Top-up amounts: $5, $10, $20 (buttons), max $100 per order.
- Payouts are **whole cents**. Each provider is paid its unpaid earnings rounded **down** to the cent;
  the remainder carries to the next batch. Providers with less than $0.01 are skipped.

## 4. Accounts and authentication

- **Account**: `acct_` + 24 random base32 characters. Created lazily on the first write (top-up,
  API key, mandate). The browser holds it in the `tender_account` cookie (httpOnly, Secure,
  SameSite=Lax, 1 year).
- **API keys** for the SDK, MCP, and agents: `tk_` + 32 random characters, shown once; store only a
  SHA-256 hash and an 8-character prefix. Sent as `Authorization: Bearer tk_...`.
- **Cookie spending needs an explicit header**: a contract request pays with credits from the cookie
  account only when it carries `Tender-Payment: credits`. The custom header forces a CORS preflight, so
  other sites cannot spend a visitor's credits. API keys need no extra header.
- **Start over** (UI label; never "reset demo"): `POST /api/account/reset` issues a fresh account cookie.
  Old rows stay in the database.

## 5. Database

Migrations are plain SQL in `db/migrations/NNNN_name.sql`, applied in order by `bun run db:migrate`
(`scripts/db/migrate.ts`, uses `DATABASE_URL_UNPOOLED`, records applied files in `schema_migrations`).
Driver: `@neondatabase/serverless` (`neon()` for single statements). Every money change is ONE atomic
SQL statement (CTEs), so no interactive transactions are needed.

```sql
create table accounts (
  id text primary key,
  created_at timestamptz not null default now(),
  balance_micros bigint not null default 0 check (balance_micros >= 0),
  -- spending mandate for agents (null = agents may not spend)
  mandate_weekly_cap_micros bigint,
  mandate_policy jsonb,               -- routing policy the agent must use
  mandate_vault_id text,              -- PayPal vault payment token for agent top-ups (optional)
  mandate_approved_at timestamptz
);

create table ledger_entries (
  id bigserial primary key,
  account_id text not null references accounts(id),
  kind text not null check (kind in ('topup', 'charge', 'refund', 'adjustment')),
  amount_micros bigint not null,      -- +credit, -debit
  balance_after_micros bigint not null,
  actor text not null default 'user' check (actor in ('user', 'agent', 'api_key', 'system')),
  market_id text, provider_id text, request_id text,
  paypal_order_id text, paypal_capture_id text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);
create unique index ledger_capture_once on ledger_entries (paypal_capture_id) where paypal_capture_id is not null;
create unique index ledger_request_once on ledger_entries (request_id) where kind = 'charge';
create index ledger_account_time on ledger_entries (account_id, created_at desc);

create table paypal_orders (
  id text primary key,                -- PayPal order id
  account_id text not null references accounts(id),
  amount_micros bigint not null,
  status text not null,               -- CREATED | COMPLETED | FAILED
  capture_id text unique,
  actor text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table webhook_events (
  id text primary key,                -- PayPal event id (idempotency)
  event_type text not null,
  resource_id text,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

create table api_keys (
  id text primary key,                -- key_...
  account_id text not null references accounts(id),
  hash text not null unique,
  prefix text not null,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table provider_earnings (
  id bigserial primary key,
  provider_id text not null,
  request_id text not null unique,
  account_id text not null,
  market_id text not null,
  amount_micros bigint not null,
  payout_item_id text,                -- set when paid
  created_at timestamptz not null default now()
);

create table payout_batches (
  id text primary key,                -- our sender_batch_id
  paypal_batch_id text unique,
  status text not null,               -- PENDING | PROCESSING | SUCCESS | DENIED | FAILED ...
  total_micros bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payout_items (
  id text primary key,                -- our sender_item_id
  batch_id text not null references payout_batches(id),
  provider_id text not null,
  receiver text not null,             -- sandbox email
  amount_micros bigint not null,      -- whole cents
  paypal_item_id text,
  transaction_status text,
  updated_at timestamptz not null default now()
);
```

## 6. Ledger API (`src/lib/ledger`, owned by the core lane)

```ts
export type Actor = "user" | "agent" | "api_key" | "system";
export interface AccountSummary { id: string; balanceMicros: number; mandate: Mandate | null }
export interface Mandate { weeklyCapMicros: number; spentThisWeekMicros: number; policy: unknown; hasVault: boolean; approvedAt: string }

getOrCreateAccount(id?: string): Promise<AccountSummary>
getAccount(id: string): Promise<AccountSummary | null>
accountFromRequest(request: Request): Promise<{ accountId: string; actor: Actor } | null>  // API key or cookie (+ Tender-Payment header for spending)
creditTopUp(input: { accountId: string; amountMicros: number; orderId: string; captureId: string; actor: Actor }): Promise<{ credited: boolean; balanceMicros: number }>  // once per captureId
chargeForRequest(input: { accountId: string; requestId: string; marketId: string; providerId: string; amountMicros: number; actor: Actor }): Promise<{ ok: true; balanceMicros: number } | { ok: false; reason: "insufficient_credits" | "mandate_exceeded"; balanceMicros: number }>  // debit + provider earning in one statement; idempotent per requestId
listLedger(accountId: string, limit?: number): Promise<LedgerEntry[]>
createApiKey(accountId: string, label?: string): Promise<{ id: string; secret: string; prefix: string }>
setMandate(accountId: string, input: { weeklyCapMicros: number; policy: unknown; vaultId?: string }): Promise<Mandate>
```

`chargeForRequest` with `actor: "agent"` must also respect the mandate (sum of agent charges since the
start of the ISO week plus this amount must not exceed `mandate_weekly_cap_micros`).

## 7. HTTP routes

| Route | Lane | Behavior |
|---|---|---|
| `GET /api/account` | core | Balance, mandate, last 20 ledger entries. Never creates an account. |
| `POST /api/account/reset` | core | New account cookie ("Start over"). |
| `GET /api/ledger` | core | Ledger entries for the account (transactions grid). |
| `POST /api/keys`, `GET /api/keys`, `DELETE /api/keys/{id}` | core | API keys. |
| `POST /api/paypal/client-token` | core | Browser-safe JS SDK v6 client token. |
| `POST /api/paypal/orders` | core | `{ amountUsd }` -> creates an Orders v2 order (`intent: CAPTURE`, `custom_id` = account id, `PayPal-Request-Id` for idempotency) -> `{ orderId }`. |
| `POST /api/paypal/orders/{id}/capture` | core | Captures; on `COMPLETED` calls `creditTopUp` -> `{ status, balanceMicros }`. |
| `POST /api/paypal/webhook` | core | Verifies the signature, stores the event once, then dispatches: `PAYMENT.CAPTURE.COMPLETED` -> `creditTopUp` (idempotent); `PAYMENT.PAYOUTSBATCH.*` and `PAYMENT.PAYOUTS-ITEM.*` -> `handlePayoutsWebhook(event)` from `src/lib/paypal/payouts.ts`. |
| `GET /api/payouts`, `POST /api/payouts/settle` | payouts | Batches and items; settle pays unpaid earnings. |
| `POST /api/ask` | ask | AI SDK UI message stream for Ask Tender. |
| `POST /api/bidding/round` | bidding | `{ marketId, policy?, providers?, activeProviderId?, recentRequests?, recentWinners? }` (the console's current state; registry defaults when omitted) -> new bids from the LLM. |

Contract route (`/api/v1/{namespace}/{action}`, core lane): if `accountFromRequest` returns an account,
serve the request and call `chargeForRequest` with the winning bid; on success respond 200 with the usual
envelope plus `payment: { method: "credits", charged_micros, balance_micros }`; on
`insufficient_credits` respond **402** with `{ error: { code: "insufficient_credits" }, balance_micros,
top_up_url: "/account" }` and no data. Without an account, x402 USDC works exactly as today.

## 8. PayPal API reference (sandbox)

Verify details against developer.paypal.com before relying on them.

- OAuth: `POST {base}/v1/oauth2/token`, Basic auth `client_id:secret`, body
  `grant_type=client_credentials`. Cache the token until shortly before `expires_in`.
- JS SDK v6 client token: same endpoint with body
  `grant_type=client_credentials&response_type=client_token&intent=sdk_init`. Script:
  `https://www.sandbox.paypal.com/web-sdk/v6/core`. If v6 blocks you, use the v5 SDK
  (`https://www.sandbox.paypal.com/sdk/js?client-id=...`) and update the README table.
- Orders: `POST /v2/checkout/orders`; capture `POST /v2/checkout/orders/{id}/capture`; the capture id is
  `purchase_units[0].payments.captures[0].id`.
- Webhook verification: `POST /v1/notifications/verify-webhook-signature` with `auth_algo`, `cert_url`,
  `transmission_id`, `transmission_sig`, `transmission_time` (from the `paypal-*` headers),
  `webhook_id`, `webhook_event`; accept only `verification_status: "SUCCESS"`.
- Payouts: `POST /v1/payments/payouts` (`sender_batch_header.sender_batch_id`, items with
  `recipient_type: "EMAIL"`, `amount.value`, `receiver`, `sender_item_id`); status
  `GET /v1/payments/payouts/{payout_batch_id}`.
- Vault (agent top-ups without a popup): setup token `POST /v3/vault/setup-tokens`, payment token
  `POST /v3/vault/payment-tokens`, then orders with `payment_source.paypal.vault_id`. If the sandbox app
  lacks Vault, the agent asks the user to approve each top-up in Checkout instead.
- Agent Toolkit: `@paypal/agent-toolkit` (`/ai-sdk` entry for the Vercel AI SDK). Check its README for the
  exact constructor and action names.

## 9. Lanes and file ownership

| Lane | Owns | Depends on |
|---|---|---|
| core (ledger + checkout + credits) | `db/`, `scripts/db/`, `src/lib/db/`, `src/lib/ledger/`, `src/lib/paypal/{client,orders,webhooks}.ts`, `src/app/api/{account,keys,ledger,paypal}/`, the credits path in `src/lib/server/handlers.ts`, `src/app/account/` page, `src/components/credits/` (balance chip, Add funds dialog, Start over), the market-page credits card | DB, PayPal keys |
| payouts | `src/lib/paypal/payouts.ts`, `src/app/api/payouts/`, `src/app/payouts/` page, `src/components/payouts/` | ledger tables, AG Grid wrapper |
| ask | `src/app/api/ask/`, `src/lib/agent/`, `src/components/ask/` | ledger API, AI Gateway, Agent Toolkit |
| bidding | `src/lib/bidding/`, `src/app/api/bidding/`, the bid-update action in the client store | AI Gateway |
| AG Grid (running) | `src/components/ui/data-grid.tsx`, providers/receipts/activity tables | — |

Shared UI rules: PP Mori only; lime is a fill with ink text; olive for accent text and focus. Never show
"Demo", "Simulation", "Mock", "Static", "Coming soon", "sandbox", or any disclaimer in the UI. Money in the
UI uses `$` with enough decimals to show micro-USD amounts (for example `$0.000018`).

## 10. Judge path (the demo must work end to end)

1. Open a market, click **Add funds**, pay $10 with the PayPal sandbox buyer account; the balance shows
   $10.00 within seconds.
2. Run paid requests with credits; each deducts the winning bid; the transactions grid updates.
3. Ask Tender: "Keep my app on the cheapest San Francisco weather feed under $30 per million requests with
   P95 under 300 ms, and don't spend more than $5 this week." The agent sets the policy and mandate, runs
   requests, and reports spend.
4. Providers rebid; a failover moves traffic; the activity log explains why.
5. **Settle now** on `/payouts` sends a PayPal Payouts batch; items reach SUCCESS.
6. **Start over** gives a clean account.
