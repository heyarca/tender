# @heyarca/tender

[![Tender: always on the best API](https://tender.heyarca.app/readme-screenshot.png)](https://tender.heyarca.app)

Let your agent buy API access on **[Tender](https://tender.heyarca.app)**, the execution market for
APIs. Providers compete to serve each request on price, latency, data freshness, and reliability. You
set the requirements; Tender routes every request to the best provider that meets them and switches
when one stops qualifying. Pay per request from Tender credits (funded with PayPal) or in USDC with x402.

## Quick start

```bash
npx @heyarca/tender@latest
```

This adds a short Tender section to your project's `AGENTS.md` (and `CLAUDE.md` if present), so
coding agents know how to discover markets and route API calls through Tender. It also adds the
[Tender MCP server](#mcp-server) to `.mcp.json`, `.cursor/mcp.json`, and `.vscode/mcp.json`.
Running it again updates the section in place and only adds what is missing to the MCP configs.

## MCP server

`npx @heyarca/tender@latest` also adds the Tender MCP server to your editor configs, so agents in
Claude Code, Cursor, and VS Code can find markets, compare prices, and buy API calls with tools. It
merges into existing files, keeps your other servers, and changes nothing when you run it again. Use
`--no-mcp` to skip this.

### Pay for API calls from your editor

1. **Add funds with PayPal** at https://tender.heyarca.app/account.
2. **Create an API key** on the same page. It starts with `tk_` and is shown once.
3. **Export it** in the shell that starts your editor, then restart the editor's agent:

   ```bash
   export TENDER_API_KEY=tk_...
   ```

Your agent can now call `call_market` (for example "get the BTC price from Tender"). Each call pays the
winning bid from your credits; a $18 /M bid costs $0.000018. `get_balance` shows what is left.

The configs only reference the variable, so the key is never written to your project:

Claude Code (`.mcp.json`):

```json
{
  "mcpServers": {
    "tender": {
      "command": "npx",
      "args": ["-y", "@heyarca/tender@latest", "mcp"],
      "env": { "TENDER_API_KEY": "${TENDER_API_KEY}" }
    }
  }
}
```

Cursor (`.cursor/mcp.json`) is the same with `"TENDER_API_KEY": "${env:TENDER_API_KEY}"`.

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "tender": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@heyarca/tender@latest", "mcp"],
      "env": { "TENDER_API_KEY": "${env:TENDER_API_KEY}" }
    }
  }
}
```

With Claude Code you can also add it from the command line:

```bash
claude mcp add --scope project tender -e 'TENDER_API_KEY=${TENDER_API_KEY}' -- npx -y @heyarca/tender@latest mcp
```

### Tools

`call_market` spends credits. Every other tool is read-only and never pays.

| Tool | What it returns |
| --- | --- |
| `list_markets` | Markets as compact rows: id, name, group, category, contract call, provider count, cheapest bid. Optional `group`, `category`, `query` filters. |
| `list_categories` | Groups and categories with market counts. |
| `list_contracts` | Contracts with paths, params, and output fields. Pass `id` to get one contract with its output JSON Schema. |
| `get_market` | Provider bids and the routing decision for a policy. Takes `id` and optional `max_price`, `max_p95_ms`, `max_data_age_ms`, `min_success_rate`, `preference`, `pin`. |
| `quote` | The x402 payment requirements for the next request: provider, price, `payTo`, amount, network, asset. Same inputs as `get_market`. |
| `call_market` | Runs one request and pays from your credits: the contract data, the provider, the amount charged (dollars and micro-USD), and the balance left. Takes `id`, optional `params` (extra query parameters), and the `get_market` policy fields. Needs `TENDER_API_KEY`. |
| `get_balance` | Your credits balance and the latest charges and top-ups. Needs `TENDER_API_KEY`. |

Errors come back as tool errors the agent can act on: no key ("Set TENDER_API_KEY …"), a low balance
("Your Tender balance is too low. Add funds at …"), and a policy no provider meets.

Prices are USD per 1M requests. Run the server by hand with `npx @heyarca/tender mcp`
(add `--base-url <url>` for another Tender deployment).

### PayPal MCP

`npx @heyarca/tender@latest --paypal` also adds PayPal's official MCP server
([`@paypal/mcp`](https://www.npmjs.com/package/@paypal/mcp)) next to Tender:

```json
"paypal": {
  "command": "npx",
  "args": ["-y", "@paypal/mcp", "--tools=all"],
  "env": { "PAYPAL_ENVIRONMENT": "SANDBOX" }
}
```

It reads `PAYPAL_ACCESS_TOKEN` from your environment, so no secret is written to your project.

## CLI

```bash
npx @heyarca/tender markets                 # list every market
npx @heyarca/tender categories              # groups and categories with market counts
npx @heyarca/tender contracts               # contracts: params, paths, markets
npx @heyarca/tender market btc-usd          # provider bids and the routing decision
npx @heyarca/tender market sf-weather --max-price 30 --max-p95-ms 300
npx @heyarca/tender quote eth-usd           # x402 payment requirements for the next request
npx @heyarca/tender call sf-weather         # run one request, paid from your credits
npx @heyarca/tender call btc-usd --max-p95-ms 150 --param key=value
npx @heyarca/tender balance                 # credits balance and latest charges
npx @heyarca/tender mcp                     # run the MCP server on stdio
```

Policy options: `--max-price` (USD per 1M requests), `--max-p95-ms`, `--max-data-age-ms`,
`--min-success-rate` (0..1), `--preference lowest-cost|lowest-latency|freshest-data`, `--pin <provider>`.
Use `--base-url` to point at another Tender deployment. `call` and `balance` read `TENDER_API_KEY`.
Human-readable output uses provider names from market metadata. Unknown or deleted providers retain
their IDs. If balance metadata is unavailable, the CLI warns and keeps showing the transactions with IDs.
Library results, MCP responses, and `quote` JSON retain provider IDs. `callMarket()` also returns
`providerName` (or `null` when the provider is unknown) without an extra metadata request.

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

// With an API key (the apiKey option or TENDER_API_KEY), callMarket() pays from your credits.
const paid = createTender({ apiKey: process.env.TENDER_API_KEY });
const call = await paid.callMarket("sf-weather", { policy: { maxP95LatencyMs: 300 } });
// call.data, call.provider, call.payment.charged_micros, call.payment.balance_micros (1 USD = 1,000,000)
const account = await paid.balance();         // { balance_micros, ledger, ... }
```

No dependencies. Works anywhere with a global `fetch` (Node 18+, Bun, Deno, browsers).

## Package development

From the repository root, run `bun install --frozen-lockfile`. Then run the focused CLI tests:

```bash
cd packages/tender
bun run test
npm pack --dry-run
```

Tests use the repository's Vitest dependency; the published client and CLI have no runtime dependencies.
There is no package build step: the JavaScript and TypeScript declarations ship directly.

## Links

- Markets: https://tender.heyarca.app/markets
- API reference (OpenAPI 3.1): https://tender.heyarca.app/api/v1/openapi.json
- Source: https://github.com/heyarca/tender

x402 payments currently settle on Base Sepolia (testnet).

## License

MIT
