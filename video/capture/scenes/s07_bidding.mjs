// s07_bidding: provider ranking -> Bidding agents "Rebid now" (LLM round ~20 s) -> new bids with reasons -> ranking re-orders.
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, sleep, ROOT, SITE } from '../lib/rec.mjs';
import { gotoSettled, scrollIntoView } from '../lib/flows.mjs';

const scene = 's07_bidding';
const rec = new Recorder(scene, { url: SITE + '/markets/sf-weather' });
const page = await rec.launch();
const txt = async (loc) => (await loc.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
try {
  await gotoSettled(rec, '/markets/sf-weather', { settle: 2000 });
  const toolbar = page.locator('[data-slot=providers-toolbar]').first();
  const table = page.locator('[data-slot=providers-table]').first();
  // start already on the provider ranking
  await page.evaluate(() => { const el = document.querySelector('[data-slot=providers-toolbar]'); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 118, behavior: 'instant' }); });
  await sleep(1200);
  await page.mouse.move(900, 520);
  rec.mouse.main = { x: 900, y: 520 };
  await rec.start();
  await rec.hold(1500);
  await rec.mark('providers_grid_before', table);
  const rowsBefore = await table.locator('[role=row]').allInnerTexts();
  rec.note('ranking before: ' + rowsBefore.map((r) => r.split('\n')[0]).join(' | '));
  await rec.hold(1200);
  const section = page.locator('section#bidding, #bidding').first();
  rec.note('bidding box before scroll: ' + JSON.stringify(await section.boundingBox()));
  await scrollIntoView(rec, section, { targetY: 118, minMs: 1100, maxMs: 1600 });
  rec.note('bidding box after scroll: ' + JSON.stringify(await section.boundingBox()));
  await rec.hold(1000);
  await rec.mark('bidding_section', section);
  const rebid = section.getByRole('button', { name: 'Rebid now' });
  await rec.mark('rebid_button', rebid);
  rec.note('rebid box: ' + JSON.stringify(await rebid.boundingBox()));
  await rec.click(rebid);
  rec.note('clicked rebid');
  rec.waitStart('bidding_round');
  await section.getByText('Agents are bidding…').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await rec.mark('agents_bidding', section.locator('[aria-live=polite]').first());
  await rec.moveTo(980, 300);
  await section.getByText(/agents changed their bids|No agent changed/).waitFor({ state: 'visible', timeout: 120000 });
  rec.waitEnd('bidding_round');
  await sleep(700);
  const summary = section.getByText(/agents changed their bids|No agent changed/).first();
  await rec.mark('round_summary', summary);
  rec.note('round: ' + (await txt(summary)));
  const history = section.locator('[data-slot=bid-history]').first();
  await rec.mark('bid_history', (await history.count()) ? history : section);
  rec.note('history: ' + (await txt((await history.count()) ? history : section)).slice(0, 900));
  await rec.moveTo(760, 560);
  await rec.hold(4200);
  // back to the ranking
  await scrollIntoView(rec, toolbar, { targetY: 118, minMs: 1100, maxMs: 1600 });
  await sleep(500);
  await rec.mark('providers_grid_after', table);
  const rowsAfter = await table.locator('[role=row]').allInnerTexts();
  rec.note('ranking after: ' + rowsAfter.map((r) => r.split('\n')[0]).join(' | '));
  const decision = page.locator('[data-slot=routing-decision]').first();
  await rec.mark('routing_decision_after', decision);
  rec.note('decision after: ' + (await txt(decision)).slice(0, 300));
  await rec.moveTo(820, 480);
  await rec.hold(3800);
  await rec.stop();
  console.log(JSON.stringify(rec.stats()));
  rec.saveSession({ notes: ['ranking before: ' + rowsBefore.map((r) => r.split('\n')[0]).join(' | '), 'ranking after: ' + rowsAfter.map((r) => r.split('\n')[0]).join(' | ')] });
} catch (e) {
  rec.note('ERROR ' + String(e?.stack || e).slice(0, 600));
  for (const [i, pg] of rec.ctx.pages().entries()) await pg.screenshot({ path: path.join(ROOT, 'work', scene, `error-${i}.png`) }).catch(() => {});
  await rec.stop().catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(ROOT, 'work', scene, 'log.txt'), rec.log.join('\n'));
  await rec.close();
}
