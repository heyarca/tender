# Tender

The execution market for APIs. Providers compete to serve each request on price, latency, freshness,
and reliability. Tender enforces your routing policy and switches providers when the current one stops
qualifying.

This repository contains the frontend product surface (Next.js 16, React 19, Tailwind CSS v4) with two
markets: **San Francisco Weather** and **Bitcoin Price**. Data comes from local fixtures and
deterministic state transitions.

```bash
bun install
bun run dev       # http://localhost:3000
bun run verify    # typecheck, lint, tests, production build
```

- Product and engine spec: [`docs/SPEC.md`](docs/SPEC.md)
- Design system: [`docs/DESIGN.md`](docs/DESIGN.md)
- Provider logo sources: [`docs/provider-logos.md`](docs/provider-logos.md)

## Deploy

`main` deploys to production on Vercel (`the-zone-bio/tender`); pull requests get preview deployments.
Pull requests to `main` merge automatically once CI (`bun run verify`) passes. Keep a PR in draft to hold it.
