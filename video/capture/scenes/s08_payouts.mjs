// s08_payouts: /payouts earnings per provider -> "Settle now" -> new PayPal Payouts batch -> item status reaches Success.
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, sleep, ROOT, SITE } from '../lib/rec.mjs';
import { gotoSettled, scrollIntoView } from '../lib/flows.mjs';

const scene = 's08_payouts';
const rec = new Recorder(scene, { url: SITE + '/payouts' });
const page = await rec.launch();
const txt = async (loc) => (await loc.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
try {
  await gotoSettled(rec, '/payouts', { settle: 2500 });
  await page.mouse.move(700, 420);
  rec.mouse.main = { x: 700, y: 420 };
  await rec.start();
  await rec.hold(1600);
  const settle = page.getByRole('button', { name: /Settle now/ }).first();
  const earnings = page.locator('[data-slot=payout-earnings]').first();
  const batches = page.locator('[data-slot=payout-batches]').first();
  await rec.mark('payouts_header', page.getByRole('heading', { name: 'Payouts' }).first().locator('xpath=..'));
  await rec.mark('stat_cards', page.locator('[data-slot=stat-card]').first().locator('xpath=..'));
  await rec.mark('payout_earnings', earnings);
  rec.note('settle enabled: ' + (await settle.isEnabled()));
  rec.note('earnings: ' + (await txt(earnings)).slice(0, 400));
  const topRow = earnings.locator('.ag-row[row-index="0"]').first();
  await rec.hover(topRow, { ox: 0.3 });
  await rec.mark('earnings_top_row', topRow);
  await rec.hold(1800);
  await rec.mark('settle_button', settle);
  await rec.click(settle);
  rec.waitStart('settle');
  const notice = page.locator('p[role=status]').first();
  await notice.waitFor({ state: 'visible', timeout: 60000 });
  rec.waitEnd('settle');
  await sleep(600);
  await rec.mark('settle_notice', notice);
  rec.note('notice: ' + (await txt(notice)));
  await rec.hold(1500);
  // newest batch row (expanded by the product) and its items
  await rec.moveTo(760, 640);
  await scrollIntoView(rec, batches, { targetY: 150, minMs: 1300, maxMs: 1900 });
  await sleep(500);
  await rec.mark('payout_batches', batches);
  const first = batches.locator('.ag-center-cols-container .ag-row[row-index="0"], .ag-row[row-index="0"]').first();
  await rec.mark('new_batch_row', first);
  rec.note('batches: ' + (await txt(batches)).slice(0, 600));
  rec.waitStart('payout_success');
  const t0 = Date.now();
  let done = false;
  let newest = null;
  while (Date.now() - t0 < 300000) {
    const api = await (await fetch(SITE + '/api/payouts')).json().catch(() => null);
    newest = api?.batches?.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (newest && newest.status === 'SUCCESS' && newest.items.every((i) => i.transactionStatus === 'SUCCESS')) { done = true; break; }
    await sleep(1500);
  }
  rec.note('newest batch: ' + JSON.stringify(newest ? { status: newest.status, items: newest.items.map((i) => [i.providerId, i.transactionStatus]), paypalBatchId: newest.paypalBatchId } : null));
  // let the page's own polling render the final status
  const t1 = Date.now();
  while (Date.now() - t1 < 30000) {
    const head = (await txt(batches)).split(/Nov 10/)[0];
    if (/Success/.test(head) && !/Pending|Processing|Unclaimed|New\b/.test(head)) break;
    await sleep(500);
  }
  rec.waitEnd('payout_success');
  rec.note('success reached: ' + done + ' after ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  await sleep(800);
  await rec.mark('batch_success', batches);
  rec.note('batches after: ' + (await txt(batches)).slice(0, 600));
  await rec.moveTo(820, 520);
  await rec.hold(3500);
  await rec.stop();
  console.log(JSON.stringify(rec.stats()));
  rec.saveSession({ notes: ['success reached: ' + done] });
} catch (e) {
  rec.note('ERROR ' + String(e?.stack || e).slice(0, 600));
  for (const [i, pg] of rec.ctx.pages().entries()) await pg.screenshot({ path: path.join(ROOT, 'work', scene, `error-${i}.png`) }).catch(() => {});
  await rec.stop().catch(() => {});
  try { rec.saveSession({ notes: ['ERROR: ' + String(e).slice(0, 200)] }); } catch {}
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(ROOT, 'work', scene, 'log.txt'), rec.log.join('\n'));
  await rec.close();
}
