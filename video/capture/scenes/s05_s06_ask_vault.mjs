// s05_ask + s06_vault: fresh $0 account -> Ask Tender -> approval card -> tick auto top-up -> PayPal Vault -> automatic top-up -> paid requests -> report.
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, sleep, rand, ROOT } from '../lib/rec.mjs';
import { gotoSettled, paypalApprove } from '../lib/flows.mjs';

const PROMPT = "Keep my app on the cheapest San Francisco weather feed under $30 per million requests with P95 under 300 ms, and don't spend more than $5 this week.";
const take = 's05_s06';
const rec = new Recorder(take, { url: 'https://tender.heyarca.app/markets/sf-weather' });
const page = await rec.launch();
const panel = page.locator('[data-slot=ask-tender-panel]');
const busy = () => panel.getByRole('button', { name: 'Stop' }).isVisible().catch(() => false);
async function waitIdle(label, timeout = 240000) {
  rec.waitStart(label);
  const t0 = Date.now();
  await sleep(1500);
  while (Date.now() - t0 < timeout) {
    if (!(await busy())) {
      await sleep(1200);
      if (!(await busy())) break;
    }
    await sleep(400);
  }
  rec.waitEnd(label);
}
try {
  await gotoSettled(rec, '/markets/sf-weather', { settle: 2500 });
  await page.mouse.move(1000, 560);
  rec.mouse.main = { x: 1000, y: 560 };
  await rec.start();
  await rec.hold(1500);
  const chip = page.locator('[data-slot=balance-chip]').first();
  await rec.mark('balance_chip_zero', chip);
  rec.note('chip at start: ' + (await chip.innerText()).replace(/\s+/g, ' '));
  const askBtn = page.locator('[data-slot=ask-tender-button]');
  await rec.mark('ask_tender_button', askBtn);
  await rec.click(askBtn);
  await panel.waitFor({ state: 'visible' });
  await sleep(1300);
  await rec.mark('ask_panel', panel);
  const box = page.locator('textarea[aria-label="Message Ask Tender"]');
  await rec.click(box);
  await sleep(500);
  await rec.mark('prompt_typing_start', box);
  await rec.type(PROMPT, { min: 35, max: 75 });
  await sleep(900);
  await rec.mark('prompt_typed', box);
  await rec.press('Enter');
  await sleep(600);
  if ((await box.inputValue().catch(() => '')).trim()) {
    rec.note('Enter did not send; clicking Send');
    await rec.click(panel.getByRole('button', { name: 'Send' }));
  }
  await rec.mark('prompt_sent');
  // approval card
  const card = panel.getByText('Approve a spending limit', { exact: true });
  rec.waitStart('agent_plan');
  await card.waitFor({ state: 'visible', timeout: 180000 });
  rec.waitEnd('agent_plan');
  await sleep(1200);
  const cardFrame = card.locator('xpath=ancestor::*[.//button[normalize-space()="Approve"]][1]');
  await rec.mark('approval_card', cardFrame);
  await rec.mark('weekly_limit_row', cardFrame.getByText('Weekly limit').locator('xpath=..'));
  const option = panel.locator('[data-slot=auto-top-up-option]');
  await option.waitFor({ state: 'visible', timeout: 30000 });
  await rec.mark('auto_top_up_option', option);
  rec.note('panel at approval: ' + (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 900));
  await rec.moveTo((await option.boundingBox()).x + 40, (await option.boundingBox()).y - 60);
  await rec.hold(2200);
  rec.marks.push({ t: Math.round(rec.t() * 1000) / 1000, name: 'split_s05_s06' });
  await rec.hold(300);
  // s06: tick, approve, vault
  await rec.click(option.locator('[data-slot=checkbox]').first(), { jitter: 0.02 });
  await sleep(300);
  await rec.mark('auto_top_up_ticked', option);
  await rec.hold(1500);
  const approve = cardFrame.getByRole('button', { name: 'Approve', exact: true });
  await rec.mark('approve_button', approve);
  const popupWait = rec.waitPopup(45000);
  await rec.click(approve);
  const popup = await popupWait;
  await rec.mark('vault_popup_open');
  const label = await paypalApprove(rec, popup, { reviewHold: 2000 });
  rec.note('vault approved via ' + label);
  const saved = panel.locator('[data-slot=paypal-saved]');
  rec.waitStart('vault_save');
  await saved.waitFor({ state: 'visible', timeout: 90000 });
  rec.waitEnd('vault_save');
  await sleep(600);
  await rec.mark('limit_approved_card', saved.locator('xpath=..'));
  await rec.hold(1500);
  await waitIdle('agent_run');
  let text = (await panel.innerText()).replace(/\s+/g, ' ');
  rec.note('panel after run: ' + text.slice(-1200));
  if (!/topped up|top-up|added \$/i.test(text) || !/request/i.test(text)) {
    rec.note('no run detected; sending follow-up');
    await rec.click(box);
    await rec.type('Run 3 requests now.', { min: 40, max: 75 });
    await sleep(600);
    await rec.press('Enter');
    await waitIdle('agent_run_followup');
    text = (await panel.innerText()).replace(/\s+/g, ' ');
    rec.note('panel after follow-up: ' + text.slice(-1200));
  }
  await sleep(800);
  const msgs = panel.locator('[data-role=assistant], [data-message-role=assistant]');
  if (await msgs.count()) await rec.mark('final_report', msgs.last());
  await rec.mark('panel_final', panel);
  await rec.mark('balance_chip_after', chip);
  rec.note('chip after: ' + (await chip.innerText()).replace(/\s+/g, ' '));
  await rec.moveTo(1050, 700);
  await rec.hold(3500);
  await rec.stop();
  console.log(JSON.stringify(rec.stats()));
  rec.saveSession();
} catch (e) {
  rec.note('ERROR ' + String(e?.stack || e).slice(0, 600));
  for (const [i, pg] of rec.ctx.pages().entries()) await pg.screenshot({ path: path.join(ROOT, 'work', take, `error-${i}.png`) }).catch(() => {});
  await rec.stop().catch(() => {});
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(ROOT, 'work', take, 'log.txt'), rec.log.join('\n'));
  await rec.close();
}
