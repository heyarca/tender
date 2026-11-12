/**
 * Generates demo video narration with ElevenLabs text to speech.
 *
 *   bun scripts/narrate.ts <narration.json> <out-dir> [scene-id ...]
 *
 * narration.json: { "voiceId", "modelId", "voiceSettings"?, "scenes": [{ "id", "text" }] }
 * Writes <id>.mp3 and <id>.json (character timings in the API's with-timestamps format) per scene.
 * Neighbouring scenes are passed as previous/next text so the voice stays consistent across files.
 * The SDK reads ELEVENLABS_API_KEY, which Bun loads from .env.local when run from the repo root.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type ElevenLabs, ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

interface Narration {
  voiceId: string;
  modelId: string;
  voiceSettings?: ElevenLabs.VoiceSettings;
  scenes: { id: string; text: string }[];
}

const [input, outDir, ...only] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("Usage: bun scripts/narrate.ts <narration.json> <out-dir> [scene-id ...]");
  process.exit(1);
}

const narration: Narration = JSON.parse(await readFile(input, "utf8"));
const client = new ElevenLabsClient();
await mkdir(outDir, { recursive: true });

for (const [index, scene] of narration.scenes.entries()) {
  if (only.length > 0 && !only.includes(scene.id)) continue;
  const result = await client.textToSpeech.convertWithTimestamps(narration.voiceId, {
    text: scene.text,
    modelId: narration.modelId,
    voiceSettings: narration.voiceSettings,
    previousText: narration.scenes[index - 1]?.text,
    nextText: narration.scenes[index + 1]?.text,
  });
  const alignment = result.alignment;
  if (!alignment) throw new Error(`${scene.id}: the response has no character timings`);
  await writeFile(join(outDir, `${scene.id}.mp3`), Buffer.from(result.audioBase64, "base64"));
  await writeFile(
    join(outDir, `${scene.id}.json`),
    JSON.stringify({
      characters: alignment.characters,
      character_start_times_seconds: alignment.characterStartTimesSeconds,
      character_end_times_seconds: alignment.characterEndTimesSeconds,
    }),
  );
  console.log(`${scene.id}: ${alignment.characterEndTimesSeconds.at(-1)?.toFixed(2)} s`);
}
