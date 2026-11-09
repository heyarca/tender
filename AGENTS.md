<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Tender — agent guide

Read `docs/SPEC.md` (behavior + engine contract) and `docs/DESIGN.md` (OpenRouter-aligned design system) before coding.

## Commands (pnpm only)

- `pnpm dev -p <port>` — dev server (use the port you were assigned; never 3000).
- `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm verify` (all four).
- Do not add dependencies without the orchestrator's approval. Already installed: `@base-ui/react`,
  `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `zustand`, `motion`, `cmdk`,
  `vitest`, `jsdom`, `@testing-library/react`.

## Conventions

- TypeScript strict. Named exports. Components in PascalCase files under the owning directory.
- `cn()` from `@/lib/utils` for class names (it knows the custom type scale).
- Base UI (`@base-ui/react`) for interactive primitives (Tooltip, Popover, Dialog, Select, NumberField, Switch, Toast, …),
  styled with Tailwind to match `docs/DESIGN.md`. Icons from `lucide-react` (16px, stroke 1.75–2).
- Client components only where needed (`"use client"`). No `Date.now()`, `new Date()`, or `Math.random()` during render.
- No environment-variable feature flags or toggles.
- Light theme only. No hard-coded hex colors in components.
- Product copy: concise English, sentence case. Never show "Demo", "Simulation", "Mock", "Hackathon",
  "Coming soon", or disclaimer banners.

## Git

- Commit only as the existing git identity (Junho Yeo <i@junho.io>). Never override it (`-c user.*`,
  `GIT_AUTHOR_*`, `--author`), never add `Co-authored-by` trailers.
- Atomic conventional commits; stage files explicitly (`git add <file>`), never `git add -A`.
- Never run `git stash`, `git reset --hard`, `git checkout -- .`, or delete other people's work.
