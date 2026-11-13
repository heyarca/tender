// s09_agents: agent install banner with `npx @heyarca/tender@latest` + copy action -> Account -> API keys (no key created).
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, sleep, ROOT, SITE } from '../lib/rec.mjs';
import { gotoSettled, scrollIntoView } from '../lib/flows.mjs';

const scene = 's09_agents';
const rec = new Recorder(scene, { url: SITE + '/markets' });
const page = await rec.launch();
try {
  await rec.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
  await gotoSettled(rec, '/markets', { settle: 2500 });
  await page.mouse.move(640, 300);
  rec.mouse.main = { x: 640, y: 300 };
  await rec.start();
  await rec.hold(1500);
  const banner = page.locator('section[aria-labelledby="agent-install-title"]').first();
  await rec.mark('agent_banner', banner);
  const cmd = banner.locator('code').first();
  await rec.mark('install_command', cmd.locator('xpath=..'));
  await rec.hover(cmd);
  await rec.hold(1400);
  const copy = banner.getByRole('button', { name: /Copy command|Command copied/ }).first();
  await rec.mark('copy_button', copy);
  await rec.click(copy, { jitter: 0.03 });
  await sleep(500);
  await rec.mark('copied', copy);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  rec.note('clipboard: ' + clip);
  await rec.hold(1800);
  const nav = page.getByRole('link', { name: 'Account', exact: true }).first();
  await rec.click(nav);
  await page.waitForURL(/\/account/, { timeout: 30000 });
  await page.getByRole('heading', { name: 'Account', exact: true }).first().waitFor({ state: 'visible' });
  await sleep(1200);
  await rec.mark('account_page', page.locator('main').first());
  await rec.hold(1200);
  const keys = page.locator('[data-slot=api-keys]').first();
  const keysHead = page.getByRole('heading', { name: 'API keys' }).first();
  await rec.moveTo(760, 600);
  await scrollIntoView(rec, keysHead, { targetY: 380, minMs: 1400, maxMs: 2000 });
  await sleep(400);
  await rec.mark('api_keys', (await keys.count()) ? keys : keysHead.locator('xpath=ancestor::section[1]'));
  await rec.mark('api_keys_section', keysHead.locator('xpath=ancestor::section[1]'));
  await rec.moveTo(700, 560);
  await rec.hold(3200);
  await rec.stop();
  console.log(JSON.stringify(rec.stats()));
  rec.saveSession({ notes: ['copy action copied: ' + clip] });
} catch (e) {
  rec.note('ERROR ' + String(e?.stack || e).slice(0, 600));
  for (const [i, pg] of rec.ctx.pages().entries()) await pg.screenshot({ path: path.join(ROOT, 'work', scene, `error-${i}.png`) }).catch(() => {});
  await rec.stop().catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(ROOT, 'work', scene, 'log.txt'), rec.log.join('\n'));
  await rec.close();
}
