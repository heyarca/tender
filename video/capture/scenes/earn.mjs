// Generate real provider earnings for s08 (off camera): API key on a demo account -> paid requests on the
// highest-bid fixture-backed market, <= 600 requests at <= 5/s, until its winner has >= $0.01 payable.
// The key secret stays in memory and is never printed.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE, sleep } from '../lib/rec.mjs';

const [accountTake = 's05_s06', marketId = 'lithium-carbonate'] = process.argv.slice(2);
const { tender_account } = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', accountTake, 'account.json'), 'utf8'));
const cookie = `tender_account=${tender_account}`;
const market = await (await fetch(`${SITE}/api/v1/markets/${marketId}`)).json();
const winner = market.routing.active_provider;
const bid = market.providers.find((p) => p.id === winner).bid_per_million;
console.log(`market ${marketId} winner ${winner} at $${bid}/M; contract ${market.contract_url}`);
const payouts = async () => (await (await fetch(`${SITE}/api/payouts`)).json()).earnings.find((e) => e.providerId === winner);
let e = await payouts();
console.log('before', JSON.stringify(e));
const needMicros = 10000 - (e?.unpaidMicros ?? 0);
const planned = Math.min(600, Math.ceil(needMicros / bid) + 6);
console.log('planned requests', planned);
const created = await fetch(`${SITE}/api/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ label: 'demo video earnings' }) });
const key = await created.json();
if (!created.ok || !key.secret) throw new Error('key create failed ' + created.status);
console.log('key created, prefix', key.prefix);
let ok = 0, fail = 0;
const providers = {};
for (let i = 0; i < planned; i++) {
  const t = Date.now();
  const r = await fetch(SITE + market.contract_url, { headers: { Authorization: `Bearer ${key.secret}` } });
  const p = r.headers.get('tender-provider');
  providers[p] = (providers[p] ?? 0) + 1;
  if (r.ok) ok++; else { fail++; if (fail < 4) console.log('fail', r.status, (await r.text()).slice(0, 160)); }
  if ((i + 1) % 50 === 0) console.log(`${i + 1} sent, ok ${ok}, fail ${fail}`, JSON.stringify(providers));
  const wait = 210 - (Date.now() - t);
  if (wait > 0) await sleep(wait);
}
e = await payouts();
console.log('after', JSON.stringify(e), 'ok', ok, 'fail', fail, JSON.stringify(providers));
fs.writeFileSync(path.join(ROOT, 'work', 'earn.json'), JSON.stringify({ marketId, winner, bid, planned, ok, fail, providers, after: e, keyPrefix: key.prefix }, null, 1));
