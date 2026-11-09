import { afterEach, describe, expect, it, vi } from "vitest";
import { LIVE_DEFAULTS } from "./live-defaults";
import { runLive } from "./live";
import { POST as mcp } from "@/app/api/mcp/route";

const BOOK: Record<string, unknown> = {
  "api.exchange.coinbase.com": { bid: "100", ask: "102", time: new Date().toISOString() },
  "api.kraken.com": { result: { XXBTZUSD: { b: ["100.5"], a: ["101.5"] } } },
  "www.bitstamp.net": { bid: "99", ask: "101", timestamp: String(Math.floor(Date.now() / 1000)) },
  "api.gemini.com": { bid: "100", ask: "100", volume: { timestamp: Date.now() } },
  "www.okx.com": { data: [{ bidPx: "500", askPx: "500", ts: String(Date.now()) }] }, // outlier
  "api.coingecko.com": { bitcoin: { usd: 101, last_updated_at: Math.floor(Date.now() / 1000) } },
};

function mockFetch() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const host = new URL(url).host;
    if (!(host in BOOK)) return new Response("down", { status: 503 }); // binance-us fails
    return Response.json(BOOK[host]);
  }));
}
afterEach(() => vi.unstubAllGlobals());

describe("live markets", () => {
  it("probes every provider, excludes failures, reports consensus and outliers", async () => {
    mockFetch();
    const r = await runLive("btc-usd", LIVE_DEFAULTS["btc-usd"]);
    const byId = Object.fromEntries(r.providers.map((p) => [p.id, p]));
    expect(byId["binance-us"].status).toBe("unavailable");
    expect(byId["binance-us"].measured.error).toBe("HTTP 503");
    expect(r.consensus.providers_ok).toBe(6);
    expect(r.consensus.median).toBe(101);
    expect(byId.okx.measured.deviation_from_median).toBe(399);
    expect(r.served_by?.provider).not.toBe("binance-us");
    expect(r.served_by?.policy_violation).toBe(false);
  });

  it("pinned mode serves the pin and flags a policy violation instead of rerouting", async () => {
    mockFetch();
    const r = await runLive("btc-usd", { ...LIVE_DEFAULTS["btc-usd"], mode: { kind: "pinned", providerId: "binance-us" } });
    expect(r.served_by).toMatchObject({ provider: "binance-us", value: null, route_reason: "pinned", policy_violation: true });
  });

  it("MCP lists tools and runs tender_call; bad args are JSON-RPC errors", async () => {
    mockFetch();
    const rpc = async (body: unknown) => (await mcp(new Request("http://x/api/mcp", { method: "POST", body: JSON.stringify(body) }))).json();
    const list = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(["tender_markets", "tender_call"]);
    const call = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "tender_call", arguments: { market: "btc-usd" } } });
    expect(call.result.structuredContent.consensus.providers_ok).toBe(6);
    const bad = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "tender_call", arguments: { market: "btc-usd", pin: "nope" } } });
    expect(bad.error.code).toBe(-32602);
  });
});
