#!/usr/bin/env bun
/**
 * Builds src/timeline.json, the whole edit as data, from:
 *   ../script.md                      narration text per scene
 *   ../capture/clips/<scene>.{mp4,json} capture (falls back to placeholder/clips/<scene>.*)
 *   ../audio/vo/<scene>.{mp3,json}    narration + ElevenLabs character alignment (falls back to estimated silence)
 *   ../audio/music.mp3                optional music bed
 *   direction.json                    per-scene edit decisions (chapters, edits, camera, sync)
 * Usage: bun scripts/build-timeline.ts [--placeholders]
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PopupT, Rect, SceneT, Segment, Timeline } from "../src/types";

const COMP = resolve(import.meta.dir, "..");
const ROOT = resolve(COMP, "..");
const PUBLIC = join(COMP, "public");
const FPS = 30;
const W = 1920;
const H = 1080;
const FORCE_PLACEHOLDERS = process.argv.includes("--placeholders");

const dir = JSON.parse(readFileSync(join(COMP, "direction.json"), "utf8"));
const D = dir.defaults;

// ---------------------------------------------------------------- public/ links (forwarded, not copied, by the bundler)
mkdirSync(PUBLIC, { recursive: true });
const links: Record<string, string> = {
  brand: join(ROOT, "brand"),
  audio: join(ROOT, "audio"),
  real: join(ROOT, "capture/clips"),
  ph: join(COMP, "placeholder/clips"),
};
for (const [name, target] of Object.entries(links)) {
  const p = join(PUBLIC, name);
  let exists = false;
  try {
    lstatSync(p);
    exists = true;
  } catch {}
  if (!exists) symlinkSync(target, p);
}

// ---------------------------------------------------------------- layout (stage coordinates = 1920x1080 at zoom 1)
const cssScale = (W * D.windowWidth) / 1440;
const topBar = 30;
const winW = 1440 * cssScale;
const winH = 900 * cssScale + topBar;
const window: Rect = { x: (W - winW) / 2, y: (H - winH) / 2, w: winW, h: winH };
const content: Rect = { x: window.x, y: window.y + topBar, w: winW, h: 900 * cssScale };

// ---------------------------------------------------------------- helpers
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = sx(t) - x;
      if (Math.abs(d) < 1e-6) break;
      const dd = dsx(t);
      if (Math.abs(dd) < 1e-6) break;
      t -= d / dd;
    }
    return sy(clamp(t, 0, 1));
  };
}
const easeCam = bezier(0.6, 0, 0.3, 1);
const easeCursor = bezier(0.45, 0, 0.25, 1);

function probeDuration(file: string): number {
  const r = Bun.spawnSync(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const v = parseFloat(r.stdout.toString().trim());
  if (!Number.isFinite(v)) throw new Error(`ffprobe failed for ${file}`);
  return v;
}

// ---------------------------------------------------------------- narration
function parseNarration(md: string): Record<string, string> {
  const section = md.split("## Narration")[1].split("\n## ")[0];
  const out: Record<string, string> = {};
  let cur: string | null = null;
  for (const line of section.split("\n")) {
    const m = line.match(/^- (s\d\d_[a-z0-9_]+):\s*(.*)$/);
    if (m) {
      cur = m[1];
      out[cur] = m[2].trim();
    } else if (cur && /^\s+\S/.test(line)) out[cur] += " " + line.trim();
    else cur = null;
  }
  return out;
}
const narration = parseNarration(readFileSync(join(ROOT, "script.md"), "utf8"));

type Word = { text: string; start: number; end: number };

function wordsFromAlignment(json: any): Word[] {
  const al = json.alignment ?? json.normalized_alignment ?? json;
  const chars: string[] = al.characters;
  const st: number[] = al.character_start_times_seconds;
  const en: number[] = al.character_end_times_seconds;
  const words: Word[] = [];
  let cur: Word | null = null;
  chars.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { text: c, start: st[i], end: en[i] };
    else {
      cur.text += c;
      cur.end = en[i];
    }
  });
  if (cur) words.push(cur);
  return words;
}

/** Placeholder timing: D.wordsPerSecond overall, with short pauses at punctuation. */
function estimateWords(text: string): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const weights = tokens.map((t) => 1 + (/[.?!]$/.test(t) ? 0.8 : /[,:;]$/.test(t) ? 0.35 : 0));
  const total = tokens.length / D.wordsPerSecond;
  const unit = total / weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return tokens.map((tok, i) => {
    const w = { text: tok, start: t, end: t + unit };
    t += unit * weights[i];
    return w;
  });
}

type Unit = { words: Word[]; start: number; end: number; sync?: any };

const normWord = (s: string) => s.toLowerCase().replace(/[^a-z0-9$]+/g, "");

/**
 * Split narration into units that can be placed independently: every sentence, plus the word where a sync entry's
 * `phrase` starts. Sync entries address a unit by `sentence` (1-based) or `phrase` (text the unit starts with).
 */
function narrationUnits(words: Word[], syncs: any[], scene: string): Unit[] {
  const starts = new Map<number, any>([[0, undefined]]);
  const sentenceStarts = [0];
  words.forEach((w, i) => {
    if (/[.?!]["”]?$/.test(w.text) && i + 1 < words.length) {
      sentenceStarts.push(i + 1);
      if (!starts.has(i + 1)) starts.set(i + 1, undefined);
    }
  });
  for (const s of syncs) {
    let wi = -1;
    if (s.sentence) wi = sentenceStarts[s.sentence - 1] ?? -1;
    else {
      const p = String(s.phrase).split(/\s+/).map(normWord);
      wi = words.findIndex((_, i) => p.every((x, k) => normWord(words[i + k]?.text ?? "") === x));
    }
    if (wi < 0) throw new Error(`sync ${JSON.stringify(s)} not found in ${scene} narration`);
    starts.set(wi, s);
  }
  const idx = [...starts.keys()].sort((a, b) => a - b);
  return idx.map((b, i) => {
    const ws = words.slice(b, idx[i + 1] ?? words.length);
    return { words: ws, start: ws[0].start, end: ws[ws.length - 1].end, sync: starts.get(b) };
  });
}

/** Split a sentence into caption chunks of at most D.captionMaxChars, preferring commas near the middle. */
function chunkWords(words: Word[]): Word[][] {
  const len = (ws: Word[]) => ws.map((w) => w.text).join(" ").length;
  if (len(words) <= D.captionMaxChars || words.length < 4) return [words];
  const total = len(words);
  let best = -1;
  let bestScore = Infinity;
  let acc = 0;
  for (let i = 0; i < words.length - 1; i++) {
    acc += words[i].text.length + 1;
    const balance = Math.abs(acc - total / 2) / total;
    const score = balance - (/[,;:]$/.test(words[i].text) ? 0.25 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return [...chunkWords(words.slice(0, best + 1)), ...chunkWords(words.slice(best + 1))];
}

// ---------------------------------------------------------------- capture clips
type Ev = { t: number; type: string; x?: number; y?: number; key?: string; popup?: number; target?: string; page?: string };
type Mark = { t: number; name: string; rect?: Rect; target?: string };
type Clip = {
  scene: string;
  duration_s: number;
  events: Ev[];
  marks: Mark[];
  popups: { file: string; label?: string; t_open: number; t_first_frame?: number; t_close: number; viewport: { w: number; h: number }; url?: string }[];
  viewport: { w: number; h: number };
  placeholder?: boolean;
};

function loadClip(scene: string): { clip: Clip; src: string; base: string; placeholder: boolean } | null {
  const real = join(ROOT, "capture/clips", scene);
  if (!FORCE_PLACEHOLDERS && existsSync(real + ".mp4") && existsSync(real + ".json")) {
    return { clip: JSON.parse(readFileSync(real + ".json", "utf8")), src: `real/${scene}.mp4`, base: "real", placeholder: false };
  }
  const ph = join(COMP, "placeholder/clips", scene);
  if (existsSync(ph + ".mp4") && existsSync(ph + ".json")) {
    return { clip: JSON.parse(readFileSync(ph + ".json", "utf8")), src: `ph/${scene}.mp4`, base: "ph", placeholder: true };
  }
  return null;
}

/** Target surface of an event or mark: 0 = main page, N = the scene's popup N (matched by the recorder's label). */
function targetIndex(o: { target?: string; popup?: number; page?: string }, clip: Clip): number {
  if (typeof o.popup === "number") return o.popup;
  const s = o.target ?? o.page;
  if (!s || s === "main") return 0;
  const byLabel = clip.popups.findIndex((p) => p.label === s);
  if (byLabel >= 0) return byLabel + 1;
  const m = s.match(/popup\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Source-time reference: number | "start" | "end" | "mark:NAME[#N][+-s]" | "click:N[+-s]" | "open:N" | "close:N". */
function refTime(ref: any, clip: Clip): number {
  if (typeof ref === "number") return ref;
  const s = String(ref).trim();
  if (s === "start") return 0;
  if (s === "end") return clip.duration_s;
  const m = s.match(/^(mark|click|open|close|key):([^#]+?)(?:#(\d+))?\s*([+-]\s*[\d.]+)?$/);
  if (!m) throw new Error(`bad time ref ${s} in ${clip.scene}`);
  const [, kind, name, nth, off] = m;
  const k = nth ? parseInt(nth, 10) : 1;
  const offset = off ? parseFloat(off.replace(/\s+/g, "")) : 0;
  let t: number | undefined;
  if (kind === "mark") t = clip.marks.filter((x) => x.name === name)[k - 1]?.t;
  if (kind === "click") t = clip.events.filter((e) => e.type === "click" || e.type === "down").filter((e, i, a) => e.type === "click" || !a.some((c) => c.type === "click" && Math.abs(c.t - e.t) < 0.3))[parseInt(name, 10) - 1]?.t;
  if (kind === "key") t = clip.events.filter((e) => e.type === "key")[parseInt(name, 10) - 1]?.t;
  if (kind === "open") t = clip.popups[parseInt(name, 10) - 1]?.t_open;
  if (kind === "close") t = clip.popups[parseInt(name, 10) - 1]?.t_close;
  if (t === undefined) throw new Error(`time ref ${s} not found in ${clip.scene}`);
  return t + offset;
}

/** Stage rect of a mark's rect ("mark:NAME[#N]"), on the main page or inside its popup window. */
function markStageRect(name: string, clip: Clip, popupRect: (n: number) => Rect | undefined): Rect {
  const m = name.match(/^mark:([^#]+?)(?:#(\d+))?$/);
  const mark = m ? clip.marks.filter((x) => x.name === m[1] && x.rect)[(m[2] ? parseInt(m[2], 10) : 1) - 1] : undefined;
  if (!mark?.rect) throw new Error(`rect ${name} not found in ${clip.scene}`);
  const target = targetIndex(mark, clip);
  const pr = target ? popupRect(target) : undefined;
  const o = pr ? { x: pr.x, y: pr.y + topBar } : { x: content.x, y: content.y };
  const r = mark.rect;
  return { x: o.x + r.x * cssScale, y: o.y + r.y * cssScale, w: r.w * cssScale, h: r.h * cssScale };
}

const cssToStage = (r: Rect): Rect => ({ x: content.x + r.x * cssScale, y: content.y + r.y * cssScale, w: r.w * cssScale, h: r.h * cssScale });

// ---------------------------------------------------------------- edit: source ranges -> segments
type RawSeg = { s0: number; s1: number; speed: number; hold?: number; cutIn?: boolean };

type Hold = { at: number; dur: number; extend?: boolean };

/** Source ranges -> raw segments. `holds` come from narration sync: they freeze, or with `extend` give back footage from the last cut before them. */
function buildRawSegments(clip: Clip, sd: any, holds: Hold[] = []): RawSeg[] {
  const tin = refTime(sd.in ?? 0, clip);
  const tout = Math.min(refTime(sd.out ?? "end", clip), clip.duration_s);
  type Op = { from: number; to: number; kind: "cut" | "speed" | "hold"; speed?: number; hold?: number };
  const ops: Op[] = [];
  for (const e of sd.edits ?? []) {
    if (e.hold !== undefined) {
      const at = refTime(e.at, clip);
      ops.push({ from: at, to: at, kind: "hold", hold: e.hold });
    } else ops.push({ from: refTime(e.from, clip), to: refTime(e.to, clip), kind: e.cut ? "cut" : "speed", speed: e.speed });
  }
  if (sd.autoWaits !== false) {
    const label = (m: Mark) => m.name.split(":").slice(1).join(":");
    const starts = clip.marks.filter((m) => /^wait_start(:|$)/.test(m.name)).sort((a, b) => a.t - b.t);
    const ends = clip.marks.filter((m) => /^wait_end(:|$)/.test(m.name)).sort((a, b) => a.t - b.t);
    for (const s of starts) {
      const a = s.t;
      const b = ends.find((x) => x.t > a && label(x) === label(s))?.t;
      if (b === undefined) continue;
      if (ops.some((o) => o.kind !== "hold" && o.from < b && o.to > a)) continue;
      const d = b - a;
      if (d <= D.waitKeep) continue;
      if (d <= D.waitRampMax) ops.push({ from: a, to: b, kind: "speed", speed: D.maxSpeed });
      else ops.push({ from: a + D.waitCutKeepBefore, to: b - D.waitCutKeepAfter, kind: "cut" });
    }
  }
  for (const h of holds) {
    if (h.extend) {
      const cut = ops.filter((o) => o.kind === "cut" && o.to <= h.at + 1e-6).sort((a, b) => b.to - a.to)[0];
      if (cut) {
        const take = Math.min(h.dur, cut.to - cut.from);
        cut.from += take;
        if (take < h.dur) ops.push({ from: h.at, to: h.at, kind: "hold", hold: h.dur - take });
        continue;
      }
    }
    ops.push({ from: h.at, to: h.at, kind: "hold", hold: h.dur });
  }
  ops.sort((a, b) => a.from - b.from || (a.kind === "hold" ? -1 : 1));
  const segs: RawSeg[] = [];
  let t = tin;
  let cutIn = false;
  for (const op of ops) {
    if (op.to <= tin || op.from >= tout) continue;
    const from = Math.max(op.from, t);
    const to = Math.min(op.to, tout);
    if (op.kind === "hold") {
      if (from > t) segs.push({ s0: t, s1: from, speed: 1, cutIn });
      segs.push({ s0: from, s1: from, speed: 0, hold: op.hold });
      cutIn = false;
      t = from;
      continue;
    }
    if (to <= t) continue;
    if (from > t) {
      segs.push({ s0: t, s1: from, speed: 1, cutIn });
      cutIn = false;
    }
    if (op.kind === "cut") {
      cutIn = to - from > 1 / FPS;
    } else {
      const v = Math.min(op.speed ?? D.maxSpeed, D.maxSpeed);
      const len = to - from;
      const ramp = D.rampStep;
      if (len >= ramp * 4 + 0.5 && v > 1.2) {
        const r1 = 1 + (v - 1) / 3;
        const r2 = 1 + (2 * (v - 1)) / 3;
        segs.push({ s0: from, s1: from + ramp, speed: r1, cutIn });
        segs.push({ s0: from + ramp, s1: from + 2 * ramp, speed: r2 });
        segs.push({ s0: from + 2 * ramp, s1: to - 2 * ramp, speed: v });
        segs.push({ s0: to - 2 * ramp, s1: to - ramp, speed: r2 });
        segs.push({ s0: to - ramp, s1: to, speed: r1 });
      } else segs.push({ s0: from, s1: to, speed: v, cutIn });
      cutIn = false;
    }
    t = to;
  }
  if (tout > t) segs.push({ s0: t, s1: tout, speed: 1, cutIn });
  return segs;
}

type Seg = Segment & { s0: number };

function layoutSegments(raw: RawSeg[]): Seg[] {
  const out: Seg[] = [];
  let f = 0;
  for (const r of raw) {
    const dur = r.speed === 0 ? Math.round((r.hold ?? 0) * FPS) : Math.round(((r.s1 - r.s0) / r.speed) * FPS);
    if (dur <= 0) continue;
    const fadeIn = r.cutIn && out.length ? D.cutDissolveFrames : 0;
    const from = f - fadeIn;
    out.push({ from, dur, srcFrame: Math.round(r.s0 * FPS), rate: r.speed, fadeIn, s0: r.s0 });
    f = from + dur;
  }
  return out;
}

/** Per output frame: source time, choosing the incoming segment from the middle of each dissolve. */
function sourceTimes(segs: Seg[], dur: number): number[] {
  const ts: number[] = [];
  for (let f = 0; f < dur; f++) {
    let seg = segs[0];
    for (const s of segs) if (f >= s.from + Math.floor(s.fadeIn / 2)) seg = s;
    ts.push(seg.s0 + ((Math.min(f, seg.from + seg.dur - 1) - seg.from) / FPS) * seg.rate);
  }
  return ts;
}

/** First output frame showing source time t (null when t was cut). */
function outFrameOf(t: number, segs: Seg[]): number | null {
  for (const s of segs) {
    if (s.rate === 0) continue;
    const s1 = s.s0 + (s.dur / FPS) * s.rate;
    if (t >= s.s0 - 1e-6 && t < s1 + 1e-6) return s.from + Math.round(((t - s.s0) / s.rate) * FPS);
  }
  return null;
}
/** Like outFrameOf, but a cut time snaps to the next shown frame. */
function outFrameNear(t: number, segs: Seg[]): number {
  const f = outFrameOf(t, segs);
  if (f !== null) return f;
  for (const s of segs) if (s.s0 >= t) return s.from;
  const last = segs[segs.length - 1];
  return last.from + last.dur - 1;
}

// ---------------------------------------------------------------- camera
type Cam = { z: number; x: number; y: number };
const FULL: Cam = { z: 1, x: W / 2, y: H / 2 };

/**
 * Keep the view on the app. Zoomed in past the content size, the view stays inside the content. Below that,
 * the view keeps the whole content in sight and stays inside the frame, so zoom 1 is always centered.
 * Both ranges meet at the content center, so camera moves stay continuous.
 */
function clampAxis(c: number, half: number, lo: number, hi: number, frame: number): number {
  return half * 2 <= hi - lo ? clamp(c, lo + half, hi - half) : clamp(c, Math.max(half, hi - half), Math.min(frame - half, lo + half));
}
function clampCam(c: Cam): Cam {
  const z = clamp(c.z, 1, D.maxZoom);
  // Zoomed in, the view may show a strip below the window so UI at the bottom edge can sit above the captions.
  const below = (D.captionZone / z) * clamp((z - H / content.h) / 0.3, 0, 1);
  return {
    z,
    x: clampAxis(c.x, W / 2 / z, content.x, content.x + content.w, W),
    y: clampAxis(c.y, H / 2 / z, content.y, content.y + content.h + below, H),
  };
}

function fitCam(r: Rect, zoom?: number): Cam {
  const z = zoom ?? Math.min((W * D.fitWidth) / r.w, (H * D.fitHeight) / r.h);
  if (z < 1.05) return FULL;
  // Bias the target slightly upward so captions never cover it.
  return clampCam({ z, x: r.x + r.w / 2, y: r.y + r.h / 2 + (H * 0.035) / Math.max(1, z) });
}

type Shot = { f: number; move: number; cam: Cam };

// ---------------------------------------------------------------- scenes
const order: string[] = dir.order;
const scenes: SceneT[] = [];
const captions: Timeline["captions"] = [];
const chapters: Timeline["chapters"] = [];
const vo: Timeline["vo"] = [];
const shots: Shot[] = [];
const report: string[] = [];

const titleDur = Math.round(dir.title.dur * FPS);
const titleOut = Math.round(dir.title.dissolve * FPS);
let cursorFrame = titleDur - titleOut;

for (const id of order) {
  const sd = dir.scenes[id] ?? {};
  const text = narration[id];
  if (!text) throw new Error(`no narration for ${id}`);

  // narration words: real alignment if present, else estimated
  const voMp3 = join(ROOT, "audio/vo", `${id}.mp3`);
  const voJson = join(ROOT, "audio/vo", `${id}.json`);
  const hasVo = existsSync(voMp3);
  let words: Word[];
  let voDur: number;
  if (hasVo) {
    voDur = probeDuration(voMp3);
    if (existsSync(voJson)) {
      const spoken = wordsFromAlignment(JSON.parse(readFileSync(voJson, "utf8")));
      const scriptTokens = text.split(/\s+/).filter(Boolean);
      words = spoken.length === scriptTokens.length ? spoken.map((w, i) => ({ ...w, text: scriptTokens[i] })) : spoken;
    } else {
      words = estimateWords(text);
      const k = voDur / (words[words.length - 1].end + 0.05);
      words = words.map((w) => ({ ...w, start: w.start * k, end: w.end * k }));
    }
  } else {
    words = estimateWords(text);
    voDur = words[words.length - 1].end + 0.15;
  }
  const units = narrationUnits(words, sd.sync ?? [], id);

  const isEnd = sd.kind === "end";
  const loaded = isEnd ? null : loadClip(id);
  const xfadeIn = Math.round((scenes.length === 0 ? dir.title.dissolve : (sd.xfade ?? D.sceneXfade)) * FPS);
  const from = scenes.length === 0 ? cursorFrame : cursorFrame - xfadeIn;
  const voLead = sd.voLead ?? D.voLead;

  // narration placement: units play back to back from voLead; `delays[i]` adds silence before unit i
  const delays = new Map<number, number>();
  const place = () => {
    const starts: number[] = [];
    let nextFree = Math.round(voLead * FPS);
    units.forEach((s, i) => {
      const natural = i === 0 ? nextFree : nextFree + Math.round((s.start - units[i - 1].end) * FPS);
      starts.push(natural + (delays.get(i) ?? 0));
      nextFree = starts[i] + Math.round((s.end - s.start) * FPS);
    });
    return { starts, end: nextFree };
  };

  // footage; each sync entry pins a footage moment to the start of its narration unit (+ lead).
  // Footage that arrives early waits (a hold), narration that would start early waits (a delay).
  let segs: Seg[] = [];
  let clip: Clip | null = null;
  const holds: Hold[] = [];
  const holdLog: string[] = [];
  if (loaded) {
    clip = loaded.clip;
    units.forEach((u, i) => {
      if (!u.sync) return;
      const at = refTime(u.sync.at, clip!);
      const cur = layoutSegments(buildRawSegments(clip!, sd, holds));
      const want = place().starts[i] + Math.round((u.sync.lead ?? 0) * FPS);
      const have = outFrameNear(at, cur);
      if (want > have + 1) {
        const holdAt = u.sync.holdAt !== undefined ? refTime(u.sync.holdAt, clip!) : at - 0.15;
        holds.push({ at: holdAt, dur: (want - have) / FPS, extend: u.sync.extendCut });
        holdLog.push(`hold ${((want - have) / FPS).toFixed(1)}s@${holdAt.toFixed(1)}${u.sync.extendCut ? "(footage)" : ""}`);
      } else if (have > want + 1) {
        delays.set(i, have - want);
        holdLog.push(`vo+${((have - want) / FPS).toFixed(1)}s`);
      }
    });
    segs = layoutSegments(buildRawSegments(clip, sd, holds));
  }
  const footageDur = segs.length ? segs[segs.length - 1].from + segs[segs.length - 1].dur : 0;
  const placed = place();
  const chunks = units.map((s, i) => ({ s, startF: placed.starts[i], delayed: (delays.get(i) ?? 0) > 0 }));
  const nextFree = placed.end;
  const voEndF = nextFree;
  const minDur = Math.round((sd.minDur ?? 0) * FPS);
  let dur = Math.max(footageDur, voEndF + Math.round((sd.tail ?? D.tail) * FPS), minDur);
  if (isEnd) dur = Math.max(dur, Math.round(dir.endCard.minDur * FPS));

  // extend the footage with a freeze on its last frame
  if (segs.length && dur > footageDur) {
    const last = segs[segs.length - 1];
    const tEnd = last.s0 + ((last.dur - 1) / FPS) * last.rate;
    segs.push({ from: footageDur, dur: dur - footageDur, srcFrame: Math.round(tEnd * FPS), rate: 0, fadeIn: 0, s0: tEnd });
  }

  // audio + captions; consecutive units without a sync delay stay one continuous audio chunk
  const voSrc = `audio/vo/${id}.mp3`;
  const cutBefore = (i: number) => (i === 0 ? 0 : (units[i - 1].end + units[i].start) / 2);
  const cutAfter = (i: number) => (i === units.length - 1 ? voDur : (units[i].end + units[i + 1].start) / 2);
  let runStart = 0;
  chunks.forEach(({ s, startF }, i) => {
    const last = i === chunks.length - 1 || chunks[i + 1].delayed;
    if (hasVo && last) {
      const a = cutBefore(runStart);
      const b = cutAfter(i);
      const offsetF = chunks[runStart].startF - Math.round((units[runStart].start - a) * FPS);
      vo.push({ src: voSrc, from: from + offsetF, trimBefore: Math.round(a * FPS), dur: Math.max(1, Math.round((b - a) * FPS)) });
      runStart = i + 1;
    }
    for (const cw of chunkWords(s.words)) {
      const cf = from + startF + Math.round((cw[0].start - s.start) * FPS);
      const ct = from + startF + Math.round((cw[cw.length - 1].end - s.start + D.captionHold) * FPS);
      captions.push({ text: cw.map((w) => w.text).join(" "), from: cf, to: ct });
    }
  });

  // popups
  const popups: PopupT[] = [];
  const srcT = segs.length ? sourceTimes(segs, dur) : [];
  if (clip && loaded) {
    clip.popups.forEach((p, i) => {
      const w = p.viewport.w * cssScale;
      const h = p.viewport.h * cssScale + topBar;
      const rect: Rect = { x: content.x + content.w / 2 - w / 2 + (sd.popupOffsetX ?? 0), y: content.y + content.h / 2 - h / 2, w, h };
      let open = -1;
      let close = -1;
      const shown = Math.max(p.t_open, p.t_first_frame ?? p.t_open);
      srcT.forEach((t, f) => {
        if (t >= shown && t < p.t_close) {
          if (open < 0) open = f;
          close = f + 1;
        }
      });
      const host = p.url ? new URL(p.url).host : (sd.popupHost ?? D.popupHost);
      if (open >= 0) popups.push({ src: `${loaded.base}/${p.file}`, open, close, rect, host });
    });
  }
  const popupRect = (n: number) => popups[n - 1]?.rect;

  // cursor (per output frame) and click rings
  let cursor: SceneT["cursor"] = null;
  const clicks: SceneT["clicks"] = [];
  if (clip && sd.cursor !== false) {
    const toStage = (e: Ev) => {
      const target = targetIndex(e, clip!);
      const pr = target ? popupRect(target) : undefined;
      if (target && pr) return { x: pr.x + e.x! * cssScale, y: pr.y + topBar + e.y! * cssScale };
      return { x: content.x + e.x! * cssScale, y: content.y + e.y! * cssScale };
    };
    const pts = clip.events.filter((e) => typeof e.x === "number" && typeof e.y === "number").sort((a, b) => a.t - b.t).map((e) => ({ t: e.t, ...toStage(e) }));
    const keys = clip.events.filter((e) => e.type === "key").map((e) => e.t);
    const moves = clip.events.filter((e) => e.type === "move" || e.type === "wheel" || e.type === "scroll").map((e) => e.t);
    const downs = clip.events.filter((e) => e.type === "down").map((e) => e.t);
    const ups = clip.events.filter((e) => e.type === "up").map((e) => e.t);
    const clickTs = clip.events.filter((e) => e.type === "click").map((e) => e.t);
    if (pts.length) {
      const pos = (t: number) => {
        if (t <= pts[0].t) return pts[0];
        const last = pts[pts.length - 1];
        if (t >= last.t) return last;
        let i = 0;
        while (pts[i + 1].t < t) i++;
        const a = pts[i];
        const b = pts[i + 1];
        const dt = b.t - a.t;
        if (dt <= 0.12) return { x: lerp(a.x, b.x, (t - a.t) / dt), y: lerp(a.y, b.y, (t - a.t) / dt) };
        const win = Math.min(dt, 0.6);
        const u = (t - (b.t - win)) / win;
        if (u <= 0) return a;
        const e = easeCursor(u);
        return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) };
      };
      const hideRanges = (sd.cursorHide ?? []).map((r: any) => ({ from: refTime(r.from, clip!), to: refTime(r.to ?? "end", clip!) }));
      const hidden = (t: number) => {
        // ranges from direction.json, e.g. while a popup loads or over text the camera holds on
        const ranged = Math.max(0, ...hideRanges.map((r: { from: number; to: number }) => Math.min(clamp((t - r.from) / 0.15, 0, 1), clamp((r.to - t) / 0.15, 0, 1))));
        // macOS hides the pointer while typing until it moves again
        const k = keys.filter((x) => x <= t).pop();
        if (k === undefined) return ranged;
        const m = moves.find((x) => x > k);
        if (m !== undefined && m <= t) return Math.max(ranged, clamp(1 - (t - m) / 0.15, 0, 1));
        return Math.max(ranged, clamp((t - k - 0.1) / 0.15, 0, 1));
      };
      const press = (t: number) => {
        for (const d of downs) {
          const u = ups.find((x) => x >= d) ?? d + 0.1;
          if (t >= d - 0.05 && t <= u + 0.08) return t < d ? (t - (d - 0.05)) / 0.05 : t > u ? 1 - (t - u) / 0.08 : 1;
        }
        if (!downs.length) for (const c of clickTs) if (Math.abs(t - c) < 0.08) return 1 - Math.abs(t - c) / 0.08;
        return 0;
      };
      cursor = { x: [], y: [], o: [], p: [] };
      for (const t of srcT) {
        const p = pos(t);
        cursor.x.push(round(p.x, 1));
        cursor.y.push(round(p.y, 1));
        cursor.o.push(round(1 - hidden(t)));
        cursor.p.push(round(press(t)));
      }
      const ringTs = downs.length ? downs : clickTs;
      for (const t of ringTs) {
        const f = outFrameOf(t, segs);
        if (f === null || f >= dur) continue;
        const p = pos(t);
        clicks.push({ f, x: round(p.x, 1), y: round(p.y, 1) });
      }
    }
  }

  // camera shots (scene-relative frames)
  const moveF = (s?: number) => Math.round((s ?? D.cameraMove) * FPS);
  // Each scene opens on the full window unless it continues the previous shot ("startCamera": "keep").
  const sceneShots: Shot[] = sd.startCamera === "keep" ? [] : [{ f: Math.max(1, xfadeIn), move: Math.max(1, xfadeIn), cam: FULL }];
  if (clip) {
    const camDirs: any[] = sd.camera === "auto" || sd.camera === undefined ? autoCamera(clip) : sd.camera;
    for (const c of camDirs) {
      const at = outFrameNear(refTime(c.at, clip), segs) + Math.round((c.arrive ?? -D.cameraArriveEarly) * FPS);
      let cam: Cam;
      if (!c.rect || c.rect === "full") cam = c.zoom ? clampCam({ z: c.zoom, x: c.x ?? W / 2, y: c.y ?? H / 2 }) : FULL;
      else if (typeof c.rect === "string" && c.rect.startsWith("popup:")) {
        const r = popupRect(parseInt(c.rect.slice(6), 10));
        cam = r ? fitCam(r, c.zoom) : FULL;
      } else {
        const r = typeof c.rect === "string" ? markStageRect(c.rect, clip, popupRect) : cssToStage(c.rect as Rect);
        cam = fitCam(r, c.zoom);
      }
      const earliest = cam.z > 1.01 && sd.startCamera !== "keep" ? Math.round(D.firstZoomAt * FPS) : moveF(c.move);
      sceneShots.push({ f: Math.max(at, earliest), move: moveF(c.move), cam });
    }
  }
  for (const s of sceneShots) shots.push({ ...s, f: from + s.f });

  if (sd.chapter) chapters.push({ text: sd.chapter, from: from + Math.round(0.15 * FPS), to: from + Math.min(dur, Math.round(D.chapterDur * FPS)) });

  scenes.push({
    id,
    from,
    dur,
    xfadeIn,
    kind: isEnd ? "end" : "clip",
    clip: loaded?.src ?? null,
    placeholder: loaded?.placeholder ?? false,
    segments: segs.map(({ s0, ...s }) => s),
    redact: (sd.redact ?? []).map((r: any) => ({
      from: refTime(r.from ?? "start", clip!),
      to: refTime(r.to ?? "end", clip!),
      x: r.rect.x * cssScale,
      y: r.rect.y * cssScale,
      w: r.rect.w * cssScale,
      h: r.rect.h * cssScale,
      ...(r.cloneDy !== undefined ? { cloneDy: r.cloneDy * cssScale } : { color: r.color ?? D.redactColor }),
    })),
    popups,
    cursor,
    clicks,
  });
  report.push(
    `${id.padEnd(13)} ${loaded ? (loaded.placeholder ? "PH  " : "REAL") : "--  "} vo ${hasVo ? "mp3" : "est"} ${voDur.toFixed(1).padStart(5)}s  footage ${(footageDur / FPS).toFixed(1).padStart(5)}s  scene ${(dur / FPS).toFixed(1).padStart(5)}s  at ${fmt(from)}` +
      (footageDur > voEndF + 3 * FPS ? "  ! footage runs >3s past narration" : "") +
      (segs.length && dur - footageDur > 2 * FPS && footageDur ? `  ! ${((dur - footageDur) / FPS).toFixed(1)}s freeze at end` : "") +
      (holdLog.length ? `  [${holdLog.join(", ")}]` : ""),
  );
  cursorFrame = from + dur;
}

function autoCamera(clip: Clip): any[] {
  const out: any[] = [];
  const items: { t: number; c: any }[] = [];
  const seen: Record<string, number> = {};
  for (const m of clip.marks) {
    if (!m.rect) continue;
    seen[m.name] = (seen[m.name] ?? 0) + 1;
    items.push({ t: m.t, c: { at: m.t, rect: `mark:${m.name}#${seen[m.name]}` } });
  }
  clip.popups.forEach((p, i) => {
    items.push({ t: p.t_open, c: { at: p.t_open + 0.9, arrive: 0, rect: `popup:${i + 1}` } });
    items.push({ t: p.t_close, c: { at: p.t_close + 0.2, arrive: 0.8, rect: "full" } });
  });
  items.sort((a, b) => a.t - b.t);
  for (const it of items) out.push(it.c);
  return out;
}

function fmt(f: number) {
  const s = f / FPS;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

const total = cursorFrame;

// ---------------------------------------------------------------- global camera, evaluated per frame
shots.sort((a, b) => a.f - b.f);
const camera = { z: [] as number[], x: [] as number[], y: [] as number[] };
{
  let cur: Cam = FULL;
  let active: { start: number; end: number; from: Cam; to: Cam } | null = null;
  let next = 0;
  const evalMove = (a: NonNullable<typeof active>, f: number): Cam => {
    const e = easeCam(clamp((f - a.start) / Math.max(1, a.end - a.start), 0, 1));
    return {
      z: Math.exp(lerp(Math.log(a.from.z), Math.log(a.to.z), e)),
      x: lerp(a.from.x, a.to.x, e),
      y: lerp(a.from.y, a.to.y, e),
    };
  };
  for (let f = 0; f < total; f++) {
    while (next < shots.length && shots[next].f - shots[next].move <= f) {
      const s = shots[next++];
      const fromCam: Cam = active ? evalMove(active, f) : cur;
      active = { start: f, end: Math.max(s.f, f + 1), from: fromCam, to: s.cam };
    }
    if (active) {
      cur = evalMove(active, f);
      if (f >= active.end) active = null;
    }
    camera.z.push(round(cur.z, 4));
    camera.x.push(round(cur.x, 1));
    camera.y.push(round(cur.y, 1));
  }
}

// ---------------------------------------------------------------- music bed with ducking
let music: Timeline["music"] = null;
const musicFile = join(ROOT, "audio/music.mp3");
if (existsSync(musicFile)) {
  const active = new Uint8Array(total);
  for (const v of vo) for (let f = Math.max(0, v.from); f < Math.min(total, v.from + v.dur); f++) active[f] = 1;
  const volume: number[] = [];
  let g = D.musicGap;
  for (let f = 0; f < total; f++) {
    const target = active[f] ? D.musicUnderVo : D.musicGap;
    const rate = target < g ? 1 / (D.duckAttack * FPS) : 1 / (D.duckRelease * FPS);
    g = target < g ? Math.max(target, g - rate * (D.musicGap - D.musicUnderVo)) : Math.min(target, g + rate * (D.musicGap - D.musicUnderVo));
    const fade = Math.min(1, f / FPS / D.musicFadeIn, (total - f) / FPS / D.musicFadeOut);
    volume.push(round(g * clamp(fade, 0, 1), 4));
  }
  music = { src: "audio/music.mp3", volume };
}

captions.sort((a, b) => a.from - b.from);
captions.forEach((c, i) => {
  const next = captions[i + 1];
  if (next) c.to = Math.min(c.to, next.from);
});

const endScene = scenes.find((s) => s.kind === "end");
const timeline: Timeline = {
  fps: FPS,
  width: W,
  height: H,
  durationInFrames: total,
  layout: { window, topBar, content, cssScale, radius: 14 },
  title: { dur: titleDur, out: titleOut, text: dir.title.text },
  end: { from: endScene ? endScene.from : total, dur: endScene ? endScene.dur : 0 },
  scenes,
  camera,
  chapters,
  captions,
  vo,
  music,
};
writeFileSync(join(COMP, "src/timeline.json"), JSON.stringify(timeline));
console.log(report.join("\n"));
console.log(`TOTAL ${fmt(total)} (${total} frames)  limit 2:55  target 2:20-2:40`);
if (total > 175 * FPS) {
  console.error("Total exceeds the 2:55 hard limit");
  process.exit(1);
}
