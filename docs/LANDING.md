# Tender landing page

## Integration boundary

The marketing page lives at **`/landing`**. It is intentionally additive to the market frontend.
It does not replace `/`, edit the application layout or global design tokens, or mount another
`TenderProvider`. All actions open the actual `/markets/btc-usd` or `/markets/sf-weather` page.
The root redirect and market routes remain owned by the frontend page lane.

The PR targets `feat/tender-frontend`, not `main`. Keep it open for owner review. Promoting the
landing page to `/` is a separate routing decision; do not silently replace the market homepage.

```sh
bun install --frozen-lockfile
bun run dev -p 3417
# http://localhost:3417/landing
bun run verify
```

No new dependencies, environment-variable feature switches, production API calls, payment calls,
shared store writes, or localStorage writes are introduced by the landing page. The root application
may later mount its own providers; the marketing scenes do not consume them.

## Copy and data boundary

The owner supplied **Landing page copy and presentation brief — Revision 2** for this route.
Its exact approved hero is “Make APIs compete / for your traffic.” The seven-section order,
“Explore the demo” actions, and readable simulated-data disclosures deliberately supersede the
older product-only copy restrictions in `docs/BRIEF.md`, `docs/SPEC.md`, and `AGENTS.md` **on this
marketing route only**. The product UI is unchanged. There are no eyebrow labels, fake customer
logos, scale claims, production-availability claims, payment claims, or available bidding claims.

`demo-model.ts` is a deterministic, in-memory **marketing storyboard**, not a second product
engine or application destination. It uses the owner's explicit A–D examples in USD per 1,000
requests (the product has different fixtures and uses per-million pricing). Do not substitute real
provider identities or describe these examples as measured results. Its data never enters the
application store or the payment path.

- Maximum price $0.50 / 1K; P95 ≤ 100 ms; age ≤ 2 seconds; success ≥ 99.5%.
- Initial A: $0.40, 48 ms, 160 ms, 99.9%. B: $0.46, 72 ms, 220 ms, 99.9%.
- C: $0.28, 140 ms (too slow). D: $0.22, 8 seconds (stale).
- Each failure control starts a separate resettable scene. A fails; B becomes the next route.
- The price control starts a fresh scene: B falls to $0.34; A stays active for the full 10-second
  optimization cooldown. A reset cancels the pending switch. Only this pending scene runs a clock.
- No eligible provider is fail-closed in the storyboard model. The page does not execute requests,
  and its visible BTC result is always labeled as a sample, separate from the next-route event.
- The hero makes one selection change and stops. Reduced motion leaves a valid static selection;
  the manual slowdown/reset control remains available. User-triggered scenes use discrete readable states.
- Bitcoin $75,230.75 and San Francisco 61°F/overcast/9 mph W/1018 hPa come from the existing product
  fixture specification, not a live quote, forecast, detected location, or supplier feed.
- Provider-submitted offers are explicitly future work; the diagram says “Proposed marketplace flow.”

## Visual reference

The current Tempo homepage was inspected in a real browser on November 9, 2026. It uses a neutral
#f5f5f5 page, black regular display type, a 1,280px desktop measure, quiet horizontal rules,
generous section space, and a text/figure product module. Its current hero is centered and has
large pale track geometry followed by customer logos and a city photograph. Lower sections do have
eyebrows. Tender adapts the restraint and product rhythm, not that exact composition or its assets.

The owner's brief overrides those reference details: Tender uses a split hero, no eyebrows or
endorsements, its own provider-selection graphic, a warm near-white surface, and restrained blue.
Geist is a freely available display alternative; Tempo's licensed Pilat font is not copied. Body
copy retains the application's Plus Jakarta Sans. OpenRouter's provider directory informed the
aligned numeric columns and quiet rows, not the marketing-page sequence.

## Styles and metadata

The existing Turbopack rule transforms `*.css` with `as: "*.css"`. In a real browser it discarded
CSS-module exports, producing `undefined` classes despite a successful typecheck. To avoid touching
shared config, `landing.css` uses the explicit `tenderLanding_` namespace, is imported only by the
landing layout, and is accessed through the typed `styles.ts` map. Every selector is namespaced;
no unscoped `body`, `html`, or `:root` rules are added. The display font is also scoped to this layout.

Route metadata includes the approved title/description and a generated 1,200×630 social image.
Absolute social-image URLs use Vercel's provided deployment hostname, or localhost:3417 in local
runs. No production domain or application URL is invented.

## Verification

Run the full project verification command, not `bun test`. Storyboard tests cover qualification,
failover, cooldown, reset, invalid metrics, and no eligible provider. UI tests cover the real
accordion, controls, timer cleanup, motion preference, approved copy, and destination links.
Browser checks should additionally cover desktop/mobile rendering, horizontal overflow, all four
requirements, each failure control, countdown/reset, keyboard focus, console errors, both real market
destinations, and the social image. Verify the production build as well as development rendering.
