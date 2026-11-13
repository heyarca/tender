// One-command re-record: bun run.mjs <scene>
// Records the scene in a fresh Chrome profile against production, then rebuilds its clips + JSON in clips/.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SCENES = {
  s01_open: { script: 'scenes/s01_open.mjs', take: 's01_open', builds: ['s01_open'] },
  s02_markets: { script: 'scenes/s02_markets.mjs', take: 's02_markets', builds: ['s02_markets'] },
  s03_routing: { script: 'scenes/s03_routing.mjs', take: 's03_routing', builds: ['s03_routing'] },
  s04_checkout: { script: 'scenes/s04_checkout.mjs', take: 's04_checkout', builds: ['s04_checkout'] },
  s05_s06: { script: 'scenes/s05_s06_ask_vault.mjs', take: 's05_s06', builds: ['s05_ask:0:split_s05_s06', 's06_vault:split_s05_s06:'] },
  s07_bidding: { script: 'scenes/s07_bidding.mjs', take: 's07_bidding', builds: ['s07_bidding'] },
  s08_payouts: { script: 'scenes/s08_payouts.mjs', take: 's08_payouts', builds: ['s08_payouts'] },
  s09_agents: { script: 'scenes/s09_agents.mjs', take: 's09_agents', builds: ['s09_agents'] },
};
SCENES.s05_ask = SCENES.s06_vault = SCENES.s05_s06;

const name = process.argv[2];
const s = SCENES[name];
if (!s) {
  console.error('usage: bun run.mjs <' + Object.keys(SCENES).join('|') + '>');
  process.exit(2);
}
const cwd = import.meta.dirname;
const run = (args) => spawnSync('bun', args, { cwd, stdio: 'inherit' }).status;
if (run([s.script]) !== 0) process.exit(1);
process.exit(run([path.join('lib', 'build.mjs'), s.take, ...s.builds]) ?? 1);
