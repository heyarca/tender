#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTender, DEFAULT_BASE_URL } from "../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
const AGENT_BLOCK = readFileSync(join(here, "..", "AGENT.md"), "utf8").trim();
const BEGIN = "<!-- tender:begin -->";
const END = "<!-- tender:end -->";

const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[22m` : s);
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[22m` : s);
const lime = (s) => (process.stdout.isTTY ? `\x1b[38;2;200;255;0m${s}\x1b[39m` : s);

function parseArgs(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      flags[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : true);
    } else if (a === "-h") flags.help = true;
    else if (a === "-v") flags.version = true;
    else args.push(a);
  }
  return { args, flags };
}

function policyFrom(flags) {
  const num = (v) => (v === undefined || v === true ? undefined : Number(v));
  return {
    maxPrice: num(flags["max-price"]),
    maxP95LatencyMs: num(flags["max-p95-ms"]),
    maxDataAgeMs: num(flags["max-data-age-ms"]),
    minSuccessRate: num(flags["min-success-rate"]),
    preference: typeof flags.preference === "string" ? flags.preference : undefined,
    pin: typeof flags.pin === "string" ? flags.pin : undefined,
  };
}

function table(rows, columns) {
  const widths = columns.map((c) => Math.max(c.label.length, ...rows.map((r) => String(c.get(r)).length)));
  const line = (cells) => cells.map((cell, i) => String(cell).padEnd(widths[i])).join("  ");
  console.log(bold(line(columns.map((c) => c.label))));
  for (const r of rows) console.log(line(columns.map((c) => c.get(r))));
}

function installAgentInstructions(cwd) {
  const targets = ["AGENTS.md", "CLAUDE.md"].map((f) => join(cwd, f));
  const existing = targets.filter((f) => existsSync(f));
  const files = existing.length ? existing : [targets[0]];
  for (const file of files) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    let next;
    if (current.includes(BEGIN) && current.includes(END)) {
      next = current.slice(0, current.indexOf(BEGIN)) + AGENT_BLOCK + current.slice(current.indexOf(END) + END.length);
    } else {
      next = (current.trimEnd() ? `${current.trimEnd()}\n\n` : "") + `${AGENT_BLOCK}\n`;
    }
    writeFileSync(file, next);
    console.log(`${lime("✓")} ${existing.includes(file) ? "Updated" : "Created"} ${file.replace(`${cwd}/`, "")}`);
  }
}

function help() {
  console.log(`${bold("tender")} ${dim(`v${pkg.version}`)}: let your agent buy API access on Tender.

${bold("Usage")}
  npx @heyarca/tender [command] [options]

${bold("Commands")}
  init                Add Tender instructions for coding agents to AGENTS.md / CLAUDE.md (default)
  markets             List every market
  market <id>         Show provider bids and the routing decision for a market
  quote <id>          Ask a market's contract for a price (returns the x402 payment requirements)

${bold("Policy options")} ${dim("(market, quote)")}
  --max-price <usd/1M req>   --max-p95-ms <ms>   --max-data-age-ms <ms>
  --min-success-rate <0..1>  --preference lowest-cost|lowest-latency|freshest-data   --pin <provider>

${bold("Other")}
  --base-url <url>   API origin (default ${DEFAULT_BASE_URL})
  -h, --help         Show help      -v, --version   Show version
`);
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  if (flags.version) return console.log(pkg.version);
  if (flags.help) return help();
  const command = args[0] ?? "init";
  const tender = createTender({ baseUrl: typeof flags["base-url"] === "string" ? flags["base-url"] : undefined });

  if (command === "init") {
    console.log(`${lime("■")} ${bold("Tender")} ${dim("· the execution market for APIs")}\n`);
    installAgentInstructions(process.cwd());
    const markets = await tender.markets().catch(() => []);
    if (markets.length) console.log(`\n${markets.length} markets are open. Run ${bold("npx @heyarca/tender markets")} to list them.`);
    console.log(`Your agent can now move API integrations to Tender. Browse markets at ${tender.baseUrl}/markets`);
    return;
  }
  if (command === "markets") {
    const markets = await tender.markets();
    table(markets, [
      { label: "ID", get: (m) => m.id },
      { label: "MARKET", get: (m) => m.name },
      { label: "PROVIDERS", get: (m) => m.provider_count },
      { label: "CONTRACT", get: (m) => m.contract },
    ]);
    return;
  }
  if (command === "market") {
    if (!args[1]) throw new Error("Usage: tender market <id>");
    const m = await tender.market(args[1], policyFrom(flags));
    console.log(`${bold(m.name)} ${dim(m.identifier)}\n`);
    table(m.providers ?? [], [
      { label: "PROVIDER", get: (p) => p.name },
      { label: "BID /M REQ", get: (p) => `$${Number(p.bid_per_million).toFixed(2)}` },
      { label: "P95", get: (p) => `${p.p95_latency_ms} ms` },
      { label: "DATA AGE", get: (p) => `${p.data_age_ms} ms` },
      { label: "SUCCESS", get: (p) => `${(p.success_rate * 100).toFixed(2)}%` },
      { label: "STATUS", get: (p) => p.evaluation?.status ?? "" },
    ]);
    const active = m.routing?.active_provider ?? m.routing?.provider;
    if (active) console.log(`\nRouting to ${bold(active)}`);
    return;
  }
  if (command === "quote") {
    if (!args[1]) throw new Error("Usage: tender quote <id>");
    const result = await tender.request(args[1], policyFrom(flags));
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  help();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`tender: ${error.message}`);
  process.exitCode = 1;
});
