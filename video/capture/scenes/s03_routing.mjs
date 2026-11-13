// s03_routing: provider ranking + routing decision -> tighten Max P95 latency below the active provider -> routing switches and explains why.
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, sleep, ROOT, SITE } from '../lib/rec.mjs';
import { gotoSettled, scrollIntoView } from '../lib/flows.mjs';

const scene = 's03_routing';
const rec = new Recorder(scene, { url: SITE + '/markets/sf-weather' });
const page = await rec.launch();
const txt = async (loc) => (await loc.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
try {
  await gotoSettled(rec, '/markets/sf-weather', { settle: 2500 });
  await page.mouse.move(900, 380);
  rec.mouse.main = { x: 900, y: 380 };
  await rec.start();
  await rec.hold(1600);
  const latest = page.getByText('Latest result', { exact: true }).first().locator('xpath=ancestor::*[@data-slot="card"][1]');
  await rec.mark('latest_result', latest);
  await rec.mark('active_provider', page.locator('[data-slot=active-provider]').first());
  await rec.moveTo(1000, 330);
  await rec.hold(1800);
  const toolbar = page.locator('[data-slot=providers-toolbar]').first();
  const table = page.locator('[data-slot=providers-table]').first();
  const decision = page.locator('[data-slot=routing-decision]').first();
  await rec.moveTo(820, 560);
  await scrollIntoView(rec, toolbar, { targetY: 118, minMs: 1200, maxMs: 1800 });
  await rec.hold(1200);
  await rec.mark('providers_grid', table);
  await rec.mark('policy_chips', toolbar);
  const before = await txt(decision);
  rec.note('decision before: ' + before.slice(0, 400));
  // bring the decision text fully into view if needed
  const db = await decision.boundingBox();
  if (db && db.y + db.height > 880) {
    await rec.wheel(Math.round(db.y + db.height - 870), { duration: 900 });
    await sleep(400);
  }
  await rec.mark('routing_decision', decision);
  await rec.moveTo(700, (await decision.boundingBox()).y + 30);
  await rec.hold(2600);
  // choose the new limit: 10 ms below the active provider's P95
  const activeRow = table.locator('[role=row]').filter({ hasText: 'Active' }).first();
  const activeText = await txt(activeRow);
  const m = activeText.match(/(\d+)\s*ms/);
  const activeP95 = m ? Number(m[1]) : 210;
  const limit = Math.max(50, Math.floor((activeP95 - 5) / 10) * 10);
  rec.note(`active row: ${activeText.slice(0, 120)} -> new limit ${limit}`);
  // chip -> Routing policy section (smooth scroll by the product)
  await scrollIntoView(rec, toolbar, { targetY: 118, minMs: 1000, maxMs: 1500 });
  await sleep(300);
  const chip = toolbar.locator('[data-chip]').filter({ hasText: 'P95' }).first();
  await rec.mark('p95_chip', chip);
  await rec.click(chip, { jitter: 0.03 });
  await sleep(1800);
  const field = page.getByRole('textbox', { name: 'Max P95 latency' }).first();
  await field.waitFor({ state: 'visible' });
  const fb = await field.boundingBox();
  rec.note('field box after chip: ' + JSON.stringify(fb));
  if (!fb || fb.y < 90 || fb.y > 780) {
    rec.note('chip did not bring the policy into view; scrolling');
    await scrollIntoView(rec, page.locator('#routing').first(), { targetY: 110, minMs: 1000, maxMs: 1600 });
  }
  const policyCard = field.locator('xpath=ancestor::*[@data-slot="card"][1]');
  await rec.mark('routing_policy_section', page.locator('#routing').first());
  await rec.hold(1000);
  await rec.click(field, { ox: 0.3 });
  await sleep(250);
  await field.selectText();
  rec.ev('key', 'main', { key: 'select-all', x: rec.mouse.main.x, y: rec.mouse.main.y });
  await sleep(350);
  await rec.type(String(limit), { min: 90, max: 140 });
  await sleep(500);
  await rec.press('Enter');
  await page.waitForFunction((lim) => {
    const el = document.querySelector('[data-slot=routing-decision]');
    return el && !el.textContent.includes('P95 ' + '210 ms ≤ 400 ms') ;
  }, limit, { timeout: 8000 }).catch(() => rec.note('decision did not change within 8 s'));
  rec.note('field value now: ' + (await field.inputValue()));
  await sleep(900);
  await rec.mark('p95_field', field.locator('xpath=ancestor::*[@data-slot="spec-field"][1]'));
  const summary = page.locator('#routing').getByText(/^Routing to /).first().locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
  await rec.mark('routing_summary', summary);
  rec.note('routing summary: ' + (await txt(summary)).slice(0, 300));
  await rec.moveTo(760, 620);
  await rec.hold(2400);
  // back to the ranking + decision
  await scrollIntoView(rec, toolbar, { targetY: 118, minMs: 1300, maxMs: 1800 });
  await sleep(300);
  const db2 = await decision.boundingBox();
  if (db2 && db2.y + db2.height > 880) {
    await rec.wheel(Math.round(db2.y + db2.height - 870), { duration: 900 });
    await sleep(400);
  }
  await rec.mark('providers_grid_after', table);
  await rec.mark('routing_decision_after', decision);
  const after = await txt(decision);
  rec.note('decision after: ' + after.slice(0, 500));
  await rec.moveTo(720, (await decision.boundingBox()).y + 40);
  await rec.hold(3600);
  await rec.stop();
  console.log(JSON.stringify(rec.stats()));
  rec.saveSession({ notes: [`Max P95 latency 400 -> ${limit} ms (active provider P95 ${activeP95} ms)`, 'decision before: ' + before.slice(0, 200), 'decision after: ' + after.slice(0, 300)] });
} catch (e) {
  rec.note('ERROR ' + String(e?.stack || e).slice(0, 600));
  for (const [i, pg] of rec.ctx.pages().entries()) await pg.screenshot({ path: path.join(ROOT, 'work', scene, `error-${i}.png`) }).catch(() => {});
  await rec.stop().catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(ROOT, 'work', scene, 'log.txt'), rec.log.join('\n'));
  await rec.close();
}
