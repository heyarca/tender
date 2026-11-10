import { tool, type FlexibleSchema, type Tool } from "ai";
import { paypalApiBase, paypalCredentials } from "@/lib/paypal/client";

const LIVE_API_BASE = "https://api-m.paypal.com";
/** Toolkit results can be long (transaction lists); the model gets the first part. */
const MAX_RESULT_CHARS = 8_000;

/** The safe subset of the PayPal Agent Toolkit: read orders and transactions, create and send invoices. */
const ACTIONS = {
  orders: { get: true },
  transactions: { list: true },
  invoices: { create: true, send: true },
};

/** True when the PayPal REST app credentials are set. */
export function hasPayPalCredentials(): boolean {
  try {
    paypalCredentials();
    return true;
  } catch {
    return false;
  }
}

type ToolkitTool = { description?: string; parameters: unknown; execute?: (input: unknown, options: unknown) => Promise<unknown> };

/**
 * PayPal Agent Toolkit tools as AI SDK tools, named `paypal_<action>` (for example `paypal_get_order`).
 * The toolkit builds tools for an older AI SDK, so each one is re-wrapped with its own schema and executor.
 * Empty without PayPal credentials, so the model never offers them.
 */
export async function paypalToolkitTools(): Promise<Record<string, Tool>> {
  if (!hasPayPalCredentials()) return {};
  const { clientId, secret } = paypalCredentials();
  const { PayPalAgentToolkit } = await import("@paypal/agent-toolkit/ai-sdk");
  const toolkit = new PayPalAgentToolkit({
    clientId,
    clientSecret: secret,
    configuration: { actions: ACTIONS, context: { sandbox: paypalApiBase() !== LIVE_API_BASE } },
  });
  const tools: Record<string, Tool> = {};
  for (const [name, source] of Object.entries(toolkit.getTools() as Record<string, ToolkitTool>)) {
    const execute = source.execute;
    if (!execute) continue;
    tools[`paypal_${name}`] = tool({
      description: source.description,
      inputSchema: source.parameters as FlexibleSchema<Record<string, unknown>>,
      execute: async (input) => {
        const result = await execute(input, {});
        const text = typeof result === "string" ? result : JSON.stringify(result);
        return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…` : text;
      },
    });
  }
  return tools;
}
