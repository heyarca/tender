// s04_checkout: Add funds -> $10 -> PayPal Checkout popup -> balance $10.00 -> Run with credits -> /account transactions.
import fs from 'node:fs';
import path from 'node:path';
import { Recorder, sleep, rand, ROOT } from '../lib/rec.mjs';
import { gotoSettled, scrollIntoView, paypalApprove } from '../lib/flows.mjs';

const scene = process.argv[2] || 's04_checkout';
const rec = new Recorder(scene, { url: 'https://tender.heyarca.app/markets/sf-weather' });
const page = await rec.launch();
try {
  await gotoSettled(rec, '/markets/sf-weather', { settle: 2500 });
  await page.mouse.move(980, 520);
  rec.mouse.main = { x: 980, y: 520 };
  await rec.start();
  await rec.hold(1500);
  const chip = page.locator('[data-slot=balance-chip]').first();
  await rec.mark('balance_chip_before', chip);
  await rec.click(chip);
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  const ppButton = page.locator('paypal-button, [data-slot=paypal-button]').first();
  rec.waitStart('paypal_sdk');
  await ppButton.waitFor({ state: 'visible', timeout: 45000 });
  await sleep(1200);
  rec.waitEnd('paypal_sdk');
  await rec.mark('add_funds_dialog', dialog);
  const ten = dialog.getByRole('radio', { name: '$10', exact: true }).or(dialog.getByRole('button', { name: '$10', exact: true })).first();
  if (await ten.count()) {
    await rec.hover(ten);
    await rec.mark('amount_10', ten);
  }
  await rec.hold(1300);
  await rec.mark('paypal_button', ppButton);
  const popupWait = rec.waitPopup(45000);
  await rec.click(ppButton, { oy: 0.5, jitter: 0.04 });
  const popup = await popupWait;
  await rec.mark('popup_open');
  const label = await paypalApprove(rec, popup);
  rec.note('approved via ' + label);
  const success = page.locator('[data-slot=add-funds-success]');
  rec.waitStart('capture');
  await success.waitFor({ state: 'visible', timeout: 90000 });
  rec.waitEnd('capture');
  await sleep(400);
  await rec.mark('add_funds_success', success);
  await rec.hold(2000);
  await rec.click(dialog.getByRole('button', { name: 'Done' }));
  await sleep(900);
  await rec.mark('balance_chip_after', chip);
  rec.note('chip after: ' + (await chip.innerText()).replace(/\s+/g, ' '));
  await rec.hold(1600);
  // Run with credits
  const credits = page.locator('#credits');
  await rec.moveTo(900, 600);
  await scrollIntoView(rec, credits, { targetY: 120, minMs: 1400, maxMs: 2000 });
  await rec.hold(1200);
  await rec.mark('credits_card', credits);
  const run = page.locator('[data-slot=run-with-credits]');
  const balance = page.locator('#credits [data-slot=credits-balance]');
  const before = await balance.innerText();
  await rec.click(run);
  rec.waitStart('run');
  await page.waitForFunction((prev) => {
    const el = document.querySelector('#credits [data-slot=credits-balance]');
    const btn = document.querySelector('#credits [data-slot=run-with-credits]');
    return el && el.textContent !== prev && btn && !btn.disabled;
  }, before, { timeout: 45000 });
  rec.waitEnd('run');
  await sleep(500);
  await rec.mark('credits_result', page.locator('#credits [data-slot=credits-result]').first());
  await rec.mark('credits_balance', balance);
  rec.note('balance ' + before + ' -> ' + (await balance.innerText()));
  await rec.moveTo(1180, 560);
  await rec.hold(2600);
  // Account page: transactions
  const accountLink = page.getByRole('navigation').getByRole('link', { name: 'Account' }).first();
  const navAccount = (await accountLink.count()) ? accountLink : page.getByRole('link', { name: 'Account' }).first();
  await rec.click(navAccount);
  await page.waitForURL(/\/account/, { timeout: 30000 });
  const tx = page.locator('[data-slot=transactions]').first();
  await tx.waitFor({ state: 'visible', timeout: 30000 });
  await sleep(1300);
  await rec.mark('account_balance', page.locator('[data-slot=account-balance]').first());
  await rec.hold(1500);
  await rec.moveTo(820, 560);
  const txHead = page.getByRole('heading', { name: 'Transactions' }).first();
  await scrollIntoView(rec, txHead, { targetY: 150, minMs: 1300, maxMs: 1800 });
  await sleep(500);
  await rec.mark('transactions_grid', tx);
  const rows = tx.locator('[role=row]');
  const n = await rows.count();
  for (let i = 0; i < Math.min(n, 4); i++) {
    const txt = (await rows.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90);
    rec.note('tx row ' + i + ': ' + txt);
    if (/top-up|PayPal|Added|Charge|Request|SF Weather|San Francisco/i.test(txt)) await rec.mark('tx_row_' + i, rows.nth(i));
  }
  await rec.moveTo(760, 520);
  await rec.hold(3000);
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
