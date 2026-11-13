#!/usr/bin/env bun
/**
 * One-command render: timeline -> Remotion render -> two-pass loudnorm (-14 LUFS, true peak <= -1 dBTP) -> QA stills + contact sheet.
 * Usage: bun scripts/render.ts [--version N] [--scale 1] [--concurrency 6] [--placeholders] [--skip-qa]
 * Output: ../out/tender-demo-v<N>.mp4 and ../out/qa/v<N>-*.png
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Timeline } from "../src/types";

const COMP = resolve(import.meta.dir, "..");
const ROOT = resolve(COMP, "..");
const OUT = join(ROOT, "out");
const QA = join(OUT, "qa");
mkdirSync(QA, { recursive: true });

const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const existing = readdirSync(OUT)
  .map((f) => f.match(/^tender-demo-v(\d+)\.mp4$/)?.[1])
  .filter(Boolean)
  .map(Number);
const version = Number(opt("version", String(existing.length ? Math.max(...existing) + 1 : 1)));
// 4/3 to full double precision, so 1920x1080 scales to exactly 2560x1440.
const scale = opt("scale", "1.3333333333333333");
const concurrency = opt("concurrency", "6");
const final = join(OUT, `tender-demo-v${version}.mp4`);
const raw = join(COMP, `.render-v${version}.mp4`);

function run(cmd: string[], opts: { quiet?: boolean } = {}): string {
  const started = performance.now();
  if (!opts.quiet) console.log(`$ ${cmd.join(" ")}`);
  const p = Bun.spawnSync(cmd, { cwd: COMP, stdout: "pipe", stderr: "pipe" });
  const out = p.stdout.toString() + p.stderr.toString();
  if (p.exitCode !== 0) {
    console.error(out.slice(-4000));
    throw new Error(`failed (${p.exitCode}): ${cmd[0]}`);
  }
  if (!opts.quiet) console.log(`  done in ${((performance.now() - started) / 1000).toFixed(1)}s`);
  return out;
}

const t0 = performance.now();
console.log(run(["bun", "scripts/build-timeline.ts", ...(args.includes("--placeholders") ? ["--placeholders"] : [])]));
const tl: Timeline = JSON.parse(readFileSync(join(COMP, "src/timeline.json"), "utf8"));

const tRender = performance.now();
run([
  "npx", "remotion", "render", "src/index.ts", "TenderDemo", raw,
  "--codec=h264", "--crf=14", "--x264-preset=medium", "--pixel-format=yuv420p",
  "--image-format=jpeg", "--jpeg-quality=95",
  "--audio-codec=aac", "--audio-bitrate=320k",
  `--scale=${scale}`, `--concurrency=${concurrency}`, "--gl=angle",
  "--log=error",
]);
const renderSecs = (performance.now() - tRender) / 1000;

// two-pass loudness normalisation; the video stream is copied untouched
const hasAudio = tl.vo.length > 0 || tl.music !== null;
if (hasAudio) {
  const target = "I=-14:TP=-1.5:LRA=11";
  const m = run(["ffmpeg", "-hide_banner", "-nostats", "-i", raw, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { quiet: true });
  const j = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
  const second = `loudnorm=${target}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true:print_format=summary`;
  run(["ffmpeg", "-y", "-hide_banner", "-i", raw, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy", "-af", `${second},aresample=48000`, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);
} else {
  run(["ffmpeg", "-y", "-hide_banner", "-i", raw, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v:0", "-map", "1:a:0", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);
}
rmSync(raw);

// verify loudness and stream format of the master
const meter = run(["ffmpeg", "-hide_banner", "-nostats", "-i", final, "-af", "ebur128=peak=true", "-f", "null", "-"], { quiet: true });
const summary = meter.slice(meter.lastIndexOf("Summary:"));
const probe = run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,sample_rate,bit_rate:format=duration", "-of", "compact", final], { quiet: true });
console.log(probe.trim());
console.log(summary.replace(/\n\s*\n/g, "\n").trim());

// QA: a still at the start (after the dissolve) and middle of every scene, plus a contact sheet
if (!args.includes("--skip-qa")) {
  for (const f of readdirSync(QA)) if (f.startsWith(`v${version}-`)) rmSync(join(QA, f));
  const points: { name: string; t: number }[] = [{ name: "00_title", t: 1.2 }];
  for (const s of tl.scenes) {
    points.push({ name: `${s.id}_a`, t: (s.from + s.xfadeIn + 6) / tl.fps });
    points.push({ name: `${s.id}_b`, t: (s.from + s.dur / 2) / tl.fps });
  }
  for (const p of points) {
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", p.t.toFixed(3), "-i", final, "-frames:v", "1", join(QA, `v${version}-${p.name}.png`)], { quiet: true });
  }
  const cols = 3;
  const list = points.map((p) => join(QA, `v${version}-${p.name}.png`));
  const rows = Math.ceil(list.length / cols);
  run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    ...list.flatMap((f) => ["-i", f]),
    "-filter_complex",
    list.map((_, i) => `[${i}:v]scale=640:-1[s${i}]`).join(";") + ";" + list.map((_, i) => `[s${i}]`).join("") + `xstack=inputs=${list.length}:layout=${list.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join("|")}:fill=white`,
    join(QA, `v${version}-contact.png`),
  ], { quiet: true });
  console.log(`QA stills: ${QA}/v${version}-*.png (${points.length} + contact sheet, ${rows} rows)`);
}
console.log(`\n${final}\nrender ${renderSecs.toFixed(0)}s, total ${((performance.now() - t0) / 1000).toFixed(0)}s, duration ${(tl.durationInFrames / tl.fps).toFixed(2)}s`);
