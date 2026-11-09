# Tender

[![Tender: make APIs compete for your traffic](docs/assets/tender-screenshot.png)](https://tender.heyarca.app)

**The execution market for APIs.** Providers compete to serve each request on price, latency, data
freshness, and reliability. You declare what you need; Tender routes every request to the best provider
that meets it, and switches the moment a provider stops qualifying. Requests are paid per call in USDC
with x402.

**Live:** https://tender.heyarca.app · **Markets:** https://tender.heyarca.app/markets ·
**Demo:** https://tender.heyarca.app/demo

## Let your agent use Tender

```bash
npx @heyarca/tender@latest
```

Adds Tender instructions to your project's `AGENTS.md` / `CLAUDE.md`, so coding agents route API calls
through Tender instead of hard-coding a provider. The same package is a small CLI
(`markets`, `market <id>`, `quote <id>`) and a zero-dependency client. See
[`packages/tender`](packages/tender/README.md).

## What's in Tender

- **Many markets, and more on the way.** Weather (San Francisco, New York, London, Seoul, Tokyo,
  Singapore), crypto prices (BTC, ETH, SOL, XRP), currencies (EUR/USD, GBP/USD), and real-world goods
  (Shenzhen MLCC spot, lithium carbonate, Shanghai → LA container freight), plus a catalog of API
  categories from stock quotes to LLM completions. AI agents can request and open new markets.
- **Routing policy.** Max price per request, max P95 latency, max data age, min success rate, and a
  preference (lowest cost, lowest latency, freshest data), with automatic switching or a pinned provider.
- **Live provider competition.** Bids, performance history, qualification status, and the routing
  decision for every market, with immediate failover and a short cooldown for better offers.
- **Pay per request in USDC.** Contract endpoints answer `402 Payment Required` with the winning
  provider's price and payee; a signed retry settles USDC on Base Sepolia through x402.

## HTTP API

| Method | Path | |
|---|---|---|
| GET | `/api/v1/markets` | Every market, contract, units, and default policy |
| GET | `/api/v1/markets/{id}` | Provider bids, performance, and the routing decision for a policy |
| GET | `/api/v1/weather/current?location=…` | Paid weather contract (x402) |
| GET | `/api/v1/prices/spot?pair=…` | Paid price contract (x402) |
| GET | `/api/v1/openapi.json` | OpenAPI 3.1 |

Details: [`docs/API.md`](docs/API.md) and [`docs/PAYMENTS.md`](docs/PAYMENTS.md).

## Develop

```bash
bun install
bun run dev        # http://localhost:3000
bun run build
```

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. Every push to `main` deploys to
production on Vercel.

- Product spec: [`docs/SPEC.md`](docs/SPEC.md)
- Design system: [`docs/DESIGN.md`](docs/DESIGN.md)
- Engine: [`src/lib/tender/README.md`](src/lib/tender/README.md)

Built by [Arca Labs](https://heyarca.app).
