# Demo video

Sources for the Tender product walkthrough submitted to the PayPal AI Hackathon
(https://youtu.be/D6IUpO29g2o, 2:38). `public/demo.mp4` is a 1080p web encode of the same cut.

The footage is real production behavior recorded on https://tender.heyarca.app with PayPal sandbox
accounts. The edit, cursor, zooms, and captions are added afterwards; nothing in the app is mocked.

| Path | What it is |
| --- | --- |
| `script.md` | Narration per scene, shot list, and the hackathon video rules this cut follows |
| `audio/narration.json` | ElevenLabs voice settings and the narration text per scene (same text as `script.md`) |
| `audio/vo/` | Generated narration (`<scene>.mp3`) and character timings (`<scene>.json`) used by the v3 render |
| `capture/` | Playwright scripts that record each scene in a fresh Chrome profile (see `capture/README.md`) |
| `comp/` | Remotion project that edits the clips into the video (see `comp/README.md`) |
| `brand/` | Links to the PP Mori fonts and the wordmark that the edit uses |

## Rebuild the video

1. **Narration** (repo root, `ELEVENLABS_API_KEY` in `.env.local`). Keep `audio/narration.json` in sync
   with the narration in `script.md`, then regenerate all scenes or only the ones you name:

   ```sh
   bun scripts/narrate.ts video/audio/narration.json video/audio/vo [scene-id ...]
   ```

2. **Footage** (Google Chrome installed; PayPal sandbox buyer in
   `~/.cache/tender-agent/paypal-sandbox-accounts.json`, or set `PAYPAL_SANDBOX_ACCOUNTS` to another path):

   ```sh
   cd video/capture && bun install && bun run.mjs s04_checkout   # one scene; see capture/README.md
   ```

   Clips land in `capture/clips/` (not committed). Each run moves sandbox money; the README lists the side
   effects per scene.

3. **Edit and render**:

   ```sh
   cd video/comp && bun install && bun scripts/render.ts --version 4   # -> video/out/tender-demo-v4.mp4
   ```

   Edit decisions (cuts, speed ramps, camera, caption timing, redactions) live in `comp/direction.json`.
   The render normalizes loudness to -14 LUFS and writes QA stills to `video/out/qa/`.

4. **Web copy for `/demo`**:

   ```sh
   ffmpeg -i video/out/tender-demo-v4.mp4 -vf scale=1920:1080:flags=lanczos -c:v libx264 -preset slow \
     -crf 23 -maxrate 2200k -bufsize 4400k -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart public/demo.mp4
   ```

   Then bump the `?v=` value on the video and poster in `src/app/demo/page.tsx`.

## Rules the cut follows

Under 3 minutes, English, a working desktop browser demo, PayPal sandbox only. No third-party logos or names
other than PayPal and AG Grid: `comp/direction.json` patches out the "Pay with USDC" option and the bidding
model name, and cuts the PayPal login step that shows the sandbox buyer email. No music.
