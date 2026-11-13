// Rebuild clips from a saved session: bun lib/build.mjs <take> [sceneId[:tA:tB] ...]
// tA/tB may be numbers (seconds) or mark names (e.g. split_s05_s06). Default: one scene named after the take.
import path from 'node:path';
import { Recorder, ROOT } from './rec.mjs';

const [take, ...specs] = process.argv.slice(2);
const rec = Recorder.fromSession(path.join(ROOT, 'work', take, 'session.json'));
const at = (v, dflt) => {
  if (v === undefined || v === '') return dflt;
  if (!Number.isNaN(Number(v))) return Number(v);
  const m = rec.marks.find((x) => x.name === v);
  if (!m) throw new Error('no mark ' + v);
  return m.t;
};
const notes = rec.session.notes ?? [];
for (const spec of specs.length ? specs : [take]) {
  const [id, a, b] = spec.split(':');
  const t = Date.now();
  rec.writeScene(id, { tA: at(a, 0), tB: at(b, rec.tEnd), notes });
  console.log(id, 'built in', ((Date.now() - t) / 1000).toFixed(1), 's');
}
