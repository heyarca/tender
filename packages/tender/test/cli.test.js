import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTender } from "../index.js";
import { createToolHandlers } from "../lib/mcp.js";
import { PROVIDERS } from "../../../src/lib/registry/providers.ts";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/tender.js", import.meta.url));
const providers = PROVIDERS.filter((provider) => ["fernline", "arca-labs", "the-zone-bio"].includes(provider.id));
let server;
let baseUrl;
let requests;
let active;
let ledger;
let metadataStatus;
const data = { condition: "Overcast" };
const payment = { charged_micros: 18, balance_micros: 999982 };

beforeEach(async () => {
  requests = [];
  active = "fernline";
  ledger = [];
  metadataStatus = 200;
  server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    requests.push(url.pathname);
    response.setHeader("Content-Type", "application/json");
    if (url.pathname.startsWith("/api/v1/markets/")) {
      response.statusCode = metadataStatus;
      response.end(JSON.stringify(metadataStatus === 200 ? {
        id: "sf-weather", name: "San Francisco Weather",
        contract_url: "/api/v1/weather/current?location=san-francisco",
        providers, routing: { active_provider: active },
      } : { error: { message: "Metadata unavailable" } }));
    } else if (url.pathname === "/api/v1/weather/current") {
      if (request.headers.authorization) {
        response.end(JSON.stringify({ provider: active, data, payment }));
      } else {
        response.statusCode = 402;
        response.setHeader("Tender-Provider", active);
        response.end(JSON.stringify({ providerId: active }));
      }
    } else if (url.pathname === "/api/account") {
      response.end(JSON.stringify({ balance_micros: 999982, ledger }));
    } else {
      response.statusCode = 404;
      response.end("{}");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function run(...args) {
  return exec("node", [cli, ...args, "--base-url", baseUrl], {
    env: { ...process.env, TENDER_API_KEY: "tk_test_cli" },
  });
}

function entry(provider, market = "sf-weather") {
  return { created_at: "2026-11-10T12:00:00.000Z", kind: provider ? "charge" : "top_up",
    amount_micros: provider ? -18 : 1000000, market_id: market, provider_id: provider };
}

describe("CLI provider display names", () => {
  it.each(providers)("uses the registry spelling of $name for market and call", async ({ id, name }) => {
    active = id;
    const market = await run("market", "sf-weather");
    expect(market.stdout).toContain(`Routing to ${name}`);
    expect(requests).toEqual(["/api/v1/markets/sf-weather"]);
    requests.length = 0;
    const call = await run("call", "sf-weather");
    expect(call.stdout).toContain(`served by ${name} · charged $0.000018 · balance $0.999982`);
    expect(JSON.parse(call.stdout.slice(call.stdout.indexOf("\n") + 1))).toEqual(data);
    expect(requests).toEqual(["/api/v1/markets/sf-weather", "/api/v1/weather/current"]);
  });

  it("shows ledger names with one lookup per distinct displayed market, not per row", async () => {
    ledger = [entry("fernline"), entry("arca-labs"), entry("the-zone-bio", "btc-usd"),
      entry("deleted-provider"), entry(null, null), entry("fernline", "hidden-market")];
    const result = await run("balance");
    for (const { name } of providers) expect(result.stdout).toContain(name);
    expect(result.stdout).toContain("deleted-provider");
    expect(result.stdout).toContain("top_up");
    expect(result.stdout).not.toContain("null");
    expect(requests.filter((path) => path.includes("/markets/")).sort()).toEqual([
      "/api/v1/markets/btc-usd", "/api/v1/markets/sf-weather",
    ]);
  });

  it.each([404, 503])("keeps ledger rows when market metadata returns %i", async (status) => {
    ledger = [entry("fernline")];
    metadataStatus = status;
    const result = await run("balance");
    expect(result.stdout).toContain("fernline");
    expect(result.stdout).toContain("-$0.000018");
    if (status === 503) expect(result.stderr).toContain("Could not load provider names");
    else expect(result.stderr).toBe("");
  });

  it("does not fetch metadata for empty ledgers or top-ups", async () => {
    await run("balance");
    ledger = [entry(null, null)];
    await run("balance");
    expect(requests).toEqual(["/api/account", "/api/account"]);
  });

  it("falls back to an unknown provider ID without changing quote JSON", async () => {
    active = "deleted-provider";
    expect((await run("market", "sf-weather")).stdout).toContain("Routing to deleted-provider");
    expect((await run("call", "sf-weather")).stdout).toContain("served by deleted-provider");
    const quote = JSON.parse((await run("quote", "sf-weather")).stdout);
    expect(quote.provider).toBe(active);
    expect(quote.paymentRequired).toEqual({ providerId: active });
  });

  it("preserves SDK and MCP IDs while adding the SDK display name", async () => {
    const tender = createTender({ baseUrl, apiKey: "tk_test_cli" });
    const result = await tender.callMarket("sf-weather");
    expect(result).toEqual({ status: 200, provider: "fernline", providerName: "Fernline",
      data, payment, response: { provider: "fernline", data, payment } });
    expect(requests).toHaveLength(2);
    const handlers = createToolHandlers(tender);
    const call = await handlers.call_market({ id: "sf-weather" });
    expect(call.provider).toBe("fernline");
    expect(call).not.toHaveProperty("providerName");
    ledger = [entry("fernline")];
    expect((await handlers.get_balance()).recent[0].provider).toBe("fernline");
    active = "deleted-provider";
    expect((await tender.callMarket("sf-weather")).providerName).toBeNull();
  });
});
