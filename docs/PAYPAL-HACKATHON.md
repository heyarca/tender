# Tender × PayPal AI Hackathon — strategy

Hackathon: https://paypalaihackathon.devpost.com/ · **Deadline: Nov 12, 12:00 PT = Nov 13, 05:00 KST**
(target: submit by **Nov 12, 22:00 KST**, ~7 h of buffer).

## 1. What the judges need (from the official rules)

- **Stage 1 (pass/fail):** the project "reasonably applies the required APIs/SDKs": PayPal must be
  central, not decorative. Our current USDC/x402 rail does **not** count as PayPal.
- **Stage 2, equally weighted:** Technological implementation (PayPal + AI, non-trivial) · Design
  (complete product, not a PoC) · Potential impact (real problem, real audience, shown working) ·
  Innovation · Presentation (video shows it end to end; who it's for, why it matters).
- **Must submit:** working demo (hosted URL + test credentials), **public open-source repo with a
  license visible in the About section**, text description, list of AI tools and how they're used,
  **YouTube video < 3 min** with no third-party trademarks or music without permission.
- **Eligibility:** Tender was created on Nov 9, inside the submission period (Oct 1 – Nov 12), so it's a
  new project.

### Prizes to aim at

| Prize | Cash | Why Tender fits |
|---|---|---|
| 1st / 2nd / 3rd | $12k / $8k / $5k | Complete product, live demo, real money movement in sandbox |
| **Best Use of Agentic Commerce** | $5k | AI agents buy API access, provider agents bid, PayPal settles both sides |
| **Best Use of PayPal + AI** | $5k | PayPal Agent Toolkit + MCP at the core of the agent |
| Best Demo Delivery | $5k | We already have a polished UI and a video workflow |
| **Best Use of AG Grid** | $5k / $2k / $1k | Provider tables, transactions, payouts are natural data grids |
| Render credits | — | Optional second deploy on Render (cheap to add) |

## 2. The pitch (one line)

**Tender is the marketplace where AI agents buy API access and PayPal pays everyone.**
APIs compete for an agent's traffic; the agent funds a balance with PayPal, routes each request to
the best provider within its budget, and providers get paid out through PayPal.

Who it's for: developers and AI agents that depend on third-party APIs (data, AI models, logistics),
and the API providers who want that traffic. Problem: API vendor lock-in, outages, and price drift;
agents can't safely buy services on their own today.

## 3. Product changes: "Tender, PayPal edition"

Keep everything that already works (markets, routing, failover, catalog, landing). Replace and add:

1. **Fund with PayPal (buyer side).** Prepaid Tender credits: "Add $10" uses PayPal Checkout
   (JS SDK v6 + Orders v2 create/capture in Route Handlers). Every paid request deducts the winning
   bid from the balance. Micropayments per call don't fit card rails; credits + metering is how real API
   marketplaces work, and it's honest in the pitch.
2. **Agent spending mandate (agentic commerce).** The user approves a budget once (PayPal vault /
   saved payment method for agent-initiated top-ups, plus a spend cap and the routing policy). The agent
   then tops up and buys on its own, within the mandate. Show the mandate and every agent purchase in
   the UI.
3. **Pay providers with PayPal Payouts (seller side).** Each served request accrues earnings to the
   winning provider; "Settle now" (or a scheduled run) sends a PayPal Payouts batch to each provider's
   sandbox account. Show batch status (from webhooks or polling) next to the activity feed.
4. **Ask Tender (the AI agent).** Chat panel built with the Vercel AI SDK and the **PayPal Agent Toolkit**.
   Tender's own tools: list markets, set policy, run request, compare providers. PayPal toolkit tools:
   create order, list transactions, create invoice, merchant insights. Example: "Keep my app on the
   cheapest SF weather feed under $30/M req, P95 under 300 ms, and don't spend more than $5 this week."
   The agent picks the market, writes the policy, funds the balance with PayPal, runs requests, and
   reports spend.
5. **Agent-to-agent bidding (innovation).** Provider agents reprice their bids from load and
   competition (an LLM decides within each provider's floor price). Tender settles the winner through
   PayPal. This is the "two agents negotiating and settling a payment" idea from the hackathon's own
   inspiration list.
6. **Monthly invoices for teams.** Agent Toolkit `create_invoice` / `send_invoice` turns a month of
   usage into a PayPal invoice, for teams that don't want prepaid credits.
7. **MCP for any agent.** `npx @heyarca/tender` also writes an MCP config (Tender tools + PayPal MCP
   server), so Claude/Cursor agents can buy API access from inside the editor.
8. **AG Grid.** Swap the providers table, the transactions list, and the payouts list to AG Grid
   (sorting, filtering, live row updates on failover). Cheap sponsor-prize upside.

Keep USDC/x402 as an "also supports stablecoins" footnote, off the main demo path.

## 4. Compliance checklist (do first — Stage 1 and disqualification risks)

- [ ] Public repo: make `heyarca/tender` public **or** publish a clean public mirror. Before that,
      scan for secrets (`.env*`, keys, tokens, payer wallet) and remove testnet payer/private data.
- [ ] MIT `LICENSE` at the repo root (visible in GitHub's About section).
- [ ] **Third-party trademarks:** provider names/logos copied from OpenRouter (Together, DeepInfra,
      Cloudflare, CoreWeave, …) are third-party marks. For the submission build and the video, use our
      own (Arca Labs, THE ZONE BIO) plus clearly fictional providers with generated logos.
- [ ] Video: our own footage, screen recording, royalty-free or no music.
- [ ] Hosted demo at https://tender.heyarca.app with a PayPal **sandbox buyer account** (email +
      password) in the testing instructions, and a "reset demo" button so judges start clean.
- [ ] README: what it is, how PayPal is used (which APIs), how AI is used (which models, which tools),
      setup (`.env.example` with `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, model key), run, and deploy.

## 5. Build plan (3 days, parallel lanes — same workflow as the Tender sprint)

Shared prep (orchestrator, Day 0 evening): PayPal developer account, sandbox business + buyer accounts,
app credentials in Vercel env (secrets only, no feature flags), `docs/PAYPAL.md` contract (ledger
shape, API routes, webhook events), placeholder components, one worktree per lane.

| Lane | Model | Day | Delivers |
|---|---|---|---|
| paypal-checkout | Opus xhigh | 1 | Credits ledger (Vercel Postgres/KV), "Add funds" with JS SDK v6, Orders v2 create/capture, webhooks, balance in the console |
| paypal-payouts | Astra / GLM | 1 | Provider earnings, Payouts batch, status sync, payouts view |
| ask-tender agent | Opus xhigh | 1–2 | AI SDK chat, Tender tools + PayPal Agent Toolkit (sandbox), spending mandate, guardrails |
| provider bidding agents | Opus | 2 | LLM repricing with floor prices, activity entries, settlement via Payouts |
| ag-grid | GLM-Flash | 2 | Providers, transactions, payouts in AG Grid |
| compliance + repo | GLM-Flash | 1 | Secret scan, LICENSE, public repo, fictional providers, `.env.example`, README |
| story | orchestrator | 3 | Video script, recording, Devpost text, screenshots, test credentials |

Day 3 (Nov 12, KST): freeze features by 15:00, record the video, write Devpost, submit by 22:00.

## 6. Demo video (≤ 2:50)

1. **0:00 Problem (15 s):** your app or agent hard-codes one API vendor; it breaks or gets pricier.
2. **0:15 Ask Tender (45 s):** type the request in plain English; the agent picks a market, sets the
   policy, and funds $10 with PayPal Checkout (sandbox popup, approve).
3. **1:00 Market in action (45 s):** requests flow; a provider spikes latency; Tender fails over; the
   provider agents rebid; balance drops per request.
4. **1:45 Providers get paid (30 s):** "Settle" → PayPal Payouts batch → succeeded in sandbox.
5. **2:15 Any agent, anywhere (20 s):** `npx @heyarca/tender` in an editor; Claude buys API access via MCP.
6. **2:35 Close (15 s):** who it's for, why PayPal (both sides of the marketplace), URL.

## 7. Devpost text skeleton

- **Inspiration:** API lock-in; agents need a safe way to buy services.
- **What it does:** the market, the agent, PayPal on both sides.
- **How we built it:** Next.js 16 on Vercel; PayPal Orders v2, JS SDK v6, Payouts, Invoicing, Vault,
  webhooks; PayPal Agent Toolkit + MCP server; Vercel AI SDK with [model]; AG Grid; parallel coding
  agents (see `docs/HACKATHON.md`).
- **Challenges:** micropayments vs card rails (credits + metering), agent guardrails (mandates, spend
  caps), failover without double charging.
- **Accomplishments, What we learned, What's next:** real provider onboarding (PayPal onboarding for
  sellers), production payouts, more markets opened by agents.
- **Built with:** paypal, paypal-agent-toolkit, nextjs, vercel, ai-sdk, ag-grid, typescript.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| PayPal looks bolted on | Money flows on both sides through PayPal, and the agent transacts through the Toolkit |
| Sandbox setup friction (Payouts/Vault permissions) | Set up sandbox accounts first; if Vault blocks, use one-time Orders per top-up |
| Third-party trademarks | Fictional providers in the submission build and the video |
| Private repo / secrets | Secret scan, then a public repo with LICENSE, Day 1 |
| Late-breaking bugs (no tests) | Freeze at 15:00 Nov 12; smoke-test the judge path on production after every push |
| Judges don't run it | Video carries the story; hosted URL + sandbox credentials as backup |
