# Tender demo video — composition

Remotion 4 project (bun) that turns the capture clips, the narration and `direction.json` into the final video.
Nothing here is mocked: every frame of app footage comes from `../capture/clips`.

## Commands

```sh
bun install                                   # once
bun scripts/build-timeline.ts                 # rebuild src/timeline.json and print the timing table
bun scripts/render.ts --version 4             # full render at 2560x1440 -> ../out/tender-demo-v4.mp4 (+ QA stills in ../out/qa)
bun scripts/render.ts --version 4 --scale 1   # 1920x1080 instead
node scripts/stills.mjs qa-tmp 120 900 2400   # quick stills of single frames (1920x1080)
npx remotion studio src/index.ts              # interactive preview
```

`render.ts` runs the timeline build, renders H.264 (yuv420p, `--gl=angle`), applies two-pass `loudnorm`
(-14 LUFS integrated, true peak -1.5 dBTP, AAC 48 kHz 192 kbps, `+faststart`), prints the measured loudness, and writes
a still at the start and middle of every scene plus a contact sheet to `../out/qa/v<N>-*.png`.

## Inputs

| Path | Use |
| --- | --- |
| `../script.md` (`## Narration`) | caption text per scene |
| `../audio/vo/<scene>.mp3` + `.json` | narration and ElevenLabs character alignment (missing VO = silence at `wordsPerSecond`) |
| `../audio/music.mp3` | optional music bed, ducked under the narration |
| `../capture/clips/<scene>.{mp4,json}` | footage, pointer events, marks, popups (falls back to `placeholder/clips`) |
| `../brand` | PP Mori fonts and the wordmark |

`public/` only holds symlinks to these folders; the bundler forwards them instead of copying.

## Editing (`direction.json`)

`defaults` holds layout, pacing and camera constants. Each scene can set:

- `chapter`: label shown top-left while the camera is at full view.
- `in` / `out`: source range.
- `edits`: `{from, to, cut: true}` (dissolve cut), `{from, to, speed}` (max 2.5x, eased in and out), `{at, hold}` (freeze).
  `wait_start:*` / `wait_end:*` marks are ramped or cut automatically unless an explicit edit overlaps them.
- `sync`: `{phrase | sentence, at, lead, holdAt?, extendCut?}` pins a footage moment to the moment the narration
  reaches that phrase (+ `lead` s). Early footage waits (a freeze at `holdAt`, or with `extendCut` more of the last
  cut footage); late footage makes the narration wait.
- `camera`: shots `{at, rect | "full" | "popup:N", zoom?, arrive?, move?}`; `rect` is a CSS rect or `mark:NAME`.
  The camera eases between shots, never exceeds `maxZoom` (1.9), and stays on the app window.
- `redact`: `{from?, to?, rect, cloneDy?}` patches over third-party names: a flat fill in the page background colour,
  or with `cloneDy` a copy of the same frame that many CSS px lower (matches dimming and overlays).
- `cursorHide`: `[{from, to?}]` source ranges where the drawn cursor fades out.
- `startCamera: "keep"` continues the previous scene's shot; `voLead`, `tail`, `xfade` override pacing.

Time references: seconds, `start`, `end`, `mark:NAME[#N][+-s]`, `click:N`, `key:N`, `open:N`, `close:N`.

The timeline build prints, per scene, narration length, footage length, holds and narration delays. It fails if
the total exceeds 2:55.

## Render times (M1 Max, other jobs running)

- v1 1920x1080: 670 s. v2/v3 2560x1440: ~605 s, plus ~30 s for timeline, loudnorm and QA.
