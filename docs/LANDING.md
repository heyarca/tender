# Tender landing page

The marketing page lives at **`/landing`** (`src/app/landing`, `src/components/landing`). It follows the
current tempo.xyz layout language with the Tender brand: PP Mori, the Tender wordmark, lime `#C8FF00`
fills with ink text, and olive `#4A6000` for accent text and lines on light surfaces.

```sh
bun install --frozen-lockfile
bun run dev -p 3417          # http://localhost:3417/landing
bun scripts/landing-styles.ts # after editing any landing CSS
bun run verify
```

## Structure

| Section | Component | Content |
| --- | --- | --- |
| Navigation | `LandingChrome` | Floating tray: wordmark and mark, Markets, How it works, Marketplace, Try Tender |
| Hero | `HeroSection` | Headline, two actions, aerial traffic film with a routing card driven by the engine |
| `#markets` | `MarketsSection` | Bitcoin and weather cards with the real result components |
| `#how-it-works` | `RequirementsSection` | Requirement accordion beside the real routing policy form |
| `#switch-providers` | `SwitchSection` | The real market overview, provider table, conditions, and activity in an app window |
| `#better-prices` | `PriceSection` | Bids competing on the real store, including the 10 s switch cooldown |
| `#marketplace` | `MarketplaceSection` | Provider offers converging on one selected offer |
| Closing + footer | `ClosingSection`, `LandingChrome` | One action; black footer with market and product links |

## Product embedding

The root layout mounts `AppProviders` (Tender store, tooltips, toasts) for every route, so the landing
page shares the live engine store with `/markets/*` in the same tab. Policy edits persist like they do in
the console. `LandingProductProviders` adds the market page's `MarketUiProvider` and the market shown by the
embeds. Product sections have fixed ids, so each is mounted once: `RoutingPolicySection` in the
requirements section; `MarketOverview`, `ProvidersSection`, `ProviderConditionsSection`, and
`ActivitySection` in the switch section. `PaymentsSection`, `MarketPage`, `MarketsFrame`, and `MarketHeader`
are not embedded. Interactive controls call the engine's local actions (`useTenderActions`). Nothing mutates
state on mount.

The hero animation runs in its own in-memory engine state (`demo-model.ts`, a pure adapter over
`@/lib/tender`), so loading the page never changes the shared store.

## Styles

The shared Turbopack rule processes every `*.css` file with the Tailwind loader, which drops CSS-module
exports. Landing styles therefore use an explicit `tenderLanding_` class namespace in plain CSS files that
only the landing layout imports. `scripts/landing-styles.ts` generates the typed `styles.ts` map. No
selector outside that namespace is added. Base tokens and shared pieces (container, section rhythm,
buttons, navigation, footer) live in `landing-base.css`; each section owns its own stylesheet.

Buttons (`LandingButton`) are 36 or 44 px with 10–12 px radii, inner label padding, 20 px icons, an xs
shadow and inner highlight, hover and active states, a press scale, and an offset focus ring.

## Media and metadata

Real photography and video live in `public/landing/` (sources and licenses: see the media manifest
section below). The Tender wordmark source is `public/brand/tender-wordmark.svg`. The mark (an asterisk
beside a square) comes from the Figma file "Tender" (Frame 10); its geometry lives in
`src/components/shell/tender-mark.tsx`, and `public/brand/tender-mark*.svg` and `src/app/icon.svg` use it.

`opengraph-image.png` and `twitter-image.png` in `src/app` and `src/app/landing` are the owner's social
preview ("Tender. Always on the best API."), exported from the Figma file "Tender" (Frame 30, node 11:172). Next resolves their absolute URLs from the Vercel deployment URL.
