# Tender — product brief (from the owner; binding for every lane)

Build **Tender**, an API marketplace where providers compete to serve an application's requests based on
price, latency, freshness, and reliability. (The name comes from a procurement tender: suppliers bid for a contract.)

The product should feel like **OpenRouter for general-purpose APIs**. Developers define the result and service
requirements they need. Tender compares provider bids, monitors performance, and switches to a qualified provider
when the current provider no longer meets those requirements.

## Design reference

Use **OpenRouter's current UI design system** as the primary visual reference:
https://openrouter.ai/deepseek/deepseek-v4.1-flash-1017#providers (the live page is the source of truth;
detailed tokens and component specs live in `docs/DESIGN.md`).
Closely match its typography, spacing, page width, navigation, tabs, provider tables, badges, buttons, borders, and restrained colors.

- Reuse the **actual provider logos shown in the linked Providers section** (they are in `public/providers/`). Never
  substitute generic icons or text initials for a provider that has a logo.
- Treat those names and logos as identities within the local fixture data. Do not add claims about real integrations,
  partnerships, or supported services.
- Prioritize OpenRouter fidelity over a generic SaaS dashboard. Stripe is only a secondary reference for precise
  alignment and clear information hierarchy.
- Light interface, subtle borders, compact controls, readable tables, generous whitespace.
- Avoid oversized marketing headings, decorative gradients, glass effects, excessive rounded cards, and unnecessary illustrations.

Build a working product interface, not a landing page.

## Two API markets

**San Francisco Weather** — current weather for San Francisco through one normalized API contract. Show location,
temperature and condition, supporting weather fields, observation timestamp and data age, and the provider serving
the request. Observation age represents freshness. Do not confuse it with request latency or claim forecast accuracy is measured.

**Bitcoin Price** — the current BTC/USD spot price through one normalized API contract. Show the BTC/USD price, a
compact recent-price chart, source timestamp and data age, request latency, and the provider serving the request.
Keep the price definition consistent across providers so the comparison is meaningful.

## Main interface

Compact application header with the Tender wordmark and OpenRouter-style navigation. The provider comparison is the
visual center of the page.

- **Market selector**: switch between San Francisco Weather and Bitcoin Price. Each market has its own provider bids,
  performance history, routing requirements, active provider, request results, and activity history.
- **Market overview**: the normalized result alongside a compact summary of active provider, current request price,
  P95 latency, data freshness, and request success rate. A **Run request** action produces a new result, shows which
  provider handled it, and updates activity and metrics.
- **Providers**: reproduce the visual structure and density of OpenRouter's provider list: original logo and name,
  bid price with an explicit consistent billing unit, P95 latency, data age, success rate, a small performance
  sparkline, qualification status, routing status. Statuses: **Active**, **Eligible**, **Too slow**, **Stale data**,
  **Over budget**, **Unavailable** (plus **Unreliable** for success rate). Distinguish the provider serving traffic,
  the lowest-priced qualified provider, and providers excluded by the requirements. Explain exclusions with a short
  inline reason or tooltip. Never select the cheapest provider if it fails a requirement.
- **Routing policy**: editable max request price, max P95 latency, max data age, min success rate, routing preference
  (**Lowest cost**, **Lowest latency**, **Freshest data**), and automatic switching or a pinned provider. Market-specific
  defaults and units. Changing a policy immediately updates eligibility and explains the routing decision.
- **Provider conditions**: change a provider's bid price, latency, data age, error rate, availability. Labels like
  **Provider conditions**, **Update bid**, **Restore provider**. When an active provider becomes ineligible: update its
  status and reason, select the best qualified alternative, update the active route and next results, and add a
  timestamped activity entry explaining the switch. If no provider qualifies, show **No eligible provider** and never
  silently violate the policy. A pinned provider's failure is surfaced, never switched without permission.
- **Activity**: compact chronological feed of bids, policy changes, requests, and routing decisions. Each switch states
  previous provider, new provider, trigger, and why the replacement qualifies.
- **Pay with USDC** (added by the owner later): Tender can settle requests in stablecoins. A paid request runs through
  the real HTTP API with x402 and settles USDC on Base Sepolia to the winning provider's address, showing the receipt
  (provider, exact price vs settled amount, transaction hash with a Basescan link). Testnet only.

## Behavior

Coherent local fixtures and deterministic state transitions; tables, summaries, charts, results, and activity stay in
sync. Bidding/evaluation is separate from request execution: requests use the selected route immediately. A simple
switching cooldown prevents rapid changes. Small purposeful transitions make switches easy to follow. Policies persist
locally. **Reset conditions** exists. Every visible control works: no dead navigation, no placeholder buttons.
Plausible fixture values are never labeled as externally measured or connected to real provider infrastructure.

## Copy and scope

Concise English product copy. Do **not** show "Demo", "Simulation", "Hackathon", "Mock data", "Coming soon", or
disclaimer banners anywhere in the interface. Present it as a complete product surface without claiming that real
services are connected (the USDC settlement is real on Base Sepolia testnet; say "Base Sepolia" plainly).

The result must make the core interaction immediately clear: **change a provider's price or performance, watch its
qualification change, and see the next request use the selected provider.**
