# Phase 2 integration contract (market page)

Read first: `docs/BRIEF.md` (owner's product brief, binding), `docs/SPEC.md`, `docs/DESIGN.md`,
`src/lib/tender/README.md` (engine + store API), `docs/API.md`, `docs/PAYMENTS.md`.

## Composition

`/` redirects to `/markets/sf-weather`. `/markets/[market]` (static params for `sf-weather`, `btc-usd`) renders the
market page. The root layout mounts `<TenderProvider>` (engine store), `<TooltipProvider>`, and `<Toaster />`.

```
TopNav (sticky)                                     — page lane
Title row + market switcher + overview              — page lane
StickyBar (after the title scrolls away)            — page lane
grid lg:grid-cols-[200px_1fr]
  SidebarNav (markets + sections, scroll-spy)       — page lane
  <ProvidersSection marketId />                     — providers lane   (#providers)
  <RoutingPolicySection marketId />  |  <ProviderConditionsSection marketId />   — controls lane (#routing, #conditions; side by side on xl)
  <PaymentsSection marketId />                      — payments-ui lane (#payments)
  <ActivitySection marketId />                      — controls lane    (#activity)
CommandPalette, API dialog, route-event toasts      — page lane
```

## Section components (the seam between lanes)

Each section is a `"use client"` component with props `MarketSectionProps = { marketId: MarketId }` that renders
its own `<Section id=… icon=… title=… description=…>` (from `@/components/ui/section`) and reads/writes the store
itself (`useMarketView`, `useTenderActions`, `useNow`, `usePendingSwitch` from `@/lib/tender/client`). Section ids
and labels are fixed in `MARKET_SECTIONS` (`src/components/market/market-ui.tsx`).

| Export | File | Owner lane |
|---|---|---|
| `ProvidersSection` | `src/components/market/providers/providers-section.tsx` | providers |
| `RoutingPolicySection` | `src/components/market/policy/routing-policy-section.tsx` | controls |
| `ProviderConditionsSection` | `src/components/market/conditions/provider-conditions-section.tsx` | controls |
| `ActivitySection` | `src/components/market/activity/activity-section.tsx` | controls |
| `PaymentsSection` | `src/components/market/payments/payments-section.tsx` | payments-ui |

Placeholders exist on the integration branch; each lane replaces only its own files (plus new files in its own folder).
Do not rename these exports or files.

## Shared UI state (`src/components/market/market-ui.tsx`, owned by the orchestrator)

- `MarketUiProvider` — mounted once by the market page.
- `useSelectedProvider(marketId)` → `[providerId | null, select]` — e.g. clicking a provider row selects it; the
  conditions panel edits the selected provider (falls back to the active provider when `null`).
- `focusSection(id)` — smooth-scrolls to a section and focuses its heading (used by "Edit conditions" links,
  callout actions, the command palette).
Need another shared piece? Message the orchestrator instead of editing this file.

## Shared building blocks (already merged; reuse, don't fork)

- UI kit: `@/components/ui/*` (Button, Badge, StatusDot, SegmentedControl, Tooltip/InfoTooltip, Popover, Select,
  Input, NumberField, Slider, Switch, Checkbox, Field, Card, StatCard, Section, Separator, Skeleton, Table…,
  ProviderLogo, CopyButton, CodeBlock, EmptyState, Kbd, Dialog, toast).
- Shell: `@/components/shell/*` (TopNav, TenderLogo/Mark, PageContainer, SidebarNav/SidebarNavMenu/useScrollSpy,
  StickyBar, CommandPalette/useHotkey).
- Viz: `@/components/viz` (Sparkline, SuccessBars, PriceChart, LatencyStrip, Delta, providerColor…).
- Results: `@/components/result` (WeatherResult, BitcoinResult, ResultMeta, JsonView…).
- Formatting: prefer the engine's `format.*` from `@/lib/tender` for product numbers.
- Provider logos: always `ProviderLogo` with `row.identity.logo` (or the equivalent field).

## Rules for every lane

- Light theme only; OpenRouter fidelity; no hard-coded colors; copy rules from `docs/BRIEF.md` (no "Demo" etc.).
- Every visible control works. No placeholders left in your files when you report.
- No `Date.now()`/`new Date()`/`Math.random()` during render; use `useNow()`.
- Each lane verifies its section visually inside a real page: create an UNCOMMITTED scratch route
  (`src/app/scratch-<lane>/page.tsx`) that wraps your section in `<TenderProvider><MarketUiProvider>…` (and
  `<TooltipProvider>`/`<Toaster />` if needed). Delete it and `.next/dev/types` before the final build.
