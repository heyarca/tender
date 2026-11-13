// s02_markets: /markets -> Table (AG Grid) live rows -> quick filter "weather" -> sort a column -> open San Francisco Weather.
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, sleep, ROOT, SITE } from '../lib/rec.mjs';
import { gotoSettled } from '../lib/flows.mjs';

const scene = 's02_markets';
const rec = new Recorder(scene, { url: SITE + '/markets' });
const page = await rec.launch();
try {
  await gotoSettled(rec, '/markets', { settle: 2500 });
  await page.mouse.move(760, 420);
  rec.mouse.main = { x: 760, y: 420 };
  await rec.start();
  await rec.hold(1800);
  await rec.mark('markets_header', page.getByRole('heading', { name: 'Markets', exact: true }).first());
  const toggle = page.locator('[aria-label="Switch between list and table view"]');
  const tableBtn = toggle.getByText('Table', { exact: true });
  await rec.click(tableBtn);
  const grid = page.locator('[data-slot=directory-grid]').first();
  await grid.waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('.ag-row').first().waitFor({ state: 'visible', timeout: 30000 });
  await sleep(600);
  await rec.mark('directory_grid', grid);
  await rec.moveTo(980, 640);
  await rec.hold(3200);
  await rec.mark('directory_grid_live', grid);
  const search = page.locator('[aria-label="Search markets"]');
  await rec.click(search);
  await sleep(400);
  await rec.type('weather', { min: 70, max: 120 });
  await sleep(500);
  await rec.mark('quick_filter', search);
  await rec.moveTo(900, 560);
  await rec.hold(2000);
  await rec.mark('directory_grid_filtered', grid);
  const header = page.getByRole('columnheader', { name: /Winning bid/ }).first();
  await rec.click(header.locator('.ag-header-cell-text, .ag-header-cell-label').first());
  await sleep(700);
  await rec.mark('sort_header', header);
  await rec.mark('directory_grid_sorted', grid);
  rec.note('sort state: ' + (await header.getAttribute('aria-sort')));
  await rec.moveTo(820, 600);
  await rec.hold(2200);
  const sf = grid.getByRole('link', { name: 'San Francisco Weather', exact: true }).first();
  const sfTarget = (await sf.count()) ? sf : grid.getByText('San Francisco Weather', { exact: true }).first();
  await rec.mark('sf_weather_row', sfTarget.locator('xpath=ancestor::*[contains(@class,"ag-row")][1]'));
  await rec.click(sfTarget, { jitter: 0.05 });
  await page.waitForURL(/\/markets\/sf-weather/, { timeout: 30000 });
  await page.getByRole('heading', { name: 'San Francisco Weather' }).first().waitFor({ state: 'visible' });
  await sleep(500);
  await rec.mark('sf_weather_title', page.getByRole('heading', { name: 'San Francisco Weather' }).first());
  await rec.moveTo(860, 520);
  await rec.hold(2600);
  await rec.stop();
  console.log(JSON.stringify(rec.stats()));
  rec.saveSession();
} catch (e) {
  rec.note('ERROR ' + String(e?.stack || e).slice(0, 600));
  for (const [i, pg] of rec.ctx.pages().entries()) await pg.screenshot({ path: path.join(ROOT, 'work', scene, `error-${i}.png`) }).catch(() => {});
  await rec.stop().catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(ROOT, 'work', scene, 'log.txt'), rec.log.join('\n'));
  await rec.close();
}
