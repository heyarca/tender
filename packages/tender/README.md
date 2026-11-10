# @heyarca/tender

[![Tender: always on the best API](https://tender.heyarca.app/readme-screenshot.png)](https://tender.heyarca.app)

Let your agent buy API access on **[Tender](https://tender.heyarca.app)**, the execution market for
APIs. Providers compete to serve each request on price, latency, data freshness, and reliability. You
set the requirements; Tender routes every request to the best provider that meets them and switches
when one stops qualifying. Requests are paid per call in USDC with x402.

## Quick start

```bash
npx @heyarca/tender@latest
```

This adds a short Tender section to your project's `AGENTS.md` (and `CLAUDE.md` if present), so
coding agents know how to discover markets and route API calls through Tender. It also adds the
[Tender MCP server](#mcp-server) to `.mcp.json`, `.cursor/mcp.json`, and `.vscode/mcp.json`.
Running it again updates the section in place and leaves the MCP configs as they are.

## MCP server

`npx @heyarca/tender@latest` also adds the Tender MCP server to your editor configs, so agents in
Claude Code, Cursor, and VS Code can find markets and prices with tools. It merges into existing files,
keeps your other servers, and changes nothing when you run it again. Use `--no-mcp` to skip this.

Claude Code (`.mcp.json`) and Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "tender": { "command": "npx", "args": ["-y", "@heyarca/tender@latest", "mcp"] }
  }
}
```

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "tender": { "type": "stdio", "command": "npx", "args": ["-y", "@heyarca/tender@latest", "mcp"] }
  }
}
```

Tools (all read-only; none of them pay):

| Tool | What it returns |
| --- | --- |
| `list_markets` | Markets as compact rows: id, name, group, category, contract call, provider count, cheapest bid. Optional `group`, `category`, `query` filters. |
| `list_categories` | Groups and categories with market counts. |
| `list_contracts` | Contracts with paths, params, and output fields. Pass `id` to get one contract with its output JSON Schema. |
| `get_market` | Provider bids and the routing decision for a policy. Takes `id` and optional `max_price`, `max_p95_ms`, `max_data_age_ms`, `min_success_rate`, `preference`, `pin`. |
| `quote` | The x402 payment requirements for the next request: provider, price, `payTo`, amount, network, asset. Same inputs as `get_market`. |

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
npx @heyarca/tender mcp                     # run the MCP server on stdio
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
