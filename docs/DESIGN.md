# Tender design system (OpenRouter-aligned)

Tender uses **OpenRouter's current light design system** as the primary reference
(https://openrouter.ai/deepseek/deepseek-v4.1-flash-1017#providers). Stripe is only a secondary reference
for alignment and hierarchy. Prioritize OpenRouter fidelity over a generic SaaS dashboard.

Tokens live in `src/app/globals.css` (Tailwind v4 `@theme inline`). Use the semantic classes below; do not
hard-code hex colors in components.

## Foundations

- Font: **Plus Jakarta Sans** (`font-sans`, loaded with `next/font` as `--font-jakarta`), body weight **450**,
  `tabular-nums` everywhere. Mono: Geist Mono (`font-mono`). Do not use OpenRouter's licensed "gordita" font or its logo.
- Type scale mirrors OpenRouter. **`text-xs` and `text-sm` are 14px.** Use:
  - `text-body` 14px/1.625 (default UI text), `text-button` 14px (buttons, weight 500)
  - `text-caption` / `text-overline` 12px (labels, segmented items, tags), `text-micro` / `text-2xs` 10px (units in table headers, struck prices)
  - `text-base` 16px (section h2, stat values), `text-title` 20px (page h1, weight 600), `text-display` 24px (big result numbers can go larger, see below)
  - table header cells: `text-[13px] font-medium text-muted-foreground`
- Colors (light only):
  - `bg-background` #fcfcfe page, `bg-card` / `bg-surface` #fff, `text-foreground` ink #03080a
  - `text-muted-foreground` ink/69%, `text-faint` ink/44%, `border-border` ink/7.8%, `bg-muted` ink/3%
  - Primary grape `bg-primary` #7624f4 + `text-primary-foreground`; hover `hover:bg-accent-hover`
  - Accent wash `bg-accent` (grape/8%) + `text-accent-foreground` (grape) for active nav/selected states; `bg-accent-subtle` for hover
  - Status: `text-positive-text` / `bg-positive-bg` / `bg-positive` (green), `text-negative-text` / `bg-negative-bg` / `bg-negative` (red),
    `text-warning-text` / `bg-warning-bg` / `bg-warning` (amber), `text-info-text` / `bg-info-bg` (blue)
  - Tier tags: `bg-tier-priority-bg text-tier-priority` (violet), `bg-tier-flex-bg text-tier-flex` (green), `bg-tier-ultrafast-bg text-tier-ultrafast` (orange)
  - Hover rows `bg-card-hover`, selected rows `bg-selected`
- Radius: 4 / 6 / 8 / 12 px (`rounded-sm|md|lg|xl`). Cards and framed tables use `rounded-lg`; buttons and inputs `rounded-md`.
- Borders do the work; shadows are minimal (`shadow-sm` only on the active segmented item and popovers).
- Focus: `focus-visible:outline-none focus-visible:border-focus-border focus-visible:shadow-focus` (or a 2px ring in `ring-ring` for table headers).
- Motion: 80 / 150 / 250 ms (`duration-micro|quick|fast`), `ease-in-out-strong`, `ease-smooth-out`. Respect `prefers-reduced-motion`.

## Layout

- TopNav: `sticky top-0 z-40 h-14 border-b border-border bg-background`; inner `mx-auto flex h-full items-center px-4 lg:px-6`.
  Left: Tender lockup (mark + lowercase "tender" wordmark, ~24px tall). Then a search trigger
  (`h-8 w-60 rounded-md border border-input bg-input-bg px-3 text-muted-foreground`, ⌘ K `kbd` chips
  `h-5 min-w-5 rounded-sm bg-muted px-1.5 font-mono text-overline`). Right: ghost nav buttons
  (`h-8 px-2 rounded-md text-button font-medium text-muted-foreground hover:bg-accent-subtle hover:text-accent-foreground`)
  and one primary button (`h-8 px-3 bg-primary text-primary-foreground hover:bg-accent-hover`).
- Page container: `mx-auto w-full px-4 pt-6 pb-8 md:max-w-7xl lg:px-6`.
- Title row: 28px circle icon (`size-7 rounded-full border bg-background p-1`) + `h1` (20px/600). Identifier under it:
  `text-xs font-medium text-muted-foreground` with the first segment underlined
  (`text-foreground underline underline-offset-2 decoration-current/40`) and a 28px square copy button.
  Right-side actions: outline buttons `h-8 gap-2 px-4 rounded-md border border-input bg-background hover:bg-muted` and primary.
- Stat cards: `rounded-lg border border-border bg-card px-3 py-2.5`; label `text-caption text-muted-foreground`;
  value `mt-1 text-base font-medium leading-tight tabular-nums` with a unit `ml-1 text-xs font-normal text-muted-foreground`.
- Main grid: `grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6`, separated from the header by `border-t border-border`.
- Sidebar nav (sticky): items `flex items-center gap-2 px-2 py-1.5 rounded-md text-body font-medium` + 16px lucide icon;
  inactive `text-muted-foreground hover:text-accent-foreground hover:bg-card-hover`; active `bg-accent text-accent-foreground`.
  Group labels `px-2 text-caption text-muted-foreground`.
- Section: `<section id="…" class="mb-10 scroll-mt-28">`; header `flex items-center gap-2 mb-1.5` with 16px icon +
  `<h2 class="text-base font-medium">`; description `mb-4 max-w-2xl text-xs leading-relaxed text-muted-foreground`;
  body framed `rounded-lg border border-border p-5` (p-0 on small screens).

## Components

- **Buttons**: primary (grape), outline (border-input, bg-background), ghost (muted text, accent-subtle hover),
  dashed chip (`h-8 rounded-md border border-dashed border-border px-2.5 text-body text-muted-foreground hover:border-solid hover:bg-accent hover:text-foreground`),
  destructive outline for resets. Heights: 28 (`h-7`), 32 (`h-8`, default), 36 (`h-9`). Icons 16px.
- **Segmented control**: `inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5`; items
  `h-6 px-2 rounded-sm text-overline font-medium`; active `bg-background text-accent-foreground shadow-sm`;
  inactive `text-muted-foreground hover:text-accent-foreground`. Animated indicator optional (250 ms).
- **Badges / tags**: `rounded-sm px-1.5 py-0.5 text-overline leading-none font-medium`.
  - Active route: grape (`bg-accent text-accent-foreground`), Eligible: neutral or green text,
    Too slow / Stale data / Over budget: amber (`bg-warning-bg text-warning-text`),
    Unavailable / Unreliable / pinned-failing: red (`bg-negative-bg text-negative-text`),
    Best price: green text like OpenRouter's "51% off" (`text-xs font-medium text-positive-text`).
- **Table** (OpenRouter `or-table`): framed `overflow-hidden rounded-lg border border-border bg-card`;
  cells `px-3 py-2.5` (first column `pl-4`, last `pr-4`), `border-b border-border`, `whitespace-nowrap`;
  header `text-[13px] font-medium text-muted-foreground`, numeric columns right-aligned with unit suffix in
  `text-micro text-faint` (e.g. "Bid /M"); tooltip headers `underline decoration-dotted underline-offset-2 cursor-help`.
  Rows hover `bg-card-hover`; numbers `tabular-nums text-foreground`, units `text-muted-foreground`.
  Provider cell: 20px logo box (`size-5 rounded-sm bg-background p-px` + `ring-1 ring-inset ring-border/60` overlay,
  `object-contain`) + name (`text-xs text-foreground`) + inline tags, `gap-2.5`.
  A muted sub-header row (`bg-muted text-caption text-muted-foreground`) separates excluded providers, like
  OpenRouter's "Not used in Standard routing".
- **Uptime/success bars**: three `h-3.5 w-1.5` bars with `gap-px` (`bg-positive`; amber/red when failing) + `w-16 text-right` percentage.
- **Sparkline**: 1.5px stroke, no axes, 72–96 × 20–24 px, muted stroke when excluded, grape when active;
  optional dashed policy-limit line.
- **Charts**: card `rounded-lg border p-4`, title `text-sm font-medium`, thin lines (1.5px), faint horizontal guides,
  axis labels 11–12px muted, legend rows "● Name  Avg 0.26 s".
- **Inputs**: `h-8 rounded-md border border-input bg-input-bg px-2.5 text-body` with unit suffix inside (muted);
  focus `border-focus-border shadow-focus`. Number fields support arrow keys and steppers.
- **Tooltip/Popover**: white, `rounded-md border border-border shadow-popover`, `text-caption` content, 6–8px padding.
- **Toasts**: white card, border, `shadow-popover`, icon + title (`text-body font-medium`) + one muted line, auto-dismiss 5 s.

## Do / don't

- Do keep the UI dense, calm, and aligned: 14px body, muted labels, borders over shadows, generous whitespace between sections.
- Don't use oversized marketing headings, gradients, glass effects, heavy shadows, pill-shaped everything, emoji, or illustrations.
- Don't add dark mode. Don't hard-code colors. Don't introduce another font.
