/**
 * Stateless MCP server (Streamable HTTP, JSON responses). Agents add `<origin>/api/mcp` and get:
 *   tender_markets — the live markets and their providers
 *   tender_call    — one routed call: probes every provider, applies the policy, returns the served value
 */
import { LIVE_MARKETS, runLive, type LiveMarketId } from "@/lib/server/live";
import { LIVE_DEFAULTS } from "@/lib/server/live-defaults";
import { PREFERENCES } from "@/lib/tender";
import type { RoutingPolicy } from "@/lib/tender/types";

const TOOLS = [
  {
    name: "tender_markets",
    description: "List Tender live markets: the normalized contract, unit, providers and default routing policy.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "tender_call",
    description: "Call a Tender market. Every provider is fetched in parallel and measured (latency, data age, success rate); the policy picks the provider that serves the result. Returns the served value, the cross-provider median and spread, and why each provider qualified or not.",
    inputSchema: {
      type: "object",
      required: ["market"],
      additionalProperties: false,
      properties: {
        market: { type: "string", enum: Object.keys(LIVE_MARKETS) },
        preference: { type: "string", enum: PREFERENCES },
        max_p95_ms: { type: "number", minimum: 0 },
        max_data_age_ms: { type: "number", minimum: 0 },
        min_success_rate: { type: "number", minimum: 0, maximum: 1 },
        pin: { type: "string", description: "Provider id to force (reported even if it fails policy)" },
      },
    },
  },
];

type Args = { market?: string; preference?: string; max_p95_ms?: number; max_data_age_ms?: number; min_success_rate?: number; pin?: string };

async function callTool(name: string, args: Args) {
  if (name === "tender_markets") {
    return Object.entries(LIVE_MARKETS).map(([id, m]) => ({ id, contract: m.contract, unit: m.unit, providers: m.providers.map((p) => ({ id: p.id, name: p.name })), default_policy: LIVE_DEFAULTS[id as LiveMarketId] }));
  }
  if (name !== "tender_call") throw new RpcError(-32602, `Unknown tool ${name}`);
  if (!args.market || !(args.market in LIVE_MARKETS)) throw new RpcError(-32602, `market must be one of ${Object.keys(LIVE_MARKETS).join(", ")}`);
  const id = args.market as LiveMarketId;
  if (args.preference !== undefined && !PREFERENCES.includes(args.preference as RoutingPolicy["preference"])) throw new RpcError(-32602, "bad preference");
  if (args.pin !== undefined && !LIVE_MARKETS[id].providers.some((p) => p.id === args.pin)) throw new RpcError(-32602, "pin is not a provider in this market");
  for (const k of ["max_p95_ms", "max_data_age_ms", "min_success_rate"] as const) {
    const v = args[k];
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < 0 || (k === "min_success_rate" && v > 1))) throw new RpcError(-32602, `bad ${k}`);
  }
  const d = LIVE_DEFAULTS[id];
  const policy: RoutingPolicy = {
    ...d,
    ...(args.preference ? { preference: args.preference as RoutingPolicy["preference"] } : {}),
    maxP95LatencyMs: args.max_p95_ms ?? d.maxP95LatencyMs,
    maxDataAgeMs: args.max_data_age_ms ?? d.maxDataAgeMs,
    minSuccessRate: args.min_success_rate ?? d.minSuccessRate,
    mode: args.pin ? { kind: "pinned", providerId: args.pin } : { kind: "auto" },
  };
  return runLive(id, policy);
}

class RpcError extends Error { constructor(public code: number, message: string) { super(message); } }

async function handle(msg: { id?: unknown; method?: string; params?: { name?: string; arguments?: Args } }) {
  switch (msg.method) {
    case "initialize":
      return { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "tender", version: "0.1.0" } };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      try {
        const out = await callTool(msg.params?.name ?? "", msg.params?.arguments ?? {});
        return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: Array.isArray(out) ? { markets: out } : out };
      } catch (e) {
        if (e instanceof RpcError) throw e;
        return { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] };
      }
    }
    default:
      throw new RpcError(-32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 }); }
  const batch = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const msg of batch as { id?: unknown; method?: string }[]) {
    if (msg?.id === undefined) continue; // notification
    try { replies.push({ jsonrpc: "2.0", id: msg.id, result: await handle(msg) }); }
    catch (e) { replies.push({ jsonrpc: "2.0", id: msg.id, error: { code: e instanceof RpcError ? e.code : -32603, message: e instanceof Error ? e.message : String(e) } }); }
  }
  if (replies.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? replies : replies[0], { headers: { "Cache-Control": "no-store" } });
}
export function GET() { return new Response("Tender MCP: POST JSON-RPC here", { status: 405, headers: { Allow: "POST" } }); }
