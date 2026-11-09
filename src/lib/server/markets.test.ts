import { describe, expect, it } from "vitest";
import { GET as list } from "../../app/api/v1/markets/route";
import { GET as detail } from "../../app/api/v1/markets/[market]/route";
const request = (query = "", headers?: HeadersInit) => new Request(`https://tender.example/api/v1/markets/btc-usd${query}`, { headers });
const context = (market = "btc-usd") => ({ params: Promise.resolve({ market }) });
describe("market handlers", () => {
  it("lists both markets with all provider counts", async () => {
    const data = await list().json();
    expect(data.markets.map((m: { id: string }) => m.id)).toEqual(["sf-weather", "btc-usd"]);
    expect(data.markets.every((m: { provider_count: number }) => m.provider_count === 8)).toBe(true);
  });
  it("uses shared ranking and exclusions", async () => {
    const response = await detail(request(), context());
    const data = await response.json();
    expect(data.routing.active_provider).toBe("parasail");
    expect(data.providers.find((p: { id: string }) => p.id === "novita").evaluation.status).toBe("too-slow");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("honors header preference and query precedence", async () => {
    const data = await (await detail(request("?preference=freshest-data", { "Tender-Preference": "lowest-latency" }), context())).json();
    expect(data.routing.active_provider).toBe("baseten");
  });
  it("reports no route in discovery without making a paid request", async () => {
    const data = await (await detail(request("?max_price=0"), context())).json();
    expect(data.routing.active_provider).toBeNull();
    expect(data.routing.ranking).toEqual([]);
  });
  it("keeps a failing pinned provider and reports violations", async () => {
    const data = await (await detail(request("?pin=novita"), context())).json();
    expect(data.routing.active_provider).toBe("novita");
    expect(data.routing.policy_violation).toBe(true);
    expect(data.routing.policy_violations[0]).toContain("310");
  });
  it("rejects unknown market, unknown pin, and invalid policies", async () => {
    expect((await detail(request(), context("missing"))).status).toBe(404);
    expect((await detail(request("?pin=together"), context())).status).toBe(400);
    expect((await detail(request("?max_price=-1"), context())).status).toBe(400);
  });
});
