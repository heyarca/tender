# @heyarca/tender

[![Tender: make APIs compete for your traffic](https://tender.heyarca.app/readme-screenshot.png)](https://tender.heyarca.app)

Let your agent buy API access on **[Tender](https://tender.heyarca.app)**, the execution market for
APIs. Providers compete to serve each request on price, latency, data freshness, and reliability. You
set the requirements; Tender routes every request to the best provider that meets them and switches
when one stops qualifying. Requests are paid per call in USDC with x402.

## Quick start

```bash
npx @heyarca/tender@latest
```

This adds a short Tender section to your project's `AGENTS.md` (and `CLAUDE.md` if present), so
coding agents know how to discover markets and route API calls through Tender. Running it again
updates the section in place.

## CLI

```bash
npx @heyarca/tender markets                 # list every market
npx @heyarca/tender categories              # groups and categories with market counts
npx @heyarca/tender contracts               # contracts: params, paths, markets
npx @heyarca/tender market btc-usd          # provider bids and the routing decision
npx @heyarca/tender market sf-weather --max-price 30 --max-p95-ms 300
npx @heyarca/tender quote eth-usd           # x402 payment requirements for the next request
```

Policy options: `--max-price` (USD per 1M requests), `--max-p95-ms`, `--max-data-age-ms`,
`--min-success-rate` (0..1), `--preference lowest-cost|lowest-latency|freshest-data`, `--pin <provider>`.
Use `--base-url` to point at another Tender deployment.

## Library

```js
import { createTender } from "@heyarca/tender";

const tender = createTender();
const markets = await tender.markets();       // every market with its contract_url
const groups = await tender.categories();     // groups › categories
const contracts = await tender.contracts();   // params and result schemas
const market = await tender.market("btc-usd", { maxPrice: 2, maxP95LatencyMs: 150 });

// request() calls the market's contract_url. Without a payment-aware fetch it returns the
// 402 payment requirements. Pass an x402 fetch (for example from @x402/fetch) to pay in USDC:
// result.data is the contract-shaped result, result.response the full body.
const result = await tender.request("translate-en-ko", { maxPrice: 5 });
```

No dependencies. Works anywhere with a global `fetch` (Node 18+, Bun, Deno, browsers).

## Links

- Markets: https://tender.heyarca.app/markets
- API reference (OpenAPI 3.1): https://tender.heyarca.app/api/v1/openapi.json
- Source: https://github.com/heyarca/tender

Payments currently settle on Base Sepolia (testnet).

## License

MIT
