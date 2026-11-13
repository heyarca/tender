// s01_open: /landing hero -> headline -> hero routing card switches provider once (3.5 s after mount) -> slow short scroll.
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, sleep, ROOT, SITE } from '../lib/rec.mjs';

const scene = 's01_open';
const rec = new Recorder(scene, { url: SITE + '/landing' });
const page = await rec.launch();
try {
  await page.mouse.move(1100, 700);
  rec.mouse.main = { x: 1100, y: 700 };
  // t=0 right after the hero renders; the card's one-time switch fires 3.5 s after mount.
  await page.goto(SITE + '/landing', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Always on the/ }).waitFor({ state: 'visible' });
  await page.getByText(/^Routing to /).first().waitFor({ state: 'visible', timeout: 20000 });
  await rec.start();
  const card = page.getByText(/^Routing to /).first().locator('xpath=ancestor::*[.//text()[contains(., "Provider")]][1]');
  await rec.mark('headline', page.getByRole('heading', { name: /Always on the/ }).first());
  rec.note('card at start: ' + (await page.getByText(/^Routing to /).first().innerText()));
  await page.getByText(/^Switched from /).first().waitFor({ state: 'visible', timeout: 15000 });
  await rec.mark('route_switch', page.getByText(/^Switched from /).first().locator('xpath=ancestor::*[2]'));
  rec.note('switch: ' + (await page.getByText(/^Switched from /).first().innerText()).replace(/\s+/g, ' '));
  await rec.mark('routing_card', card);
  await rec.moveTo(1040, 640, { duration: 900 });
  await rec.hold(2200);
  await rec.wheel(330, { duration: 2600 });
  await sleep(300);
  await rec.mark('routing_card_full', card);
  await rec.hold(2500);
  await rec.wheel(420, { duration: 3000 });
  await sleep(300);
  await rec.mark('agent_banner', page.getByText('Let your agent buy and sell API access.').first().locator('xpath=ancestor::section[1]'));
  await rec.hold(2500);
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
