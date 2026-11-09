# Tender data model

One registry describes everything Tender sells: `src/lib/registry/`. The engine, every page, the HTTP API,
the OpenAPI document, the npm package, and MCP tools read it. Adding a market means adding data, not code.

## Hierarchy

```
Group            Market data                      AI models
 └ Category       └ Electronic components          └ Translation
    └ Market         └ Shenzhen MLCC Spot Price       └ English to Korean Translation
       └ Listing        └ Arca Labs: $X /M req, P95, data age, success
```

- **Group** (7): top-level navigation. `GROUPS` in `taxonomy.ts`, in display order.
- **Category** (25): what the data is about. Has an icon and a **focus** (`freshness`, `latency`, `price`):
  the metrics buyers care about most in that category. Crypto is listed last within market data.
- **Market** (75): one thing you can buy, in one category, bound to one contract with fixed params
  (`translation.text` with `source=en, target=ko`). Has name, description, image, time zone, and listings.
- **Listing**: a provider's standing offer in a market: bid (USD per 1M requests), P95 latency, data age,
  error rate, availability, and a small bias for the values it reports. Measured performance is separate
  (engine history), so the stated offer and the observed behavior can differ.

## Contracts (the API shape)

A **contract** is a normalized API: `ContractSpec` in `contracts.ts` (37 today).

| Field | Meaning |
|---|---|
| `id` | `namespace.action`; HTTP path `/api/v1/{namespace}/{action}` |
| `params` | Typed inputs. A market binds a value for each (`location=seoul`). |
| `output` | Typed fields: `type` (number, money, percent, timestamp, enum, list, object…), `unit`, one `primary` field, optional `series` field (plotted, drifts over time). Nested values use dotted keys. |
| `freshness` | What data age means here: `observed` (since measured), `source` (since published), `generated` (made on request), and the input unit (ms or min). |
| `resultView` | Renderer: `weather`, `price` (headline price + chart + fields), `fields` (generic, from the schema). |
| `pricingUnit` | Billing unit of bids. `request` for every contract today. |
| `sample` | Schema-shaped template result; markets override values for their params. |

Many markets share a contract (`prices.spot` serves crypto and currencies), and a category can hold several
contracts (IP intelligence: `ip.lookup`, `ip.asn`, `ip.risk`). Classification (category) and interface
(contract) are separate on purpose.

## Results

Every response is the same envelope around a payload validated against the contract's output schema:
`request_id`, `market`, `provider`, `latency_ms`, `data_age_ms`, `cost`, timestamps, then `data`.
A provider that returns a payload missing required fields counts as a failed request.

## One page for every market

- `/markets` — directory. Group tabs, category filters in the sidebar (grouped), search, sort, list and table.
- `/markets/{market}` — the market console for **every** market: breadcrumb (Markets › Group › Category),
  title, contract signature, result card (by `resultView`), providers, routing policy, provider conditions,
  Pay with USDC, activity.
- `/catalog/{id}` — permanent redirect to `/markets/{id}`.
- Category links: `/markets?category={id}`; group links: `/markets?group={id}`.

## Rules

- Market, category, group, and contract ids are stable public identifiers (URLs, API, SDK). Do not rename them.
- Markets source data from a live upstream (`upstream`) or a deterministic Tender signal (`signal`).
  This is internal; the UI never labels markets as demos.
- Provider names and logos identify fixture providers; they are not partnership claims.
- `validateRegistry()` must return no errors (duplicate ids, unknown references, params that do not match
  the contract, samples missing required fields).
