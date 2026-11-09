# Tender API

Base path: `/api/v1`. All handlers use the Node.js runtime. The OpenAPI 3.1 contract is at
`GET /api/v1/openapi.json`.

## Cross-origin access

The public v1 API is callable from any browser origin without credentials. Every `/api/v1`
response (including 402 challenges and errors) carries `Access-Control-Allow-Origin: *`.
Paid responses additionally expose `PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`, `Tender-Provider`,
`Tender-Price-USD`, `Tender-Settled-Atomic`, `Tender-Route-Reason`, and
`Tender-Policy-Violation` through `Access-Control-Expose-Headers`, so cross-origin clients
can read the quote and receipt headers. `OPTIONS` preflight requests answer HTTP 204 with
`Access-Control-Allow-Methods: GET, OPTIONS`, `Access-Control-Allow-Headers: PAYMENT-SIGNATURE,
X-PAYMENT, Content-Type, Tender-Max-Price, Tender-Max-P95-Ms, Tender-Max-Data-Age-Ms,
Tender-Min-Success-Rate, Tender-Preference, Tender-Pin`, and `Access-Control-Max-Age: 600`.
The console payment endpoints under `/api/payments/*` are deliberately not CORS-enabled;
they are same-origin console surfaces.

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | `/markets` | Both markets, contracts, units, default policies, provider counts |
| GET | `/markets/{market}` | Provider identities, bids, performance, qualification, ranking, route |
| GET | `/weather/current?location=san-francisco` | San Francisco weather; x402 payment required |
| GET | `/prices/spot?pair=BTC-USD` | BTC/USD spot price; x402 payment required |
| GET | `/openapi.json` | OpenAPI document |

Market ids are `sf-weather` and `btc-usd`. Only the listed location and pair are supported.
Omitting either contract argument uses that endpoint's default. Other values return HTTP 400.
Unknown markets return HTTP 404. Discovery and OpenAPI do not require payment.
Every `/api/v1` endpoint accepts GET only; other methods return HTTP 405 with an
`Allow: GET` header and an `{"error":{"code":"method_not_allowed"}}` body.

## Routing policy

Contract and market-detail requests accept the same policy parameters. Query parameters take
precedence over matching headers. Duplicate recognized query parameters, malformed values,
unknown preferences, or a pin outside the market return HTTP 400.

| Query | Header | Unit |
| --- | --- | --- |
| `max_price` | `Tender-Max-Price` | USD per 1M requests, not per request |
| `max_p95_ms` | `Tender-Max-P95-Ms` | Milliseconds |
| `max_data_age_ms` | `Tender-Max-Data-Age-Ms` | Milliseconds, including weather |
| `min_success_rate` | `Tender-Min-Success-Rate` | Fraction from 0 to 1; `0.999` means 99.90% |
| `preference` | `Tender-Preference` | `lowest-cost`, `lowest-latency`, or `freshest-data` |
| `pin` | `Tender-Pin` | Provider id in this market |

Numeric limits must be finite and nonnegative. Zero is accepted as a strict limit.
Omitted fields use the shared engine's defaults. Provider bids, conditions, qualification,
exclusion priority, and tie-breaking come from the same server-safe engine as the console.
Public contract endpoints do not read the browser's local storage or provider edits. They
never accept condition changes through query parameters or headers. The console payment
endpoint can pass sanitized condition patches through a trusted in-process call instead;
those patches affect only that request, not the public API's defaults.

The API is **stateless per request**. It selects the rank-1 qualified provider on each request.
Switch cooldowns, pending switches, and pinned-mode notifications are console behaviors, not
server-wide state. In pinned mode, the named provider stays selected even if it fails policy.
`Tender-Policy-Violation: true` and the JSON `policy_violation` / `policy_violations` fields report
that case. An unavailable pinned provider returns a provider error, never a silent reroute.
If no provider qualifies in automatic mode, the contract returns HTTP 409 with
`{"error":{"code":"no_eligible_provider","message":"No eligible provider"}}` before payment.
Discovery still returns HTTP 200 with a null active provider and an empty ranking.

Every contract request computes its routing selection once. The same provider supplies the
x402 amount/payee and the normalized result. `Tender-Provider` identifies it.
`Tender-Route-Reason` is the preference or `pinned`. Every paid-route response (including the
402 challenge) also carries `Tender-Price-USD`, the exact winning bid per request as a decimal
string matching the JSON `price_usd`, and `Tender-Settled-Atomic`, the settled USDC amount in
atomic units as an integer string matching the JSON `settled_atomic`. Errors and paid responses are not cached.
Provider failures return `provider_error` with the provider, request id, latency, and policy
violation fields (HTTP 500, 502, 503, or 504). Payment-service exceptions return HTTP 503 with
`payment_unavailable`. Failed provider requests are not settled: the x402 SDK cancels the
settlement path for responses with status 400 or greater.

## Prices and payment

Contract calls use x402 v2 **USDC on Base Sepolia only** (`eip155:84532`). No mainnet funds.
The first unpaid GET returns HTTP 402 and `PAYMENT-REQUIRED`. An x402 client signs those
requirements and retries the same URL and policy with `PAYMENT-SIGNATURE`. A settled response
includes `PAYMENT-RESPONSE`. See [PAYMENTS.md](./PAYMENTS.md) for wallets, facilitator setup,
and the buyer endpoint. Do not put a private key in a request or browser bundle.

Prices have two distinct meanings:

- `price_usd`: exact provider bid divided by 1,000,000.
- `settled_atomic`: integer USDC atomic units, encoded as a string.
- `settled_usd`: settled atomic units divided by 1,000,000.
- `settlement_note`: included when a fractional atomic unit is rounded up.

USDC has six decimal places. A bid of X USD per 1M requests is X atomic units per request.
Settlement rounds **up** to the next atomic unit, never down to zero. The increase is less
than one atomic unit. For the configured Parasail bid of $0.70/M, `price_usd` is `0.0000007`,
`settled_atomic` is `"1"`, and `settled_usd` is `0.000001`. The note is exactly:

> Rounded up to the USDC minimum unit (0.000001)

Exact and settled amounts are exposed in the quote, 402 description, response JSON, and receipt.
A policy price limit evaluates the exact bid; consult settlement fields for the actual transfer.

## Reference data and result semantics

Tender provider identities are separate from keyless reference inputs. No provider is claimed
to connect to Open-Meteo, Coinbase, or Kraken.

- Weather reference: Open-Meteo current observations in Fahrenheit and mph. Dew point is
  derived with the Magnus approximation. Visibility uses the deterministic baseline because
  the selected current-observation endpoint does not provide it.
- Price reference: Coinbase Exchange BTC-USD bid/ask midpoint. Kraken's latest trade is the
  fallback input. These are reference anchors, not a claim of a measured multi-venue VWAP.
- Each instance caches an input for three seconds and coalesces concurrent reads.
- Each reference lookup has a maximum 1.8-second upstream deadline. Both price attempts share
  that deadline. Network, HTTP, parse, and validation errors use deterministic fixture values.
- Provider payloads use the shared engine's age-dependent values and small per-provider biases,
  anchored to the reference input. Provider latency and data age are sampled by the same engine.
  `latency_ms` is the provider model's latency, not measured end-to-end HTTP response time.
- `observed_at` (weather) / `source_timestamp` (price) and `data_age_ms` describe the provider
  model. `reference_timestamp` preserves the actual input timestamp, including the fixed
  fixture timestamp on fallback. `reference_source` records provenance. Provider-model
  freshness must not be interpreted as the freshness of an upstream observation.
- `request_id` is unique per request; there is no cross-instance monotonic counter.
- `price` is the BTC quote in USD; `price_usd` is the per-request API fee. Change from a previous
  request is omitted because this stateless API has no per-caller history. The console computes
  changes and recent charts client-side.

## Curl examples

Set the base URL to a local server or your deployed Tender origin:

```sh
BASE=http://localhost:3105
curl -sS "$BASE/api/v1/markets"
curl -sS "$BASE/api/v1/markets/btc-usd?preference=lowest-latency"
curl -sS "$BASE/api/v1/markets/sf-weather?max_data_age_ms=120000"
curl -sS "$BASE/api/v1/markets/btc-usd?pin=novita"
curl -sS "$BASE/api/v1/openapi.json"

# Inspect the x402 challenge; this does not pay.
curl -i "$BASE/api/v1/prices/spot?pair=BTC-USD"
curl -i "$BASE/api/v1/weather/current?location=san-francisco" \
  -H 'Tender-Max-Price: 30' -H 'Tender-Preference: lowest-latency'

# No provider qualifies; HTTP 409, not a payment challenge.
curl -i "$BASE/api/v1/prices/spot?pair=BTC-USD&max_price=0"

# PAYMENT_SIGNATURE is a base64 x402 payload created by a supported signing client.
curl -i "$BASE/api/v1/prices/spot?pair=BTC-USD" \
  -H "PAYMENT-SIGNATURE: $PAYMENT_SIGNATURE"
```

For an SSO-protected preview, use the linked project's CLI protection bypass:

```sh
vercel -Q ~/.config/tender-vercel curl /api/v1/markets \
  --deployment <preview-url> --scope the-zone-bio
```

## Server interfaces

- `handleContract(request: Request, marketId: MarketId, options?: ContractOptions): Promise<Response>`
  validates inputs, freezes routing, invokes the payment wrapper, and serves the normalized contract.
  `ContractOptions` accepts `conditions?: Partial<Record<ProviderId, ConditionsPatch>>` **in process
  only**. Known provider patches are clamped by the shared engine's `sanitizeConditionsPatch`
  and merged over fixture defaults. Unknown providers and invalid patch containers are ignored.
  Patches never mutate shared fixtures. A selected zero bid returns HTTP 400 `unsupported_bid`
  before payment; paid requests require a positive bid.
- `readPolicyOverrides(request: Request)` parses wire policy inputs without changing defaults.
- `marketDetail(request: Request, marketId: MarketId)` builds discovery data with shared evaluation.
- `getWeatherReference()` / `getPriceReference()` return `{value, timestamp, source}`.

No API secrets are required for reference lookups or discovery. Payment-related secrets are
documented and managed by the payments layer. No database or extra service is required for API routing.
