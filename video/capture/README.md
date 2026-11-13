# Tender demo capture

Real product footage from production https://tender.heyarca.app for the PayPal AI Hackathon video.
Nothing is mocked: every click, PayPal window, top-up, agent reply, bidding round, and payout really happened (sandbox money only).

## Re-record one scene

```sh
cd video/capture
bun run.mjs s04_checkout      # or s01_open s02_markets s03_routing s05_s06 s07_bidding s08_payouts s09_agents
```

`run.mjs` records the scene in a fresh, temporary Chrome profile (so a fresh Tender account), then writes
`clips/<scene>.mp4`, popup clips, and `clips/<scene>.json`. `s05_s06` records one continuous take and splits it at the
`split_s05_s06` mark into `s05_ask` and `s06_vault`.

Side effects per run (all PayPal sandbox):
- `s04_checkout`: one $10 Checkout order.
- `s05_s06`: one Vault approval, one automatic $5 top-up, 3 paid requests.
- `s07_bidding`: one LLM bidding round (results apply to that browser only).
- `s08_payouts`: **one real PayPal Payouts batch.** "Settle now" needs a provider with at least $0.01 payable. Generate
  earnings first with `bun scenes/earn.mjs <take-with-credits> lithium-carbonate`. This creates an API key on that demo
  account and sends at most 600 paid requests at no more than 5/s. The key secret is never printed.

Rebuild clips from a saved take without re-recording: `bun lib/build.mjs <take> [<sceneId>[:tA:tB] ...]`
(tA/tB are seconds or mark names, for example `bun lib/build.mjs s05_s06 s05_ask:0:split_s05_s06 s06_vault:split_s05_s06:`).

## How it records

- `playwright-core` drives the installed Google Chrome (`channel: "chrome"`, new headless, no extensions, fresh
  `--user-data-dir` per take, `--force-device-scale-factor=2`).
- Viewport 1440x900 CSS at DPR 2. CDP `Page.startScreencast` (JPEG q92) runs on the page and on every PayPal popup. Frames
  keep their CDP timestamps (wall clock). Events are logged on the same clock.
- `lib/rec.mjs` rebuilds a constant 30 fps clip by timestamp. Each output frame is the latest screencast frame at that
  time. Encoding: H.264 High, yuv420p (limited range, BT.709 tags), CRF 14, no audio.
- No cursor is drawn (headless). Every pointer/keyboard action is in the JSON so the composer can draw it. Mouse paths
  are eased arcs of 500-900 ms. Typing runs at 35-75 ms per key. Scrolls are eased in-page scrolls, logged as `scroll`
  events with `dy` and `duration_ms`.

## Clip contract

- `clips/<scene>.mp4`: main page, 2880x1800, 30 fps CFR.
- `clips/<scene>-popup<N>.mp4`: PayPal window at its **real popup size** (`popups[].viewport` CSS, `popups[].px` pixels;
  Checkout 568x750 CSS, Vault 480x720 CSS). It uses the scene clock: video time t = scene time t. Frames before the
  popup paints are black (`t_first_frame`). The clip ends at `t_close`.
- `clips/<scene>.json`: `{scene, viewport, dpr, fps, duration_s, url, events, marks, popups, notes}`. Coordinates are CSS px
  of the surface named by `target` (`main` or `popup1`). Event types: `move`, `down`, `up`, `click`, `key`, `scroll`.
  Keys typed into PayPal credentials are logged as `•`. Marks carry `rect` for the regions the narration talks about.
  `wait_start:*` / `wait_end:*` bracket waits that can be cut or sped up. `pp_credentials_start/end` bracket the
  PayPal login typing. The sandbox buyer email is visible there: blur it or cut it.

`manifest.json` lists the scenes in order with durations, notes, and deviations from the shot list.
`work/` holds raw frames and sessions (safe to delete after the edit is locked; needed for `lib/build.mjs`).
