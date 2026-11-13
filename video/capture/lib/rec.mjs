// Shared recorder: Chrome via playwright-core, CDP screencast on every page, one wall clock.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const CLIPS = path.join(ROOT, 'clips');
export const SITE = 'https://tender.heyarca.app';
export const VIEW = { width: 1440, height: 900 };
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (a, b) => a + Math.random() * (b - a);
const now = () => Date.now() / 1000;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

export class Recorder {
  constructor(scene, { dpr = 2, headless = true, url = SITE } = {}) {
    this.scene = scene;
    this.dpr = dpr;
    this.headless = headless;
    this.url = url;
    this.events = [];
    this.marks = [];
    this.surfaces = [];
    this.popups = [];
    this.t0 = null;
    this.mouse = { main: { x: 720, y: 450 } };
    this.framesDir = path.join(ROOT, 'work', scene, 'frames');
    fs.rmSync(path.join(ROOT, 'work', scene), { recursive: true, force: true });
    fs.mkdirSync(this.framesDir, { recursive: true });
    this.log = [];
  }

  note(msg) {
    const line = `${new Date().toISOString().slice(11, 19)} [${this.scene}] ${msg}`;
    this.log.push(line);
    console.log(line);
  }

  t() { return this.t0 == null ? 0 : now() - this.t0; }

  async launch() {
    this.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `tender-cap-${this.scene}-`));
    this.ctx = await chromium.launchPersistentContext(this.userDataDir, {
      channel: 'chrome',
      headless: this.headless,
      viewport: VIEW,
      deviceScaleFactor: this.dpr,
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles',
      colorScheme: 'light',
      userAgent: UA,
      args: [
        `--force-device-scale-factor=${this.dpr}`,
        '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
        '--force-color-profile=srgb', '--disable-blink-features=AutomationControlled',
        '--disable-features=Translate,MediaRouter,OptimizationHints',
        ...(this.headless ? [] : ['--window-position=-2400,0', `--window-size=${VIEW.width},${VIEW.height + 100}`]),
      ],
    });
    this.page = this.ctx.pages()[0] ?? (await this.ctx.newPage());
    this.page.setDefaultTimeout(45000);
    this.page.on('pageerror', (e) => this.note('pageerror ' + String(e).slice(0, 160)));
    this.main = await this.attach(this.page, 'main');
    this.ctx.on('page', (p) => { if (p !== this.page) this.onPopup(p); });
    return this.page;
  }

  async attach(page, label) {
    const dir = path.join(this.framesDir, label);
    fs.mkdirSync(dir, { recursive: true });
    const cdp = await this.ctx.newCDPSession(page);
    const surf = { label, page, cdp, dir, frames: [], writes: [], opened: now(), closed: null };
    cdp.on('Page.screencastFrame', (ev) => {
      cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
      const recv = now();
      const ts = ev.metadata?.timestamp ?? recv;
      const file = path.join(dir, String(surf.frames.length).padStart(6, '0') + '.jpg');
      const buf = Buffer.from(ev.data, 'base64');
      const size = jpegSize(buf);
      surf.frames.push({ ts, recv, file, w: size?.w, h: size?.h });
      surf.writes.push(fs.promises.writeFile(file, buf));
    });
    await cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 92, maxWidth: VIEW.width * this.dpr, maxHeight: VIEW.height * this.dpr, everyNthFrame: 1,
    });
    page.on('close', () => { surf.closed = now(); });
    this.surfaces.push(surf);
    return surf;
  }

  async onPopup(p) {
    const n = this.popups.length + 1;
    const label = `popup${n}`;
    const entry = { label, page: p, n };
    this.popups.push(entry);
    this.note(`${label} opened`);
    try {
      entry.surf = await this.attach(p, label);
    } catch (e) {
      this.note(`${label} attach failed ${String(e).slice(0, 120)}`);
    }
    if (this.onPopupHook) this.onPopupHook(entry);
  }

  waitPopup(timeout = 30000) {
    const have = this.popups.length;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('popup timeout')), timeout);
      const iv = setInterval(() => {
        const e = this.popups[have];
        if (e && e.surf) { clearTimeout(t); clearInterval(iv); resolve(e); }
      }, 20);
    });
  }

  // Restart the main screencast so a fresh frame exists at t=0 (static pages emit no frames).
  async start() {
    const s = this.main;
    const n = s.frames.length;
    await s.cdp.send('Page.stopScreencast').catch(() => {});
    await s.cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 92, maxWidth: VIEW.width * this.dpr, maxHeight: VIEW.height * this.dpr, everyNthFrame: 1,
    });
    for (let i = 0; i < 100 && s.frames.length === n; i++) await sleep(20);
    this.t0 = now();
    this.note('t0');
  }

  ev(type, target, extra) {
    if (this.t0 == null) return;
    this.events.push({ t: r3(this.t()), type, target, ...extra });
  }

  async mark(name, what, { target = 'main', page } = {}) {
    const m = { t: r3(this.t()), name, target };
    if (what) {
      let box = null;
      if (typeof what === 'object' && 'x' in what && 'w' in what) box = { x: what.x, y: what.y, width: what.w, height: what.h };
      else {
        const loc = typeof what === 'string' ? (page ?? this.page).locator(what).first() : what;
        box = await loc.boundingBox().catch(() => null);
      }
      if (box) m.rect = { x: r2(box.x), y: r2(box.y), w: r2(box.width), h: r2(box.height) };
      else this.note(`mark ${name}: no rect`);
    }
    this.marks.push(m);
    return m;
  }

  pageFor(target) { return target === 'main' ? this.page : this.popups.find((p) => p.label === target).page; }

  async moveTo(x, y, { target = 'main', duration } = {}) {
    const page = this.pageFor(target);
    if (!this.mouse[target]) {
      const surf = this.surfaces.find((s) => s.label === target);
      const f = surf?.frames[surf.frames.length - 1];
      this.mouse[target] = f?.w ? { x: f.w / this.dpr / 2, y: f.h / this.dpr * 0.75 } : { x: 284, y: 560 };
    }
    const from = this.mouse[target];
    const dist = Math.hypot(x - from.x, y - from.y);
    if (dist < 1) return;
    const dur = duration ?? Math.min(900, Math.max(500, 380 + dist * 0.45));
    const steps = Math.max(10, Math.round(dur / 16));
    // gentle arc: control point offset perpendicular to the path
    const nx = -(y - from.y) / (dist || 1), ny = (x - from.x) / (dist || 1);
    const bend = Math.min(60, dist * 0.12) * (Math.random() < 0.5 ? -1 : 1);
    const cx = (from.x + x) / 2 + nx * bend, cy = (from.y + y) / 2 + ny * bend;
    const t0 = Date.now();
    for (let i = 1; i <= steps; i++) {
      const s = easeInOut(i / steps);
      const px = (1 - s) * (1 - s) * from.x + 2 * (1 - s) * s * cx + s * s * x;
      const py = (1 - s) * (1 - s) * from.y + 2 * (1 - s) * s * cy + s * s * y;
      await page.mouse.move(px, py);
      this.ev('move', target, { x: r2(px), y: r2(py) });
      const due = t0 + (i * dur) / steps;
      const wait = due - Date.now();
      if (wait > 0) await sleep(wait);
    }
    this.mouse[target] = { x, y };
  }

  async box(loc) {
    const b = await loc.boundingBox();
    if (!b) throw new Error('no bounding box for ' + loc);
    return b;
  }

  async hover(loc, { target = 'main', ox = 0.5, oy = 0.5, jitter = 0.08 } = {}) {
    const b = await this.box(loc);
    const x = b.x + b.width * Math.min(0.9, Math.max(0.1, ox + rand(-jitter, jitter)));
    const y = b.y + b.height * Math.min(0.85, Math.max(0.15, oy + rand(-jitter, jitter)));
    await this.moveTo(x, y, { target });
    return { x, y };
  }

  async click(loc, opts = {}) {
    const { target = 'main' } = opts;
    const page = this.pageFor(target);
    const { x, y } = await this.hover(loc, opts);
    await sleep(rand(140, 260));
    await page.mouse.down();
    this.ev('down', target, { x: r2(x), y: r2(y) });
    await sleep(rand(70, 120));
    await page.mouse.up();
    this.ev('up', target, { x: r2(x), y: r2(y) });
    this.ev('click', target, { x: r2(x), y: r2(y) });
  }

  async type(text, { target = 'main', min = 35, max = 75, secret = false } = {}) {
    const page = this.pageFor(target);
    for (const ch of text) {
      await page.keyboard.type(ch);
      this.ev('key', target, { key: secret ? '•' : ch, x: r2(this.mouse[target].x), y: r2(this.mouse[target].y) });
      await sleep(rand(min, max));
    }
  }

  async press(key, { target = 'main' } = {}) {
    const page = this.pageFor(target);
    await page.keyboard.press(key);
    this.ev('key', target, { key, x: r2(this.mouse[target].x), y: r2(this.mouse[target].y) });
  }

  // Calm eased page scroll driven by requestAnimationFrame in the page (no per-step input round trips).
  async wheel(totalDy, { target = 'main', duration = 900 } = {}) {
    const page = this.pageFor(target);
    const m = this.mouse[target] ?? { x: VIEW.width / 2, y: VIEW.height / 2 };
    this.ev('scroll', target, { x: r2(m.x), y: r2(m.y), dy: Math.round(totalDy), duration_ms: Math.round(duration) });
    const moved = await page.evaluate(({ dy, dur }) => new Promise((resolve) => {
      const el = document.scrollingElement || document.documentElement;
      const y0 = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      const y1 = Math.max(0, Math.min(max, y0 + dy));
      const t0 = performance.now();
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        window.scrollTo({ top: y0 + (y1 - y0) * ease(p), behavior: 'instant' });
        if (p < 1) requestAnimationFrame(step); else resolve(y1 - y0);
      };
      requestAnimationFrame(step);
    }), { dy: totalDy, dur: duration });
    const last = this.events[this.events.length - 1];
    if (last && last.type === 'scroll' && moved !== Math.round(totalDy)) last.dy_actual = Math.round(moved);
  }

  async hold(ms = 1500) { await sleep(ms); }

  waitStart(label = '') { this.marks.push({ t: r3(this.t()), name: 'wait_start' + (label ? ':' + label : '') }); }
  waitEnd(label = '') { this.marks.push({ t: r3(this.t()), name: 'wait_end' + (label ? ':' + label : '') }); }

  async stop() {
    this.tEnd = this.t();
    for (const s of this.surfaces) await s.cdp.send('Page.stopScreencast').catch(() => {});
    await sleep(300);
    for (const s of this.surfaces) await Promise.all(s.writes);
    this.note(`stopped at ${this.tEnd.toFixed(2)} s`);
  }

  async close() {
    try {
      const cookies = await this.ctx.cookies('https://tender.heyarca.app');
      const acct = cookies.find((c) => c.name === 'tender_account');
      if (acct) fs.writeFileSync(path.join(ROOT, 'work', this.scene, 'account.json'), JSON.stringify({ tender_account: acct.value }), { mode: 0o600 });
    } catch {}
    await this.ctx?.close().catch(() => {});
    fs.rmSync(this.userDataDir, { recursive: true, force: true });
  }

  stats() {
    const out = {};
    for (const s of this.surfaces) {
      const fr = s.frames.filter((f) => this.t0 == null || f.ts >= this.t0);
      const span = fr.length > 1 ? fr[fr.length - 1].ts - fr[0].ts : 0;
      const sizes = {};
      for (const f of s.frames) sizes[`${f.w}x${f.h}`] = (sizes[`${f.w}x${f.h}`] ?? 0) + 1;
      let maxGap = 0;
      for (let i = 1; i < fr.length; i++) maxGap = Math.max(maxGap, fr[i].ts - fr[i - 1].ts);
      const lat = fr.map((f) => f.recv - f.ts);
      out[s.label] = { frames: fr.length, span: r2(span), avgFps: span ? r2((fr.length - 1) / span) : 0, maxGap: r3(maxGap), sizes,
        latency: lat.length ? r3(lat.reduce((a, b) => a + b, 0) / lat.length) : null };
    }
    return out;
  }

  // Persist everything needed to (re)build clips later without the browser.
  saveSession(extra = {}) {
    const file = path.join(ROOT, 'work', this.scene, 'session.json');
    const data = {
      scene: this.scene, dpr: this.dpr, url: this.url, t0: this.t0, tEnd: this.tEnd,
      events: this.events, marks: this.marks,
      surfaces: this.surfaces.map((s) => ({ label: s.label, opened: s.opened, closed: s.closed, frames: s.frames })),
      ...extra,
    };
    fs.writeFileSync(file, JSON.stringify(data));
    this.note('session saved ' + file);
    return file;
  }

  static fromSession(file) {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rec = Object.create(Recorder.prototype);
    Object.assign(rec, { scene: d.scene, dpr: d.dpr, url: d.url, t0: d.t0, tEnd: d.tEnd, events: d.events, marks: d.marks, log: [] });
    rec.surfaces = d.surfaces;
    rec.main = d.surfaces.find((s) => s.label === 'main');
    rec.popups = d.surfaces.filter((s) => s.label !== 'main').map((s) => ({ label: s.label, surf: s }));
    rec.session = d;
    return rec;
  }

  // Build one CFR clip from a surface for scene window [tA, tB] (scene-relative seconds).
  surfaceSize(surf) {
    const counts = {};
    for (const f of surf.frames) if (f.w && f.h) counts[`${f.w}x${f.h}`] = (counts[`${f.w}x${f.h}`] ?? 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const [w, h] = top ? top[0].split('x').map(Number) : [VIEW.width * this.dpr, VIEW.height * this.dpr];
    return { W: w - (w % 2), H: h - (h % 2), rawW: w, rawH: h };
  }

  buildClip(surf, tA, tB, outFile, { fps = 30, crf = 14 } = {}) {
    const { W, H, rawW, rawH } = this.surfaceSize(surf);
    const seq = path.join(ROOT, 'work', this.scene, 'seq-' + path.basename(outFile, '.mp4'));
    fs.rmSync(seq, { recursive: true, force: true });
    fs.mkdirSync(seq, { recursive: true });
    const black = path.join(ROOT, 'work', `black-${rawW}x${rawH}.jpg`);
    if (!fs.existsSync(black)) spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=black:s=${rawW}x${rawH}`, '-frames:v', '1', '-q:v', '2', black]);
    const frames = surf.frames.filter((f) => f.w === rawW && f.h === rawH).sort((a, b) => a.ts - b.ts);
    const n = Math.round((tB - tA) * fps);
    let j = -1;
    for (let i = 0; i < n; i++) {
      const t = this.t0 + tA + i / fps;
      while (j + 1 < frames.length && frames[j + 1].ts <= t) j++;
      const src = j >= 0 ? frames[j].file : surf.label === 'main' && frames.length ? frames[0].file : black;
      fs.linkSync(src, path.join(seq, String(i).padStart(6, '0') + '.jpg'));
    }
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(seq, '%06d.jpg'),
      '-vf', `crop=${W}:${H}:0:0,scale=in_range=full:out_range=limited:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p`,
      '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1',
      '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p',
      '-r', String(fps), '-movflags', '+faststart', '-an', outFile], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr);
    fs.rmSync(seq, { recursive: true, force: true });
    return { file: path.basename(outFile), frames: n };
  }

  // Write <scene>.mp4 (+ popups) and <scene>.json for window [tA, tB] of this recording.
  writeScene(sceneId, { tA = 0, tB = this.tEnd, url = this.url, notes = [] } = {}) {
    fs.mkdirSync(CLIPS, { recursive: true });
    const inWin = (t) => t >= tA - 1e-6 && t <= tB + 1e-6;
    const shift = (o) => ({ ...o, t: r3(o.t - tA) });
    const mainOut = this.buildClip(this.main, tA, tB, path.join(CLIPS, `${sceneId}.mp4`));
    const popups = [];
    for (const p of this.popups) {
      if (!p.surf) continue;
      const tOpen = p.surf.opened - this.t0, tClose = (p.surf.closed ?? this.t0 + this.tEnd) - this.t0;
      if (tClose < tA || tOpen > tB) continue;
      const k = popups.length + 1;
      const file = `${sceneId}-popup${k}.mp4`;
      const end = Math.min(tB, tClose);
      this.buildClip(p.surf, tA, end, path.join(CLIPS, file));
      const { rawW, rawH } = this.surfaceSize(p.surf);
      const first = p.surf.frames.find((f) => f.w === rawW && f.h === rawH);
      popups.push({ file, label: p.label, t_open: r3(Math.max(0, tOpen - tA)), t_first_frame: first ? r3(Math.max(0, first.ts - this.t0 - tA)) : null, t_close: r3(end - tA), viewport: { w: r2(rawW / this.dpr), h: r2(rawH / this.dpr) }, px: { w: rawW - (rawW % 2), h: rawH - (rawH % 2) } });
    }
    const json = {
      scene: sceneId,
      viewport: { w: VIEW.width, h: VIEW.height },
      dpr: this.dpr,
      fps: 30,
      duration_s: r3(tB - tA),
      url,
      events: this.events.filter((e) => inWin(e.t)).map(shift),
      marks: this.marks.filter((m) => inWin(m.t)).map(shift),
      popups,
      notes,
    };
    fs.writeFileSync(path.join(CLIPS, `${sceneId}.json`), JSON.stringify(json, null, 1));
    this.note(`wrote ${sceneId}: ${json.duration_s}s, ${json.events.length} events, ${json.marks.length} marks, ${popups.length} popups`);
    return json;
  }
}
