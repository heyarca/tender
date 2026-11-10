#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTender, DEFAULT_BASE_URL, formatMicros } from "../index.js";
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
      else {
        const value = v ?? (argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : true);
        // --param repeats: --param text=hello --param units=metric
        if (k === "param") (flags.param ??= []).push(value);
        else flags[k] = value;
      }
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

function paramsFrom(flags) {
  const params = {};
  for (const pair of flags.param ?? []) {
    const eq = typeof pair === "string" ? pair.indexOf("=") : -1;
    if (eq < 1) throw new Error(`--param needs key=value, got "${pair === true ? "" : pair}"`);
    params[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return params;
}

/** CLI message for a failed paid call, matching the MCP tool errors. */
function paidCallError(error, baseUrl, id) {
  const code = error?.code ?? error?.body?.error?.code;
  if (error?.status === 404 && id) return new Error(`Unknown market "${id}". Run tender markets to see market ids.`);
  if (code === "insufficient_credits") return new Error(`Your Tender balance is too low. Add funds at ${baseUrl}/account`);
  if (code === "invalid_api_key") return new Error(`TENDER_API_KEY is unknown or revoked. Create a key at ${baseUrl}/account`);
  if (code === "no_eligible_provider" || error?.status === 409) return new Error("No provider meets this policy");
  return error;
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

// MCP configs for editor agents. Each entry: file, the key that holds servers, how one server is written,
// and how the client references an environment variable (so the API key is never written to disk):
// Claude Code expands ${VAR} in .mcp.json; Cursor and VS Code expand ${env:VAR}.
const MCP_TARGETS = [
  { file: ".mcp.json", client: "Claude Code", key: "mcpServers", entry: (server) => server, envRef: (name) => `\${${name}}` },
  { file: ".cursor/mcp.json", client: "Cursor", key: "mcpServers", entry: (server) => server, envRef: (name) => `\${env:${name}}` },
  { file: ".vscode/mcp.json", client: "VS Code", key: "servers", entry: (server) => ({ type: "stdio", ...server }), envRef: (name) => `\${env:${name}}` },
];

const API_KEY_ENV = "TENDER_API_KEY";

function mcpServers({ baseUrl, paypal }, envRef) {
  const tenderArgs = ["-y", "@heyarca/tender@latest", "mcp"];
  if (baseUrl) tenderArgs.push("--base-url", baseUrl);
  const servers = { tender: { command: "npx", args: tenderArgs, env: { [API_KEY_ENV]: envRef(API_KEY_ENV) } } };
  // PayPal's official MCP server (npm @paypal/mcp). It reads PAYPAL_ACCESS_TOKEN from the environment,
  // so no secret is written to the project.
  if (paypal) servers.paypal = { command: "npx", args: ["-y", "@paypal/mcp", "--tools=all"], env: { PAYPAL_ENVIRONMENT: "SANDBOX" } };
  return servers;
}

/**
 * Merge Tender (and optionally PayPal) into each editor's MCP config. Existing servers are never removed;
 * an existing stdio `tender` server only gains the TENDER_API_KEY env reference when it has none.
 */
function installMcpConfigs(cwd, options) {
  for (const target of MCP_TARGETS) {
    const servers = mcpServers(options, target.envRef);
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
    const changes = [];
    for (const [name, server] of Object.entries(servers)) {
      if (current[name] === undefined) {
        current[name] = target.entry(server);
        changes.push(`added ${name}`);
        continue;
      }
      const existing = current[name];
      if (name === "tender" && isPlainObject(existing) && typeof existing.command === "string" &&
          (existing.env === undefined || isPlainObject(existing.env)) && existing.env?.[API_KEY_ENV] === undefined) {
        current[name] = { ...existing, env: { ...(existing.env ?? {}), [API_KEY_ENV]: target.envRef(API_KEY_ENV) } };
        changes.push(`added ${API_KEY_ENV} to tender`);
      }
    }
    if (!changes.length) {
      console.log(`${dim("·")} ${label} already has ${Object.keys(servers).join(" and ")}`);
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ ...config, [target.key]: current }, null, 2)}\n`);
    console.log(`${lime("✓")} ${existed ? "Updated" : "Created"} ${label}: ${changes.join(", ")}`);
  }
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

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
  call <id>           Run one request and pay the winning bid from your Tender credits
  balance             Show your Tender credits balance

${bold("Paying with credits")} ${dim("(call, balance, and the MCP call_market tool)")}
  Add funds with PayPal and create a key at ${DEFAULT_BASE_URL}/account, then
  export ${API_KEY_ENV}=tk_...
  --param <key=value>        Extra query parameter for the contract URL (repeatable)

${bold("Policy options")} ${dim("(market, quote, call)")}
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
      console.log(`Next: create a key at ${tender.baseUrl}/account and run ${bold(`export ${API_KEY_ENV}=tk_...`)} so your agent can pay for calls.`);
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
  if (command === "call") {
    if (!args[1]) throw new Error("Usage: tender call <id> [--param key=value ...]");
    const result = await tender.callMarket(args[1], { params: paramsFrom(flags), policy: policyFrom(flags) })
      .catch((error) => { throw paidCallError(error, tender.baseUrl, args[1]); });
    const { charged_micros, balance_micros } = result.payment;
    console.log(`${bold(args[1])} served by ${bold(result.provider ?? "unknown")} · charged ${formatMicros(charged_micros ?? 0)} · balance ${formatMicros(balance_micros ?? 0)}`);
    console.log(JSON.stringify(result.data, null, 2));
    return;
  }
  if (command === "balance") {
    const account = await tender.balance().catch((error) => { throw paidCallError(error, tender.baseUrl); });
    console.log(`Balance ${bold(formatMicros(account.balance_micros))}`);
    const last = (account.ledger ?? []).slice(0, 5);
    if (last.length) {
      console.log("");
      table(last, [
        { label: "WHEN", get: (e) => e.created_at.replace("T", " ").slice(0, 19) },
        { label: "KIND", get: (e) => e.kind },
        { label: "AMOUNT", get: (e) => formatMicros(e.amount_micros) },
        { label: "MARKET", get: (e) => e.market_id ?? "" },
        { label: "PROVIDER", get: (e) => e.provider_id ?? "" },
      ]);
    }
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
