/**
 * Tender MCP server over stdio. Zero dependencies.
 *
 * Transport: newline-delimited JSON-RPC 2.0 on stdin/stdout (UTF-8). Nothing but protocol messages
 * is written to stdout; diagnostics go to stderr.
 */
import { createInterface } from "node:readline";
import { createTender } from "../index.js";

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const REQUEST_TIMEOUT_MS = 20_000;
const DETAIL_CONCURRENCY = 8;

const INSTRUCTIONS =
  "Use these tools when the user needs third-party API data (weather, prices, translation, geocoding, and more) " +
  "or wants to replace a direct API integration. Tender is a market where providers bid to serve each request. " +
  "Find a market with list_markets (or list_categories and list_contracts), check bids and the routing decision " +
  "for a policy with get_market, and get the x402 price for the next paid call with quote. Prices are USD per " +
  "1M requests. All tools are read-only and never pay.";

const POLICY_PROPERTIES = {
  max_price: { type: "number", minimum: 0, description: "Highest bid you accept, in USD per 1M requests." },
  max_p95_ms: { type: "number", minimum: 0, description: "Highest P95 latency you accept, in milliseconds." },
  max_data_age_ms: { type: "number", minimum: 0, description: "Oldest data you accept, in milliseconds." },
  min_success_rate: { type: "number", minimum: 0, maximum: 1, description: "Lowest success rate you accept, 0..1 (for example 0.999)." },
  preference: {
    type: "string",
    enum: ["lowest-cost", "lowest-latency", "freshest-data"],
    description: "How to rank providers that meet the policy.",
  },
  pin: { type: "string", description: "Provider id to use instead of automatic routing." },
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

export const TOOLS = [
  {
    name: "list_markets",
    title: "List markets",
    description:
      "List Tender markets as compact rows: id, name, group, category, contract call, provider count, and the " +
      "cheapest bid (USD per 1M requests). Filter by group, category, or a text query. Use the id with get_market or quote.",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "Group id or label, for example \"market-data\"." },
        category: { type: "string", description: "Category id or label, for example \"weather\"." },
        query: { type: "string", description: "Text to match in the market id, name, description, or contract." },
      },
      additionalProperties: false,
    },
    annotations: { title: "List markets", ...READ_ONLY },
  },
  {
    name: "list_categories",
    title: "List categories",
    description: "List market groups and their categories, with market counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { title: "List categories", ...READ_ONLY },
  },
  {
    name: "list_contracts",
    title: "List contracts",
    description:
      "List contracts: the normalized API shapes that markets implement (path, params, output fields, markets). " +
      "Give an id (for example \"weather.current\") to get one contract with its full output JSON Schema.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Contract id, for example \"prices.spot\"." } },
      additionalProperties: false,
    },
    annotations: { title: "List contracts", ...READ_ONLY },
  },
  {
    name: "get_market",
    title: "Get market",
    description:
      "Show one market's provider bids (price, P95 latency, data age, success rate, status) and the routing " +
      "decision for a policy. Policy fields you leave out use the market defaults.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Market id, for example \"btc-usd\"." }, ...POLICY_PROPERTIES },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { title: "Get market", ...READ_ONLY },
  },
  {
    name: "quote",
    title: "Quote",
    description:
      "Get the price of the next request to a market's contract for a policy. Returns the x402 payment " +
      "requirements (provider, price, payTo, amount, network, asset) without paying.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Market id, for example \"btc-usd\"." }, ...POLICY_PROPERTIES },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { title: "Quote", ...READ_ONLY },
  },
];

const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

/** Errors that a tool reports to the model as `isError: true`. */
class ToolError extends Error {}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Check tool arguments against the small JSON Schema subset the tools use. Throws -32602 on a mismatch. */
function validateArguments(tool, args) {
  if (args === undefined || args === null) args = {};
  if (!isObject(args)) throw new RpcError(-32602, `Invalid arguments for ${tool.name}: expected an object`);
  const { properties, required = [] } = tool.inputSchema;
  for (const key of Object.keys(args)) {
    if (!(key in properties)) {
      throw new RpcError(-32602, `Invalid arguments for ${tool.name}: unknown property "${key}". Allowed: ${Object.keys(properties).join(", ") || "none"}`);
    }
  }
  for (const key of required) {
    if (args[key] === undefined) throw new RpcError(-32602, `Invalid arguments for ${tool.name}: "${key}" is required`);
  }
  for (const [key, value] of Object.entries(args)) {
    const schema = properties[key];
    if (value === undefined) continue;
    if (schema.type === "string") {
      if (typeof value !== "string" || !value.trim()) throw new RpcError(-32602, `Invalid arguments for ${tool.name}: "${key}" must be a non-empty string`);
      if (schema.enum && !schema.enum.includes(value)) {
        throw new RpcError(-32602, `Invalid arguments for ${tool.name}: "${key}" must be one of ${schema.enum.join(", ")}`);
      }
    } else if (schema.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new RpcError(-32602, `Invalid arguments for ${tool.name}: "${key}" must be a number`);
      if (schema.minimum !== undefined && value < schema.minimum) throw new RpcError(-32602, `Invalid arguments for ${tool.name}: "${key}" must be at least ${schema.minimum}`);
      if (schema.maximum !== undefined && value > schema.maximum) throw new RpcError(-32602, `Invalid arguments for ${tool.name}: "${key}" must be at most ${schema.maximum}`);
    }
  }
  return args;
}

function policyFromArgs(args) {
  return {
    maxPrice: args.max_price,
    maxP95LatencyMs: args.max_p95_ms,
    maxDataAgeMs: args.max_data_age_ms,
    minSuccessRate: args.min_success_rate,
    preference: args.preference,
    pin: args.pin,
  };
}

const norm = (s) => String(s ?? "").trim().toLowerCase();
const matchesRef = (ref, value) => !value || norm(ref?.id) === norm(value) || norm(ref?.label) === norm(value);

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function cheapestBid(providers) {
  let best = null;
  for (const p of providers ?? []) {
    if (p.available === false || typeof p.bid_per_million !== "number") continue;
    if (!best || p.bid_per_million < best.bid_per_million) best = p;
  }
  return best;
}

function compactProvider(p) {
  const e = p.evaluation ?? {};
  return {
    id: p.id,
    name: p.name,
    bid_per_million: p.bid_per_million,
    p95_latency_ms: p.p95_latency_ms,
    data_age_ms: p.data_age_ms,
    success_rate: p.success_rate,
    available: p.available,
    status: e.status ?? null,
    qualifies: e.qualifies ?? null,
    rank: e.rank ?? null,
    reasons: (e.reasons ?? []).map((r) => r.message ?? r.status ?? String(r)),
  };
}

function rethrowForMarket(error, id) {
  if (error?.status === 404) throw new ToolError(`Unknown market "${id}". Call list_markets to see market ids.`);
  throw error;
}

/** Tool implementations. Each returns a plain object that becomes `structuredContent`. */
export function createToolHandlers(tender) {
  return {
    async list_markets(args) {
      const markets = (await tender.markets()).filter((m) => {
        if (!matchesRef(m.group, args.group)) return false;
        if (!matchesRef(m.category, args.category)) return false;
        if (args.query) {
          const q = norm(args.query);
          const haystack = [m.id, m.name, m.short_name, m.identifier, m.description, m.contract, m.category?.label, m.group?.label].map(norm).join(" ");
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
      const details = await mapLimit(markets, DETAIL_CONCURRENCY, (m) => tender.market(m.id).catch(() => null));
      const rows = markets.map((m, i) => {
        const detail = details[i];
        const cheapest = cheapestBid(detail?.providers);
        return {
          id: m.id,
          name: m.name,
          group: m.group?.label ?? null,
          category: m.category?.label ?? null,
          contract: m.contract,
          contract_url: m.contract_url,
          provider_count: m.provider_count,
          cheapest_bid_per_million: cheapest?.bid_per_million ?? null,
          cheapest_provider: cheapest?.id ?? null,
          routing_to: detail?.routing?.active_provider ?? null,
        };
      });
      return {
        count: rows.length,
        price_unit: "USD per 1M requests",
        filters: { group: args.group ?? null, category: args.category ?? null, query: args.query ?? null },
        markets: rows,
      };
    },

    async list_categories() {
      const groups = await tender.categories();
      return {
        groups: groups.map((g) => ({
          id: g.id,
          label: g.label,
          description: g.description,
          market_count: g.market_count,
          categories: (g.categories ?? []).map((c) => ({ id: c.id, label: c.label, description: c.description, market_count: c.market_count })),
        })),
      };
    },

    async list_contracts(args) {
      const contracts = await tender.contracts();
      if (args.id) {
        const contract = contracts.find((c) => c.id === args.id);
        if (!contract) throw new ToolError(`Unknown contract "${args.id}". Known contracts: ${contracts.map((c) => c.id).join(", ")}`);
        return { contract };
      }
      return {
        count: contracts.length,
        contracts: contracts.map((c) => ({
          id: c.id,
          label: c.label,
          description: c.description,
          path: c.path,
          params: (c.params ?? []).map((p) => ({ key: p.key, type: p.type, example: p.example })),
          output: (c.output ?? []).map((o) => o.key),
          markets: (c.markets ?? []).map((m) => m.id),
        })),
      };
    },

    async get_market(args) {
      const m = await tender.market(args.id, policyFromArgs(args)).catch((error) => rethrowForMarket(error, args.id));
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        group: m.group?.label ?? null,
        category: m.category?.label ?? null,
        contract: m.contract,
        contract_url: m.contract_url,
        units: m.units,
        price_unit: "USD per 1M requests",
        policy: m.policy,
        routing: m.routing,
        providers: (m.providers ?? []).map(compactProvider),
      };
    },

    async quote(args) {
      const detail = await tender.market(args.id).catch((error) => rethrowForMarket(error, args.id));
      const result = await tender.request(args.id, policyFromArgs(args));
      const url = `${tender.baseUrl}${detail.contract_url}`;
      if (result.status !== 402) {
        return { market: args.id, contract_url: url, status: result.status, provider: result.provider, payment_required: false, data: result.data };
      }
      const body = result.paymentRequired ?? {};
      const header = result.paymentRequirements ?? null;
      const accept = header?.accepts?.[0] ?? null;
      return {
        market: args.id,
        contract: detail.contract,
        contract_url: url,
        status: 402,
        payment_required: true,
        provider: body.providerId ?? result.provider ?? accept?.extra?.providerId ?? null,
        price_usd: body.price_usd ?? accept?.extra?.price_usd ?? null,
        settled_usd: body.settled_usd ?? accept?.extra?.settled_usd ?? null,
        payTo: body.payTo ?? accept?.payTo ?? null,
        amount: accept?.amount ?? body.settled_atomic ?? null,
        asset: accept?.asset ?? null,
        asset_name: accept?.extra?.name ?? null,
        network: accept?.network ?? null,
        scheme: accept?.scheme ?? null,
        max_timeout_seconds: accept?.maxTimeoutSeconds ?? null,
        settlement_note: body.settlement_note ?? accept?.extra?.settlement_note ?? null,
        x402_version: header?.x402Version ?? null,
        how_to_pay: "Call contract_url again with an x402 payment signature (for example with @x402/fetch). The amount is in the asset's smallest unit.",
      };
    },
  };
}

function toolResult(object, isError = false) {
  const result = { content: [{ type: "text", text: JSON.stringify(object, null, 2) }], structuredContent: object };
  if (isError) result.isError = true;
  return result;
}

/**
 * Create a transport-independent MCP message handler.
 * `handle(message)` resolves to a JSON-RPC response object, or `undefined` for notifications.
 */
export function createMcpServer({ baseUrl, version, fetch: fetchImpl, log = () => {} } = {}) {
  const baseFetch = fetchImpl ?? globalThis.fetch;
  const timedFetch = (url, init = {}) =>
    baseFetch(url, {
      ...init,
      headers: { "user-agent": `tender-mcp/${version ?? "0"}`, ...(init.headers ?? {}) },
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  const tender = createTender({ baseUrl, fetch: timedFetch });
  const handlers = createToolHandlers(tender);

  async function callTool(params) {
    if (!isObject(params)) throw new RpcError(-32602, "Invalid params: expected an object with name and arguments");
    const { name } = params;
    if (typeof name !== "string") throw new RpcError(-32602, "Invalid params: name must be a string");
    const tool = TOOLS_BY_NAME.get(name);
    if (!tool) throw new RpcError(-32602, `Unknown tool: ${name}`);
    const args = validateArguments(tool, params.arguments);
    try {
      return toolResult(await handlers[name](args));
    } catch (error) {
      const code = error?.body?.error?.code;
      const message =
        error instanceof ToolError
          ? error.message
          : code === "no_eligible_provider"
            ? "No provider meets this policy. Relax the policy (for example a higher max_price) or call get_market to see why each provider fails."
            : error?.name === "TimeoutError"
            ? `Tender did not answer within ${REQUEST_TIMEOUT_MS / 1000} s. Try again.`
            : `Tender request failed: ${error?.message ?? String(error)}`;
      log(`tools/call ${name} failed: ${message}`);
      return toolResult({ error: message, ...(error?.status ? { status: error.status } : {}) }, true);
    }
  }

  async function dispatch(method, params) {
    switch (method) {
      case "initialize": {
        if (params !== undefined && !isObject(params)) throw new RpcError(-32602, "Invalid params: expected an object");
        const requested = params?.protocolVersion;
        return {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "tender", title: "Tender", version: version ?? "0.0.0" },
          instructions: INSTRUCTIONS,
        };
      }
      case "ping":
        return {};
      case "tools/list":
        if (params !== undefined && !isObject(params)) throw new RpcError(-32602, "Invalid params: expected an object");
        return { tools: TOOLS };
      case "tools/call":
        return callTool(params);
      default:
        throw new RpcError(-32601, `Method not found: ${method}`);
    }
  }

  async function handleOne(message) {
    if (!isObject(message)) return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
    const hasId = "id" in message && message.id !== undefined;
    const validId = hasId && (typeof message.id === "string" || (typeof message.id === "number" && Number.isFinite(message.id)) || message.id === null);
    if (typeof message.method !== "string") {
      // A response from the client (we send no requests) or garbage. Answer only malformed requests that carry an id.
      if ("result" in message || "error" in message) return undefined;
      return { jsonrpc: "2.0", id: validId ? message.id : null, error: { code: -32600, message: "Invalid Request" } };
    }
    if (!hasId) return undefined; // Notification: never reply.
    if (message.jsonrpc !== "2.0" || !validId) {
      return { jsonrpc: "2.0", id: validId ? message.id : null, error: { code: -32600, message: "Invalid Request" } };
    }
    try {
      return { jsonrpc: "2.0", id: message.id, result: await dispatch(message.method, message.params) };
    } catch (error) {
      if (error instanceof RpcError) {
        return { jsonrpc: "2.0", id: message.id, error: { code: error.code, message: error.message, ...(error.data ? { data: error.data } : {}) } };
      }
      log(`${message.method} failed: ${error?.stack ?? error}`);
      return { jsonrpc: "2.0", id: message.id, error: { code: -32603, message: `Internal error: ${error?.message ?? String(error)}` } };
    }
  }

  /** Handle one parsed message (object or batch array). */
  async function handle(message) {
    if (Array.isArray(message)) {
      if (message.length === 0) return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
      const responses = (await Promise.all(message.map(handleOne))).filter(Boolean);
      return responses.length ? responses : undefined;
    }
    return handleOne(message);
  }

  return { handle, tools: TOOLS, tender };
}

/** Run the MCP server on stdin/stdout until stdin ends. */
export function runStdioServer({ baseUrl, version } = {}) {
  const log = (msg) => process.stderr.write(`[tender mcp] ${msg}\n`);
  const server = createMcpServer({ baseUrl, version, log });
  const pending = new Set();
  const send = (payload) => process.stdout.write(`${JSON.stringify(payload)}\n`);

  process.stdout.on("error", (error) => {
    if (error.code === "EPIPE") process.exit(0);
    log(`stdout error: ${error.message}`);
  });

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) return;
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    const task = server
      .handle(message)
      .then((response) => {
        if (response !== undefined) send(response);
      })
      .catch((error) => log(`unexpected error: ${error?.stack ?? error}`))
      .finally(() => pending.delete(task));
    pending.add(task);
  });
  rl.on("close", async () => {
    await Promise.allSettled([...pending]);
    process.stdout.write("", () => process.exit(0));
  });
  log(`ready (Tender API ${server.tender.baseUrl})`);
  return server;
}
