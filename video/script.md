# Tender product walkthrough — script and shot list (v1)

Target: 2:20–2:40 total, hard limit 2:55. 1920×1080, 30 fps. English narration. Product demo, not a pitch.
Tone: institutional SaaS. Calm, declarative, present tense. No hype words, no disclaimers, no eyebrows.
Record against production https://tender.heyarca.app (must be serving main 435fd0e or later).

## Hackathon rules that apply to the video (PayPal AI Hackathon, Devpost)
- Under 3 minutes. Judges need not watch beyond 3:00.
- Must show the project functioning on the device it was built for (a desktop browser).
- Uploaded to YouTube, public or unlisted, no password.
- No third-party trademarks or copyrighted music/material without permission. PayPal (required sponsor platform)
  and AG Grid (sponsor tool) may be named. Do NOT show other companies' logos (editors, model vendors, browsers,
  OS chrome, bookmarks, extensions). Provider logos allowed: THE ZONE BIO and Arca Labs (the entrant's own).
- English.
- Judged on "Presentation": the video clearly demonstrates the project working end to end; says what problem
  is solved, who it is for, and why it matters; easy to follow. Also shows PayPal + AI used thoroughly
  (Checkout, Vault, Payouts, Agent Toolkit; buyer agent + provider bidding agents) and a complete product.

## Narration (scene id: text) — v2, full context, fast delivery (ElevenLabs Eric, eleven_v4)
- s01_open: Every app and every AI agent runs on third-party APIs: weather, market data, AI models. Each integration is a bet on one vendor. When that vendor gets slow, serves stale data, or raises its price, your product pays, and switching means new code and new billing. Tender is a marketplace where API providers compete for every request. It routes each call to the best one, and PayPal moves the money on both sides.
- s02_markets: Tender lists seventy-five API markets. A market is one kind of data, like San Francisco weather, served by several providers. Each provider bids a price per request, and Tender measures what it delivers: latency, freshness, and success rate. The directory runs on AG Grid, so you can search, sort, and watch bids move live.
- s03_routing: In each market, you set your limits: price, P95 latency, data age, and success rate. Tender ranks the providers that meet every limit and routes each request to the top one. Tighten the latency limit to 200 milliseconds, and the current provider no longer qualifies. Traffic moves to Kitefin, and Tender explains every exclusion.
- s04_checkout: A request costs a fraction of a cent, too small for a card payment, so buyers prepay credits. Here we add ten dollars with PayPal Checkout. Tender creates the order, the buyer approves it in PayPal, and Tender captures the payment on the server. The balance changes only after PayPal confirms the capture. Each request then pays the winning bid from that balance, and every charge is in the account history.
- s05_ask: Ask Tender is an AI agent that buys API access for you, using payment tools from the PayPal Agent Toolkit. Describe what your app needs in plain English. The agent finds the market, writes the routing policy, and asks for one approval: a weekly spending limit.
- s06_vault: Approving saves your PayPal account with PayPal Vault. From then on, the agent tops up the balance by itself when it runs low, never beyond the limit you approved. This account started at zero. The agent topped up five dollars, ran three paid requests, and reported the provider, the cost, and what is left this week.
- s07_bidding: On the supply side, every provider has a pricing agent. In each bidding round, the agents set new prices from recent wins and rival bids, within seventy to one hundred fifty percent of the listed price. Every change comes with a one-line reason, recorded in the bid history.
- s08_payouts: Providers earn the winning bid on every request they serve. Settling sends one PayPal Payouts batch to every provider with at least one cent unpaid, and Tender tracks each payout until PayPal completes it. PayPal handles both sides: money in from buyers, money out to providers.
- s09_agents: Coding agents can use Tender too. One command installs the Tender MCP server. The agent can then list markets, get a quote, and call a market, paid from the same credits.
- s10_close: Tender. Always on the best API.

## Shot list (what must be on screen; capture real product behavior, never mock it)
- s01_open: /landing hero. Headline, then the hero routing card switching provider once. Slow, short scroll.
- s02_markets: /markets directory grid (AG Grid): rows updating live, quick filter typed ("weather"), a column
  sort, then open "San Francisco Weather".
- s03_routing: /markets/sf-weather: latest result, provider ranking grid, routing decision text. Tighten one
  policy limit (e.g. Max P95 latency) so the active provider is excluded and routing switches; the decision
  text explains why.
- s04_checkout: Add funds → $10 → PayPal Checkout popup (sandbox buyer login, Complete Purchase) → balance
  $10.00 → "Run with credits" Run → served result + charged amount → /account transactions grid shows the
  top-up and the charge.
- s05_ask + s06_vault: on a FRESH account with $0 balance: open Ask Tender, type
  "Keep my app on the cheapest San Francisco weather feed under $30 per million requests with P95 under 300 ms,
  and don't spend more than $5 this week." → agent applies policy → approval card with the weekly limit and
  "Let Ask Tender top up automatically with PayPal" ticked → approve in the PayPal window (Vault) → agent tops
  up without a popup (balance was $0), runs paid requests, reports provider, cost, and what is left this week.
- s07_bidding: market page bidding agents: run a bidding round; new bids arrive with one-sentence reasons; the
  provider ranking re-orders.
- s08_payouts: /payouts: earnings per provider; "Settle now" → new PayPal Payouts batch; item statuses reach
  Success. (If earnings are under one cent, first generate real usage with paid requests.)
- s09_agents: the "Let your agent buy and sell API access" banner with `npx @heyarca/tender@latest`
  (landing or /markets), then Account → API keys.
- s10_close: end card (composed, not captured): Tender wordmark, "Always on the best API", tender.heyarca.app.
