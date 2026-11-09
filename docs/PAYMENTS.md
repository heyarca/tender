# Tender payments

Tender accepts USDC per request through x402 v2, on **Base Sepolia only** (`eip155:84532`).
The token contract is `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals).
No mainnet network or wildcard is registered.

## Flow

1. Call `/api/v1/weather/current` or `/api/v1/prices/spot` without payment.
2. The API selects the provider once for that HTTP request. Its bid and public receiving address become the quote.
3. The API returns HTTP 402, `Tender-Provider`, and `PAYMENT-REQUIRED` (base64 x402 v2 requirements).
4. An x402 client signs a USDC EIP-3009 authorization and retries with `PAYMENT-SIGNATURE`.
5. The facilitator verifies the authorization. The selected handler runs. For a successful response, the facilitator submits the transfer.
6. `PAYMENT-RESPONSE` contains the settlement result, transaction hash, network and payer. Failed handlers are not settled.

The default public facilitator is `https://facilitator.payai.network`. Its `/supported` endpoint advertises v2 `exact` on `eip155:84532`.
The original `https://x402.org/facilitator` also advertised support on 2026-11-09, but its signer balance was below the transfer gas upper bound and settlement failed while the identical local chain call succeeded. Tender uses PayAI's funded public facilitator instead. The endpoint remains configurable through `TENDER_FACILITATOR_URL`.
EIP-3009 uses an off-chain signature. The facilitator broadcasts and pays gas; the payer needs USDC, not ETH or an approval transaction.

Selection is stateless per API request. The console's switch cooldown and pinned-mode notifications are UI behavior. A retry is a new HTTP request and re-evaluates the same policy; a changed quote cannot spend an authorization for another payee or amount.
Within each HTTP request, the quote and result always share one selection.

## Exact bids and USDC rounding

A bid of `$X /M requests` is `X / 1,000,000` USD per request and `X` USDC atomic units.
USDC cannot transfer a fractional atomic unit. Tender rounds **up**, never down to zero.
The extra charge is always less than one atomic unit.

- Together's `$18 /M` bid settles as `18` atomic units (`0.000018` USDC).
- Parasail's `$0.70 /M` bid has `price_usd: 0.0000007` and settles as `1` atomic unit (`0.000001` USDC).
- Fireworks' `$27.50 /M` bid settles as `28` atomic units (`0.000028` USDC).

Quotes, the 402 JSON body, payment requirements `extra`, paid JSON responses and receipt objects include:

```ts
{
  price_usd: number;       // exact provider bid per request
  settled_usd: number;     // actual rounded USDC amount
  settled_atomic: string;  // integer string; never a floating-point token amount
  settlement_note?: "Rounded up to the USDC minimum unit (0.000001)";
}
```

The note is present whenever rounding applies. The requirement description also states the exact bid and settled amount.

## Public endpoints

### `POST /api/payments/demo-request`

```json
{"market":"btc-usd","policy":{"preference":"lowest-cost"}}
```

`market` is `sf-weather` or `btc-usd`. Optional `policy` fields match the console:
`maxPrice` (USD/M), `maxP95LatencyMs`, `maxDataAgeMs`, `minSuccessRate` (0–1),
`preference` (`lowest-cost`, `lowest-latency`, `freshest-data`), and
`mode` (`{"kind":"auto"}` or `{"kind":"pinned","providerId":"together"}`).
Optional `conditions` contains up to 16 provider-id keys, each with a partial patch of
`bidPrice`, `p95LatencyMs`, `dataAgeMs`, `errorRate` (0–1), and `available`.
Only providers in the requested market are allowed. Unknown fields and invalid types are rejected before any signature; finite numeric values are clamped with the same engine sanitizer as the console.
The snapshot is passed to the contract handler in-process for both the challenge and signed retry. Public contract query parameters/headers cannot inject provider conditions.

For example, `{ "market": "sf-weather", "conditions": { "together": { "bidPrice": 45 } } }` routes the paid request to DeepInfra under the default policy and pays DeepInfra's address.
A selected bid above `$100 /M` exceeds the wallet's `100`-atomic cap and returns a clear 422 error before signing.

The server-owned payer uses `@x402/fetch`. Its fetch transport dispatches directly to the same contract handler in-process, including the 402 challenge and signed retry. It does not trust incoming Host/forwarded-host headers and does not make an HTTP self-call. Vercel deployment protection cannot block that internal transport.

The response is `{ response, receipt }`. `receipt` includes:
`txHash`, `amountUsd` (settled amount), `amountAtomic`, `asset: "USDC"`, `payer`, `payTo`,
`providerId`, `providerName`, `latency_ms`, `data_age_ms`, `network: "base-sepolia"`, `explorerUrl`, plus the exact/settled fields above.
`response` contains the normalized contract payload, including `provider`, `latency_ms` and `data_age_ms`.
No success receipt is invented when the facilitator fails.

### Optional progress stream

Clients may send `Accept: application/x-ndjson`. Once validation and rate-limit checks pass, the endpoint returns HTTP 200 with newline-delimited events:

- `{"type":"payment-required","providerId":"together","payTo":"0x…","settled_atomic":"18"}` after the real x402 402 challenge is decoded and checked.
- `{"type":"signed"}` immediately before dispatching the retry that actually carries `PAYMENT-SIGNATURE`.
- `{"type":"result","result":...}` only after settlement and the contract response are verified.
- Or `{"type":"error","status":409,"error":"...","details":...}` with the original failure status and structured details.

Pre-stream validation, missing-wallet and rate-limit errors remain ordinary JSON with their HTTP status; 429 includes `Retry-After: 60`.
Legacy JSON callers are unchanged. A disconnected stream aborts work before authorization/settlement when possible, but never releases the in-flight wallet lock while an already-started settlement is still running.

The client hook exposes `stage: "idle" | "payment-required" | "signed" | "complete" | "failed"` and `failure: { status, message, retryAfterSeconds?, details? } | null`, in addition to the existing `error` string. Status 0 identifies network errors. Non-JSON error pages retain their HTTP status. An interrupted stream without a terminal receipt is a failure, never assumed payment success.

### `GET /api/payments/balances`

Returns `{ network, asset, tokenAddress, payer, payees }`. Each balance has `id`, `address`, `amountAtomic` and `amountUsd` (decimal string).
`payer` is null if no key is configured. The payer and all payees are read in one Base Sepolia Multicall3 `eth_call`, without per-provider RPC fan-out.
Each warm instance coalesces concurrent reads and caches a successful snapshot for five seconds. The cache is keyed by RPC endpoint and payer address; failures are never cached and expired snapshots are not served as fresh.
A failed batch is retried once. Each attempt is bounded to 3.5 seconds and the complete operation has a 7.5-second deadline.
Reads that would reach the RPC are rate-limited to 30 per minute per warm instance; over the limit the route returns 429 with `Retry-After`. Cached and coalesced responses bypass the limiter.
When a fresh read fails and the last successful snapshot in this instance is at most 60 seconds old, the route returns 200 with that snapshot plus `stale: true` and `as_of` (ISO time of the snapshot). It returns 502 only when no usable snapshot exists. Failures never refresh the snapshot. Fresh responses carry no `stale`/`as_of` fields.
HTTP responses remain `private, no-store`; only the short server-side cache is used.

## Payer safety

The public buyer endpoint is a shared **testnet** wallet, not an authenticated billing system.
It allows one request in flight, six attempts per minute and sixty attempts per hour **per warm instance**.
Failed attempts also count. This is not a durable global limit: serverless scale-out and cold starts reset the state.
Only keep disposable testnet tokens in this wallet.

The x402 client refuses more than `100` atomic USDC (`0.000100` USDC) per request, any network except Base Sepolia,
any asset except the configured USDC contract, any scheme except `exact`, or any payee outside the committed provider map.
It also verifies the amount against the exact bid before signing. It never follows redirects or automatically creates a second payment after a failed signed retry.

Cancellation is checked before signing, local dispatch, and provider execution, and again before starting settlement. The in-flight lock remains held until the underlying operation ends; cancellation does not release it while a transfer can still finish. Facilitator calls have bounded 20-second deadlines.

A timeout during settlement has an **unknown outcome**: a transfer may still land on-chain. Check the payer/payee balances and explorer before trying again.

## Setup and funding

```sh
bun run payments:wallets
bun run payments:balances
bun run dev -p 3106
```

The wallets script creates `TENDER_DEMO_PAYER_PRIVATE_KEY` in gitignored `.env.local` with file mode 0600, only when missing. It prints the public payer address, never the private key. It does not rotate an existing wallet.
The 16 payee addresses are committed in `src/lib/payments/payees.ts`. Their private keys were discarded; these addresses only receive disposable testnet tokens.

To fund the payer:

1. Run `bun run payments:wallets` and copy the public payer address.
2. Open <https://faucet.circle.com>.
3. Choose **USDC** and **Base Sepolia**.
4. Paste the payer address and complete the faucet's human verification.
5. Request funds, then run `bun run payments:balances` until the payer has a nonzero balance.

No ETH faucet is required for the payer. Do not send real USDC or mainnet assets.

### Environment variables

| Name | Purpose | Default |
| --- | --- | --- |
| `TENDER_DEMO_PAYER_PRIVATE_KEY` | Secret server-side testnet payer key | Required for paid requests |
| `TENDER_FACILITATOR_URL` | x402 facilitator endpoint | `https://facilitator.payai.network` |
| `TENDER_RPC_URL` | Base Sepolia RPC endpoint | `https://sepolia.base.org` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Optional CLI smoke HTTP access through preview protection | None |
| `TENDER_PREVIEW_URL` | Trusted HTTPS deployment origin for the smoke CLI bypass credential | Required only with a bypass secret; localhost never receives it |

Never use `NEXT_PUBLIC_` for a wallet secret. Bun loads `.env.local` for the scripts; Next loads it for local routes.
No environment variable switches payment behavior or enables a mainnet network.

## Verification

```sh
curl -i http://localhost:3106/api/v1/prices/spot
bun run payments:smoke http://localhost:3106 btc-usd
bun scripts/payments/inspect.ts <txHash>
bun run typecheck
bun run lint
bun run test
bun run build
```

`payments:smoke <baseUrl> [sf-weather|btc-usd]` performs a real HTTP paid request and prints the result and receipt.
The public API can be called with any x402-compatible wallet; the public buyer endpoint specifically uses Tender's testnet payer.

Vercel project: **the-zone-bio/tender**, connected to `heyarca/tender`. Only the isolated CLI configuration is used:

```sh
vercel -Q ~/.config/tender-vercel deploy --scope the-zone-bio --yes
vercel -Q ~/.config/tender-vercel curl /api/v1/prices/spot --deployment <preview-url> --scope the-zone-bio
```

The payer secret must be added to Preview and Production through stdin, never committed or printed.
Deployments remain previews; do not run `--prod` as part of payment verification.
Protected preview smoke can call `/api/payments/demo-request` via `vercel curl` (its internal transport still executes real x402 verification and settlement), or use the HTTP smoke script with an authorized protection-bypass secret.

## Module interface

- `quoteFromBid(providerId, bidPerMillion, description): ValidatedPaymentQuote` in `quote.ts` / `server.ts`.
- `withX402Payment<T extends PaymentQuote>(handler, quote, paymentServer?): (request: Request) => Promise<Response>` in `server.ts`. The quote callback runs once; the handler receives the same enriched quote and any routing context carried in `T`.
- `performPaidRequest(url, transport?, callerSignal?, onProgress?): Promise<PaidRequestResult>` in `buyer.ts`.
- `usePaidRequest(market)` in `client.ts` returns `{ run({ policy?, conditions? }), receipts, pending, error, failure, stage }` (legacy `run(policy)` is also accepted). Receipt history is capped at 50; concurrent clicks do not duplicate payments.

Tests cover bid conversion, rounding disclosure, quote validation, payee lookup, real SDK 402 encoding with a test facilitator, settlement only after success, rate limits, spend caps and policy validation.
