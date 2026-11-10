#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTender, DEFAULT_BASE_URL } from "../index.js";
import { runStdioServer, TOOLS } from "../lib/mcp.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
const AGENT_BLOCK = readFileSync(join(here, "..", "AGENT.md"), "utf8").trim();
const BEGIN = "<!-- tender:begin -->";
const END = "<!-- tender:end -->";

const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[22m` : s);
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[22m` : s);
const lime = (s) => (process.stdout.isTTY ? `\x1b[38;2;200;255;0m${s}\x1b[39m` : s);

// Flags that never take a value, so `--paypal init` keeps `init` as the command.
const BOOLEAN_FLAGS = new Set(["help", "version", "no-mcp", "paypal"]);

function parseArgs(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const k = eq === -1 ? a.slice(2) : a.slice(2, eq);
      const v = eq === -1 ? undefined : a.slice(eq + 1);
      if (BOOLEAN_FLAGS.has(k)) flags[k] = true;
      else flags[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : true);
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
    const name = file.replace(`${cwd}/`, "");
    if (next === current) {
      console.log(`${dim("·")} ${name} is up to date`);
      continue;
    }
    writeFileSync(file, next);
    console.log(`${lime("✓")} ${existing.includes(file) ? "Updated" : "Created"} ${name}`);
  }
}

// MCP configs for editor agents. Each entry: file, the key that holds servers, and how one server is written.
const MCP_TARGETS = [
  { file: ".mcp.json", client: "Claude Code", key: "mcpServers", entry: (server) => server },
  { file: ".cursor/mcp.json", client: "Cursor", key: "mcpServers", entry: (server) => server },
  { file: ".vscode/mcp.json", client: "VS Code", key: "servers", entry: (server) => ({ type: "stdio", ...server }) },
];

function mcpServers({ baseUrl, paypal }) {
  const tenderArgs = ["-y", "@heyarca/tender@latest", "mcp"];
  if (baseUrl) tenderArgs.push("--base-url", baseUrl);
  const servers = { tender: { command: "npx", args: tenderArgs } };
  // PayPal's official MCP server (npm @paypal/mcp). It reads PAYPAL_ACCESS_TOKEN from the environment,
  // so no secret is written to the project.
  if (paypal) servers.paypal = { command: "npx", args: ["-y", "@paypal/mcp", "--tools=all"], env: { PAYPAL_ENVIRONMENT: "SANDBOX" } };
  return servers;
}

/** Merge Tender (and optionally PayPal) into each editor's MCP config. Existing servers are never removed or changed. */
function installMcpConfigs(cwd, options) {
  const servers = mcpServers(options);
  for (const target of MCP_TARGETS) {
    const file = join(cwd, target.file);
    const label = `${target.file} ${dim(`(${target.client})`)}`;
    let config = {};
    if (existsSync(file)) {
      const text = readFileSync(file, "utf8");
      try {
        config = text.trim() ? JSON.parse(text) : {};
      } catch {
        config = null;
      }
      if (config === null || typeof config !== "object" || Array.isArray(config) ||
          (config[target.key] !== undefined && (typeof config[target.key] !== "object" || config[target.key] === null || Array.isArray(config[target.key])))) {
        console.log(`${dim("!")} Skipped ${label}: the file is not plain JSON with a "${target.key}" object. Add this by hand:`);
        const snippet = Object.fromEntries(Object.entries(servers).map(([name, server]) => [name, target.entry(server)]));
        console.log(JSON.stringify({ [target.key]: snippet }, null, 2));
        continue;
      }
    }
    const existed = existsSync(file);
    const current = { ...(config[target.key] ?? {}) };
    const added = [];
    for (const [name, server] of Object.entries(servers)) {
      if (current[name] !== undefined) continue;
      current[name] = target.entry(server);
      added.push(name);
    }
    if (!added.length) {
      console.log(`${dim("·")} ${label} already has ${Object.keys(servers).join(" and ")}`);
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ ...config, [target.key]: current }, null, 2)}\n`);
    console.log(`${lime("✓")} ${existed ? "Updated" : "Created"} ${label}: added ${added.join(", ")}`);
  }
}

function help() {
  console.log(`${bold("tender")} ${dim(`v${pkg.version}`)}: let your agent buy API access on Tender.

${bold("Usage")}
  npx @heyarca/tender [command] [options]

${bold("Commands")}
  init                Add Tender instructions to AGENTS.md / CLAUDE.md and the Tender MCP server to
                      .mcp.json, .cursor/mcp.json, and .vscode/mcp.json (default)
  mcp                 Run the Tender MCP server on stdio (for Claude Code, Cursor, VS Code, ...)
  markets             List every market
  categories          List groups and categories with market counts
  contracts           List contracts (the API shapes markets implement)
  market <id>         Show provider bids and the routing decision for a market
  quote <id>          Ask a market's contract for a price (returns the x402 payment requirements)

${bold("Policy options")} ${dim("(market, quote)")}
  --max-price <usd/1M req>   --max-p95-ms <ms>   --max-data-age-ms <ms>
  --min-success-rate <0..1>  --preference lowest-cost|lowest-latency|freshest-data   --pin <provider>

${bold("Init options")}
  --no-mcp           Do not write MCP configs
  --paypal           Also add PayPal's MCP server (@paypal/mcp; set PAYPAL_ACCESS_TOKEN in your environment)

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
  const baseUrl = typeof flags["base-url"] === "string" ? flags["base-url"] : undefined;

  if (command === "mcp") {
    // stdout carries only MCP messages from here on.
    runStdioServer({ baseUrl, version: pkg.version });
    return;
  }

  const tender = createTender({ baseUrl });

  if (command === "init") {
    console.log(`${lime("■")} ${bold("Tender")} ${dim("· the execution market for APIs")}\n`);
    installAgentInstructions(process.cwd());
    if (!flags["no-mcp"]) {
      installMcpConfigs(process.cwd(), { baseUrl, paypal: Boolean(flags.paypal) });
      console.log(`\nMCP tools: ${TOOLS.map((t) => t.name).join(", ")}. Restart your editor's agent to load them.`);
      if (flags.paypal) console.log(`PayPal MCP needs ${bold("PAYPAL_ACCESS_TOKEN")} in your environment (sandbox by default).`);
    }
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
      { label: "CATEGORY", get: (m) => m.category?.label ?? "" },
      { label: "PROVIDERS", get: (m) => m.provider_count },
      { label: "CONTRACT", get: (m) => m.contract },
    ]);
    return;
  }
  if (command === "categories") {
    const groups = await tender.categories();
    const rows = groups.flatMap((g) => g.categories.map((c) => ({ group: g.label, ...c })));
    table(rows, [
      { label: "GROUP", get: (r) => r.group },
      { label: "CATEGORY", get: (r) => r.label },
      { label: "ID", get: (r) => r.id },
      { label: "MARKETS", get: (r) => r.market_count },
    ]);
    return;
  }
  if (command === "contracts") {
    const contracts = await tender.contracts();
    table(contracts, [
      { label: "CONTRACT", get: (c) => c.id },
      { label: "PATH", get: (c) => c.path },
      { label: "PARAMS", get: (c) => c.params.map((p) => p.key).join(", ") },
      { label: "MARKETS", get: (c) => c.markets.length },
    ]);
    return;
  }
  if (command === "market") {
    if (!args[1]) throw new Error("Usage: tender market <id>");
    const m = await tender.market(args[1], policyFrom(flags));
    console.log(`${bold(m.name)} ${dim(m.contract_url ?? m.identifier)}\n`);
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
