# Tender — hackathon log (Nov 9, 2026)

Built in one day by Junho Yeo with parallel coding agents. This file records what we built and how we
worked, so the next sprint starts faster. Sources: git history on `main`, GitHub PRs, and the local
agent transcripts (Prime sessions `01a1bdff` orchestrator and `01a1be50` landing).

## What Tender is

**The execution market for APIs.** Providers compete to serve each request on price, latency, data
freshness, and reliability. A developer (or an AI agent) sets requirements; Tender routes every request
to the best qualifying provider and switches when one breaks or a better offer appears. Requests are
paid per call in USDC with x402.

- Live: https://tender.heyarca.app (`/` → `/landing`) · `/markets` directory · `/markets/<id>` consoles ·
  `/catalog/<id>` demo categories · `/demo` video
- Package: `npx @heyarca/tender@latest` (adds Tender instructions to `AGENTS.md`/`CLAUDE.md`; CLI + client)
- Repo: `heyarca/tender` (private), Vercel project `the-zone-bio/tender`, every push to `main` deploys

### What shipped

| Area | State at end of day |
|---|---|
| Market console | OpenRouter-style page per market: providers table, routing policy, provider conditions, activity, Pay with USDC, ⌘K palette, API dialog |
| Markets | 15 live engine markets: 6 weather cities, 3 real-world goods (Shenzhen MLCC, lithium carbonate, SHA→LAX freight), 2 currencies, 4 crypto |
| Catalog | 20 API categories / 60 demo markets (stock quotes → LLM chat → web scraping) with Unsplash images |
| Engine | Deterministic fixtures, qualification + ranking, failover, 10 s switch cooldown, pinned mode, no-eligible state |
| HTTP API | `/api/v1/markets`, `/markets/{id}`, `/weather/current`, `/prices/spot`, OpenAPI 3.1, CORS |
| Payments | x402 USDC on Base Sepolia via PayAI facilitator; real on-chain settlements verified |
| Landing | Tempo-style landing with live product embeds, brand: PP Mori + lime `#C8FF00` |
| Package | `@heyarca/tender@0.1.0` built in `packages/tender` (publish pending npm login) |

### Numbers

- 347 commits on `main` between 11:16 and 16:35 (~5 h 20 min), 22 PRs (11 by `junhoyeo`, 11 by `METHEZONE`).
- 2 root agent sessions working in the same repo, 40+ sub-agent sessions in total.
- Models by role: Claude Opus 5.5 (xhigh) for frontend lanes; GPT-6 Astra (high) for the API and
  payments backend; GLM-5.3-Flash for audits and small, precise fixes.

## Timeline

1. **Idea → brief (10:36).** Chat idea "ESCAPE: software that can leave its vendors" → reverse-auction
   API market → refined product brief (OpenRouter UI, two markets, real provider logos, no "demo" copy).
2. **Foundation.** OpenRouter reference pack (tokens, markup, light screenshots), Next.js 16 scaffold,
   `docs/SPEC.md` + `docs/DESIGN.md` + `AGENTS.md` as the contract every agent reads.
3. **Phase 1, parallel lanes.** Engine, UI kit, shell, charts (Opus) + API and x402 payments (Astra),
   one git worktree and one file-ownership list per lane.
4. **Renames and infra.** ESCAPE → Tender, pnpm → bun, repo → `heyarca/tender`, Vercel → THE ZONE BIO team.
5. **Real money moment.** First USDC settled on Base Sepolia, then a reroute payment (raise Together's
   bid → DeepInfra gets paid).
6. **Phase 2.** Page frame, providers table, controls, Pay with USDC lanes → market page live in production.
7. **Brand.** PP Mori + lime palette applied across product and landing.
8. **Audit.** 7 GLM-5.3-Flash auditors → 31 GitHub issues → GLM fixer lanes.
9. **Scale the market.** 12 → 15 engine markets, `/markets` directory, 20-category catalog, provider
   rename (Parasail → THE ZONE BIO, inference.net → Arca Labs).
10. **Ship mode.** Direct pushes to `main`, no PRs, no local tests, CI removed; package + README last.

## Workflow that worked

- **Docs as the seam.** `docs/BRIEF.md` (owner's words), `docs/SPEC.md`, `docs/DESIGN.md`,
  `docs/INTEGRATION.md` (who owns which file/section). Agents read these first, every time.
- **One lane = one worktree + one file-ownership list.** Lanes ran in parallel without conflicts because
  they never edited each other's files; shared types/tokens stayed with the orchestrator.
- **Placeholders first.** The orchestrator committed stub section components with fixed exports, so four
  page lanes could build at once and merge cleanly.
- **Right model per job.** Big UI work → Opus xhigh; backend → Astra; audits and small, fully specified
  fixes → GLM-5.3-Flash with over-communicated briefs (exact files, exact change, "done when" list).
- **Agents talk to each other.** Root sessions coordinated by message (landing ↔ orchestrator), sibling
  lanes agreed interfaces directly (API ↔ payments).
- **Verify on the real thing.** Screenshots of production, on-chain receipts read by RPC, curl/`vercel curl`
  against previews; claims were checked, not assumed.
- **Merge fast.** Started with PR → CI verify → auto-merge; switched to direct pushes to `main` when speed
  mattered more than gates. A fetch → merge → push retry loop handled two sessions pushing at once.

## What hurt (and the fix)

| Problem | Fix / lesson |
|---|---|
| Machine restart killed every agent mid-work | Uncommitted work survived in worktrees; resume briefs + "commit early and often" |
| Renaming a PR's head branch closed the PR on GitHub | Push a new branch and open a new PR instead |
| Two root sessions pushing to `main` → constant non-fast-forward | Sync-retry loop; keep file ownership separate |
| Parallel PR (#49) added a second "quote" market pipeline | Merged onto the generic price pipeline; one engine path |
| Skipped tests → visual regressions (market lists overflowing navs) | Look at production screenshots after each push |
| Public x402 facilitator ran out of gas | Switched to PayAI after checking signer balances on-chain |
| Node 26 `Request` abort lost through GC'd clones | Bind the request to the authoritative signal; deterministic tests |
| Aside browser forced dark mode (Dark Reader) | `darkreader-lock` meta / headless Chromium for references |
| macOS screenshot temp files use a narrow no-break space before "PM" | Copy with a glob (`Screenshot*4.03.42*.png`) right away |
| Expired tokens (npm, Vercel API) | Check auth before the step that needs it; ask the owner early |

## Hackathon-mode rules (for next time)

1. Write the brief and the ownership map first; agents build against docs, not chat.
2. Spawn lanes in parallel, each in its own worktree with an explicit file list.
3. Commit early; push to `main` directly when the owner says "ASAP".
4. Keep one source of truth for shared logic (engine, types, tokens) and one owner for it.
5. After every push: screenshot production. That replaces the tests we skipped.
6. Use the cheapest model that can do the job, with a brief it can follow literally.
7. Record decisions in this file and in `docs/`, not only in chat.

## Open items

- Publish `@heyarca/tender@0.1.0` (npm login / token for the `@heyarca` scope).
- Vercel API token used for deploy checks is invalid (deploys still run on push).
- Tests are skipped, `markets.test.ts` removed, CI deleted: restore a smoke suite before the next big change.
- Only San Francisco weather and BTC use live upstream data; other markets and the catalog are deterministic fixtures.
- Payments are testnet (Base Sepolia); accessibility was out of scope.
