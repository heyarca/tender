-- Ledger schema: docs/PAYPAL.md section 5.

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
