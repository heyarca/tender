// Reusable product flows for scenes. Credentials are read from disk and never logged.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sleep, rand, SITE } from './rec.mjs';

const ACCOUNTS = process.env.PAYPAL_SANDBOX_ACCOUNTS ?? path.join(os.homedir(), '.cache/tender-agent/paypal-sandbox-accounts.json');
export const buyer = () => JSON.parse(fs.readFileSync(ACCOUNTS, 'utf8')).buyer;

export async function gotoSettled(rec, url, { idle = true, settle = 1500 } = {}) {
  await rec.page.goto(SITE + url, { waitUntil: idle ? 'networkidle' : 'load', timeout: 60000 }).catch((e) => rec.note('goto ' + String(e).slice(0, 120)));
  await sleep(settle);
}

// Smoothly wheel-scroll so that the element's top lands at targetY (CSS px).
export async function scrollIntoView(rec, loc, { targetY = 110, minMs = 700, maxMs = 1700, target = 'main' } = {}) {
  const page = rec.pageFor(target);
  const box = await loc.boundingBox();
  if (!box) throw new Error('scrollIntoView: no box');
  const dy = Math.round(box.y - targetY);
  if (Math.abs(dy) < 4) return;
  const dur = Math.min(maxMs, Math.max(minMs, Math.abs(dy) * 1.1));
  await rec.wheel(dy, { duration: dur, target });
  await sleep(350);
  // correct residual (smooth scrolling / layout shifts)
  const b2 = await loc.boundingBox();
  const rest = Math.round(b2.y - targetY);
  if (Math.abs(rest) > 24) await rec.wheel(rest, { duration: 400, target });
  void page;
}

// PayPal sandbox popup: log in and approve. Returns when the popup closes.
// Current sandbox flow (2026-11): email + "Next" -> password + "Log In" -> review with "Pay" (#one-time-cta),
// or "Save and Continue" for Vault. A decoy #password exists on the email step; never use it there.
export async function paypalApprove(rec, popup, { reviewHold = 1800 } = {}) {
  const target = popup.label;
  const p = popup.page;
  p.setDefaultTimeout(60000);
  const creds = buyer();
  const now3 = () => Math.round(rec.t() * 1000) / 1000;
  rec.waitStart('paypal_load');
  await p.waitForLoadState('domcontentloaded').catch(() => {});
  const email = p.locator('#email');
  await email.waitFor({ state: 'visible', timeout: 60000 });
  await sleep(900);
  rec.waitEnd('paypal_load');
  await rec.mark('pp_login_page', 'body', { target, page: p });
  rec.marks.push({ t: now3(), name: 'pp_credentials_start', target });
  await rec.click(email, { target });
  await sleep(rand(200, 350));
  await rec.type(creds.email, { target, secret: true, min: 30, max: 60 });
  await sleep(450);
  await rec.click(p.getByRole('button', { name: 'Next', exact: true }), { target });
  const login = p.getByRole('button', { name: 'Log In', exact: true });
  await login.waitFor({ state: 'visible', timeout: 60000 });
  const pw = p.locator('#password');
  for (let i = 0; i < 50; i++) {
    const b = await pw.boundingBox().catch(() => null);
    if (b && b.width > 250) break;
    await sleep(200);
  }
  await sleep(700);
  await rec.click(pw, { target, ox: 0.4 });
  await sleep(rand(200, 350));
  await rec.type(creds.password, { target, secret: true, min: 30, max: 60 });
  rec.marks.push({ t: now3(), name: 'pp_credentials_end', target });
  await sleep(450);
  await rec.click(login, { target });
  rec.waitStart('paypal_login');
  const pay = p.locator('#one-time-cta, #payment-submit-btn, [data-testid="submit-button-initial"]')
    .or(p.getByRole('button', { name: /^(Pay|Pay Now|Complete Purchase|Save and Continue|Agree & Continue|Agree and Continue)$/ }))
    .first();
  await pay.waitFor({ state: 'visible', timeout: 90000 });
  await sleep(1300);
  rec.waitEnd('paypal_login');
  const label = (await pay.innerText().catch(() => '')).trim();
  rec.note('paypal pay button: ' + label);
  await rec.mark('pp_review', 'body', { target, page: p });
  await rec.mark('pp_submit', pay, { target, page: p });
  const pb = await pay.boundingBox();
  if (pb) await rec.moveTo(pb.x + pb.width * 0.5, pb.y - 120, { target });
  await sleep(reviewHold);
  await rec.click(pay, { target, jitter: 0.03 });
  rec.waitStart('paypal_close');
  await p.waitForEvent('close', { timeout: 120000 }).catch((e) => rec.note('popup not closed ' + String(e).slice(0, 80)));
  rec.waitEnd('paypal_close');
  return label;
}
