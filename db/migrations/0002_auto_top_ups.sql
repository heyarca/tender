-- Automatic top-ups by Ask Tender from a saved PayPal account (docs/PAYPAL.md section 5).

-- Payer email PayPal returned when the account was saved (shown on /account).
alter table accounts add column mandate_vault_email text;

-- One row per automatic top-up. A row is written before PayPal is charged, so agent top-ups since
-- Monday 00:00 UTC (PENDING and COMPLETED rows) can never pass the weekly limit, even under concurrent runs.
create table auto_top_ups (
  id text primary key,                -- our PayPal-Request-Id for the order (auto_...)
  account_id text not null references accounts(id),
  amount_micros bigint not null check (amount_micros > 0),
  status text not null check (status in ('PENDING', 'COMPLETED', 'FAILED')),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index auto_top_ups_account_time on auto_top_ups (account_id, created_at desc);
