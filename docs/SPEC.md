# Tender — product & architecture spec

Tender is an API marketplace where providers compete to serve an application's requests on
**price, latency, freshness, and reliability** — the name comes from a procurement tender, where suppliers bid for a contract. It looks and feels like **OpenRouter for general-purpose APIs**:
developers declare the result and the requirements; providers bid; Tender monitors, enforces the policy,
and switches the route to a qualified provider when the current one stops meeting it.

This repository is a **frontend-only** product surface (Next.js 16 App Router, React 19, TypeScript,
Tailwind CSS v4). All data comes from local fixtures and deterministic state transitions.

The core interaction must be obvious within seconds:

> **Change a provider's price or performance → watch its qualification change → see the next request use the selected provider.**

---

## 1. Scope and copy rules

- Two markets: **San Francisco Weather** and **Bitcoin Price**.
- No authentication, billing, backend, real API calls, adapter generation, or data migration.
- Every visible control works. No dead links, placeholder buttons, or "coming soon" states.
- Never show the words "Demo", "Simulation", "Simulated", "Hackathon", "Mock", "Fake", "Sample data",
  "Coming soon", or any disclaimer banner. Present it as a complete product surface.
- Do not claim real integrations, partnerships, or that numbers are externally measured. Provider names
  and logos are identities inside the fixture data only. Never write "live", "real-time feed from",
  "powered by", "partner", or "integrated with" next to a provider name.
- Product copy is concise English, sentence case ("Routing policy", "Provider conditions", "Run request").

## 2. Routes and page structure

- `/` redirects to `/markets/sf-weather`.
- `/markets/[market]` with `market ∈ { "sf-weather", "btc-usd" }` (statically generated, `generateStaticParams`).
- All market state lives in one client store mounted in the root layout, so switching markets keeps each
  market's state (requests, activity, edits).

Page layout (desktop ≥ 1024px; content `max-w-7xl` like OpenRouter):

```
TopNav (h-14, sticky): [mark] tender   [Search ⌘K]                    Markets · Providers · Routing · Activity   [Run request]
──────────────────────────────────────────────────────────────────────────────────────────────────────────────
Market switcher (segmented: ☁ San Francisco Weather | ₿ Bitcoin Price)
Title row: (market icon) San Francisco Weather                                      [API]  [Run request]
           weather/san-francisco [copy]
Description line (1–2 sentences, muted)
Overview: [ Normalized result card (2/3) ] [ Summary stat cards (1/3, stacked) ]   ← "alongside"
──────────────────────────────────────────────────────────────────────────────────────────────────────────────
Grid lg:grid-cols-[200px_1fr]
  Sticky sidebar: Markets (2 items) / On this page (Providers, Routing policy, Provider conditions, Activity) with scroll-spy
  Main:
    #providers   Providers — toolbar (preference segmented control + policy chips) · provider table · routing decision callout
    #routing     Routing policy  |  #conditions Provider conditions   (side by side on xl, stacked below)
    #activity    Activity
StickyMarketBar: appears once the title row scrolls out of view (market name · active provider chip · Run request)
Toasts (bottom-right): route switches, "No eligible provider", pinned-provider failures
```

The provider comparison is the visual center. Keep the first viewport (1440×900) showing the title,
the overview, and the top of the providers table.

## 3. Markets and fixtures

Prices are bids in **USD per 1M requests** in both markets. Show the unit explicitly (`$18.00 /M req`).

### 3.1 San Francisco Weather (`sf-weather`)

- Identifier: `weather/san-francisco`, contract `weather.current({ location: "san-francisco" })`.
- Description: "Current conditions for San Francisco through one normalized contract. Providers bid to serve each request; Tender routes to the best one that meets your policy."
- Display time zone: `America/Los_Angeles` (label "PT").
- Normalized result: location `San Francisco, CA` (37.7749, −122.4194), `observedAt`, temperature °F,
  feels like °F, condition (e.g. "Overcast"), humidity %, wind mph + compass direction, pressure hPa,
  visibility mi, dew point °F, cloud cover %, served-by provider, request latency, observation age at response.
- Baseline (fixture seed): 61°F, feels like 60°F, Overcast, humidity 86%, wind 9 mph W (278°), pressure 1018 hPa,
  visibility 9.4 mi, dew point 57°F, cloud cover 100%. Values drift slowly and deterministically over time.
  Providers report the state as of `now − dataAge` plus a tiny per-provider bias (≤ 0.5°F, ≤ 2% humidity).
- Freshness = **observation age** (now − observedAt). It is not request latency and not forecast accuracy.

Default policy: max price **$40.00 /M**, max P95 latency **400 ms**, max data age **15 min**,
min success rate **99.50%**, preference **Lowest cost**, mode **Automatic switching**.

| id | name | bid $/M | P95 ms | data age | error rate | available | default status |
|---|---|---|---|---|---|---|---|
| together | Together | 18.00 | 210 | 6 min | 0.06% | yes | **Active** (lowest-priced qualified) |
| deepinfra | DeepInfra | 22.00 | 180 | 2 min | 0.03% | yes | Eligible (freshest) |
| fireworks | Fireworks | 27.50 | 150 | 5 min | 0.04% | yes | Eligible (fastest qualified) |
| digitalocean | DigitalOcean | 31.00 | 260 | 8 min | 0.10% | yes | Eligible |
| cloudflare | Cloudflare | 12.00 | 640 | 5 min | 0.05% | yes | Too slow (cheapest overall) |
| modal | Modal | 15.00 | 190 | 42 min | 0.08% | yes | Stale data |
| mistral | Mistral | 58.00 | 95 | 1 min | 0.01% | yes | Over budget |
| nebius | Nebius | 20.00 | 230 | 7 min | 0.20% | **no** | Unavailable |

### 3.2 Bitcoin Price (`btc-usd`)

- Identifier: `prices/btc-usd`, contract `prices.spot({ pair: "BTC-USD" })`.
- Price definition (same for every provider): "BTC/USD spot mid price in USD, volume-weighted across major USD venues."
- Description: "BTC/USD spot price through one normalized contract. Every provider returns the same price definition, so bids compare like for like."
- Display time zone: `UTC` (timestamps with milliseconds, e.g. `18:04:31.220 UTC`).
- Normalized result: pair, price (USD, 2 decimals), change vs previous request, source timestamp,
  data age at response (ms), request latency (ms), served-by provider, and a compact recent-price chart.
- Baseline price **$75,230.75**; deterministic random walk (σ ≈ $7 per second). A provider reports the
  true price at `now − dataAge` plus a tiny bias (≤ $1.50). Seed ~40 historical points so the chart is never empty.

Default policy: max price **$2.00 /M**, max P95 latency **150 ms**, max data age **1,000 ms**,
min success rate **99.90%**, preference **Lowest cost**, mode **Automatic switching**.

| id | name | bid $/M | P95 ms | data age | error rate | available | default status |
|---|---|---|---|---|---|---|---|
| the-zone-bio | THE ZONE BIO | 0.70 | 87 | 220 ms | 0.03% | yes | **Active** (lowest-priced qualified) |
| arca-labs | Arca Labs | 0.95 | 64 | 140 ms | 0.02% | yes | Eligible |
| coreweave | CoreWeave | 1.40 | 42 | 90 ms | 0.01% | yes | Eligible (fastest qualified) |
| baseten | Baseten | 1.80 | 58 | 45 ms | 0.05% | yes | Eligible (freshest) |
| novita | NovitaAI | 0.40 | 310 | 180 ms | 0.04% | yes | Too slow (cheapest overall) |
| crusoe | Crusoe | 0.55 | 72 | 2,400 ms | 0.03% | yes | Stale data |
| gmicloud | GMICloud | 2.60 | 38 | 60 ms | 0.01% | yes | Over budget |
| wafer | Wafer | 0.60 | 95 | 300 ms | 0.85% | yes | Unreliable (99.15% < 99.90%) |

Provider logos live in `public/providers/<id>.<ext>` (see `docs/provider-logos.md`). Use them as-is.

## 4. Domain rules

### 4.1 Evaluation (pure, deterministic)

A provider **qualifies** when all hold:
`available` ∧ `successRate ≥ minSuccessRate` ∧ `bidPrice ≤ maxPrice` ∧ `p95LatencyMs ≤ maxP95LatencyMs` ∧ `dataAgeMs ≤ maxDataAgeMs`,
where `successRate = 1 − errorRate`.

Qualification status (first failing check in this priority order; tooltips list **all** failing checks):

| status | label | when |
|---|---|---|
| unavailable | Unavailable | `available = false` |
| unreliable | Unreliable | success rate below minimum |
| over-budget | Over budget | bid above max price |
| too-slow | Too slow | P95 above max latency |
| stale-data | Stale data | data age above max |
| eligible | Eligible | all checks pass |

Reason copy (short, with numbers): "P95 640 ms exceeds 400 ms", "Bid $58.00 exceeds $40.00 /M",
"Data age 42 min exceeds 15 min", "Success 99.15% is below 99.90%", "Provider is not responding".

Ranking among qualified providers by preference (ties broken by the next keys, then by name):
- Lowest cost: bid ↑, P95 ↑, data age ↑
- Lowest latency: P95 ↑, bid ↑, data age ↑
- Freshest data: data age ↑, bid ↑, P95 ↑

The **recommended provider** is rank 1. The **lowest-priced qualified provider** is marked separately
("Best price") even when the preference is latency or freshness.

### 4.2 Routing (state machine)

Route state per market: `activeProviderId | null`, `mode` (`auto` | `pinned(providerId)`), `since`,
`lastSwitchAt`, optional `pending` optimization switch `{ providerId, executeAt }`.

Evaluation is **separate** from request execution. Re-evaluate after every state change (bid update,
condition change, policy change, mode change, reset) and on each monitor tick. Requests never wait for an
auction; they use the current route immediately.

Automatic mode:
1. **Failover (immediate):** the active provider stops qualifying → switch to the recommended provider now,
   ignoring cooldown. Trigger copy names the failing check.
2. **Operator change (immediate):** policy edits and mode changes re-route immediately if the recommended
   provider differs.
3. **Optimization (cooldown):** a different provider now outranks the active one because of a bid/condition
   change → switch only if `now − lastSwitchAt ≥ SWITCH_COOLDOWN_MS` (10,000 ms). Otherwise set `pending`
   and switch when the cooldown expires (if it still outranks the active provider). Show the countdown
   ("Switching to Cloudflare in 7 s — switch cooldown") in the routing decision callout.
4. **No eligible provider:** set `activeProviderId = null`, show **No eligible provider**, and reject
   requests (they are not sent). Never silently violate the policy. When a provider qualifies again,
   route to it immediately.

Pinned mode (`pinned(providerId)`):
- Requests always go to the pinned provider. Never switch without permission.
- If the pinned provider fails the policy, surface it everywhere (status, callout, toast, activity):
  "Pinned provider Together fails your policy: P95 640 ms exceeds 400 ms. Requests still go to Together."
  Offer explicit actions: **Switch to DeepInfra** (pins the recommended provider) and **Use automatic switching**.
- If the pinned provider is unavailable, requests fail with a provider error (they are attempted, not rerouted).

Every route change writes an activity entry stating: previous provider, new provider, trigger, and why the
replacement qualifies (all four checks with values vs limits).

### 4.3 Request execution

`runRequest(market)` (also triggered by the optional auto-run toggle every 2 s):
- No route → result `{ status: "rejected", reason: "No eligible provider" }`; nothing is sent.
- Otherwise sample deterministically (seeded PRNG stored in state, e.g. mulberry32 seed advanced per draw):
  - latency: ~95% of samples ≤ the provider's P95, a few above (≤ 1.35×); median ≈ 0.6× P95.
  - data age at response: provider data age ± 20%.
  - failure with probability `errorRate`; `available = false` always fails ("503 Service Unavailable").
- A successful result contains the normalized payload for the market, the provider id, latency, data age,
  observed/source timestamp, request id (`req_000123` style, monotonic), and cost (`bid / 1e6`).
- Append to the market's request log (keep the last 50), update the request count and spend, append the
  latency sample to the serving provider's history, and write an activity entry.
- Same sequence of actions ⇒ same results (tests rely on this).

### 4.4 Monitoring and history

- Monitor tick every 5,000 ms: append one sample per provider (P95 latency, data age, success rate, bid) with
  small deterministic noise around current conditions; keep the last 30 samples. Seed 30 samples at start.
- Condition changes append a sample immediately so sparklines visibly jump.
- Stat cards and table values show the provider's **current** conditions (what the monitor measures now).

### 4.5 Time, determinism, hydration

- Never call `Date.now()`, `new Date()`, or `Math.random()` during render. Read `now` from the store.
- Initial state is built from a fixed `FIXTURE_EPOCH` (2026-11-09T18:30:00Z) so server and client first
  renders match. After mount, rebase all timestamps to `Date.now()` once and start the 1 s clock tick.
- Format absolute times with an explicit `timeZone` (market time zone) so SSR and client output agree.
- Relative times ("12 s ago") derive from store `now`.

### 4.6 Persistence and reset

- Persist **policies** (including mode) per market in `localStorage` (`tender:v1:policies`). Rehydrate after
  mount, then re-evaluate. Provider conditions, requests, and activity are not persisted.
- **Reset conditions** restores every provider in the market to fixture defaults (policy unchanged) and logs it.
- **Restore provider** restores one provider. **Reset policy** restores the market's default policy.

## 5. Engine/store contract (`src/lib/tender`)

The authoritative reference is [`src/lib/tender/README.md`](../src/lib/tender/README.md). Summary:

- `@/lib/tender` (server and client; never imports React or zustand): types (`MarketId`, `ProviderId`,
  `RoutingPolicy`, `RoutingMode`, `ProviderConditions`, `RequestResult`, `ActivityEntry`, `MarketView`,
  `ProviderRow`, …), market definitions (`MARKETS`, `MARKET_IDS`, `getMarketDefinition`, `isMarketId`,
  `getDefaultPolicy`, `getDefaultConditions`, `toDisplayValue`/`fromDisplayValue`), evaluation
  (`evaluateMarket`, `runChecks`, `compareProviders`, `STATUS_LABELS`, `PREFERENCE_LABELS`), the pure reducer
  (`createInitialState`, `reduce`, `selectMarketView`), stateless server routing (`selectRoute`,
  `executeSelection`, `routeRequest`), request sampling, persistence helpers, `format.*`, and
  `getApiSnippets` / `getResponseJson`.
- `@/lib/tender/client` (`"use client"`): `<TenderProvider>` (mount once in the root layout),
  `useMarketView(marketId)` (does not re-render on the 1 s clock), `useNow()`, `useTenderActions()`
  (`runRequest`, `setAutoRun`, `setPolicy`, `setRoutingMode`, `resetPolicy`, `updateProvider`,
  `restoreProvider`, `resetConditions`, `switchToRecommended`), `useRouteEvents(marketId, cb)`,
  `usePendingSwitch(marketId)`, `useMarketIds()`, `useTenderSelector(selector)`.
- The HTTP API (`/api/v1/*`) is documented in [`docs/API.md`](API.md); stablecoin payments (x402 USDC on
  Base Sepolia) in [`docs/PAYMENTS.md`](PAYMENTS.md).

## 6. Source layout and ownership

```
src/app/                         routes, layout, globals.css (tokens)
src/lib/utils.ts                 cn() — tailwind-merge configured for the custom type scale
src/lib/tender/                  engine: types, fixtures, evaluate, router, requests, random, format, store, tests
src/lib/server/                  HTTP API glue (route handlers in src/app/api/v1)
src/lib/payments/                x402 USDC payments (seller wrapper, guarded payer, client hook)
src/components/ui/               primitives (Button, Badge, SegmentedControl, Select, NumberField, Switch, Tooltip,
                                 Popover, Dialog, Toast, Table, Card, StatCard, Section, ProviderLogo, Kbd, CodeBlock …)
src/components/shell/            TopNav, TenderMark/Logo, PageContainer, SidebarNav (+ scroll-spy), StickyBar, CommandPalette
src/components/viz/              Sparkline, UptimeBars, PriceChart, … (SVG, no chart library)
src/components/market/           feature sections composed from the above
public/providers/                provider logos
```

## 7. Formatting

- Price: `$18.00` + muted ` /M req`; per-request cost `$0.000018`.
- Latency: `210 ms`; ≥ 1,000 ms → `1.2 s`.
- Data age: `<1 s` → `220 ms`; `<60 s` → `2.4 s`; `<60 min` → `6 min`; else `1 h 12 min`.
- Percent: success `99.94%` (2 decimals); error rate input/display `0.06%`.
- BTC: `$75,230.75`; temperature `61°F`.
- Numbers use `tabular-nums`; units in `text-muted-foreground`.

## 8. Acceptance checklist

- [ ] Both markets render with original provider logos, correct default statuses, and Together / THE ZONE BIO active.
- [ ] Cheapest provider is never selected when it fails a requirement (Cloudflare, NovitaAI by default).
- [ ] Editing a provider's bid/latency/age/error rate/availability updates its status, reason, sparkline,
      the routing decision, stat cards, and activity — immediately.
- [ ] Failover is immediate; optimization switches respect the 10 s cooldown with a visible countdown.
- [ ] Policy edits immediately update eligibility and explain the decision; policies persist across reloads.
- [ ] Pinned mode never switches silently; violations are surfaced with explicit actions.
- [ ] No eligible provider ⇒ "No eligible provider", requests rejected, nothing violates policy.
- [ ] Run request shows a new result, the serving provider, and updates metrics + activity.
- [ ] Switching markets preserves each market's state.
- [ ] Reset conditions / Restore provider / Reset policy work.
- [ ] No banned words, no dead controls, no hydration warnings, no console errors.
- [ ] `bun run verify` passes (typecheck, lint, tests, build).
