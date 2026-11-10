import { tool, type FlexibleSchema, type Tool } from "ai";
import { paypalApiBase, paypalCredentials } from "@/lib/paypal/client";
import { listLedger } from "@/lib/ledger";
import { getStoredOrder } from "@/lib/paypal/orders";

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
type Transaction = { transaction_info?: { custom_field?: string; transaction_id?: string } };

const FAILED = "PayPal could not finish this step";

/** A toolkit result as JSON. Failures (`{ ok: false, message }` or `{ error: { message } }`) become `{ error }`. */
function readResult(raw: unknown): unknown {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (!value || typeof value !== "object") return value;
  const failure = value as { ok?: unknown; message?: unknown; error?: { message?: unknown } };
  const message = failure.ok === false ? failure.message : failure.error ? (failure.error.message ?? FAILED) : null;
  if (message === null) return value;
  // PayPal prefixes its detail with a generic sentence ("The requested action could not be performed….: Missing …").
  return { error: typeof message === "string" ? (message.split(".: ").at(-1) ?? message) : FAILED };
}

type InvoiceInput = { primary_recipients?: { billing_info?: { email_address?: string } }[]; invoicer_email_address?: string };

/**
 * Checks a new invoice before PayPal creates a draft: it needs the recipient's email. The invoicer is
 * always Tender's PayPal account, so an invented invoicer email is dropped.
 */
function prepareInvoice(input: Record<string, unknown>): string | null {
  const invoice = input as InvoiceInput;
  delete invoice.invoicer_email_address;
  const email = invoice.primary_recipients?.[0]?.billing_info?.email_address;
  return email ? null : "Add the recipient email as primary_recipients[0].billing_info.email_address";
}

/**
 * PayPal Agent Toolkit tools as AI SDK tools, named `paypal_<action>` (for example `paypal_get_order`).
 * The toolkit builds tools for an older AI SDK, so each one is re-wrapped with its own schema and executor.
 * They act on Tender's PayPal account, so orders and transactions are limited to the visitor's own
 * account: its id is the `custom_id` of every top-up, and its capture ids are in the ledger. Empty without PayPal credentials.
 */
/** PayPal capture ids of the account's top-ups (PayPal reports a capture's id as the transaction id). */
async function accountCaptureIds(accountId: string): Promise<Set<string>> {
  const entries = await listLedger(accountId, 200);
  return new Set(entries.flatMap((entry) => (entry.paypalCaptureId ? [entry.paypalCaptureId] : [])));
}

export async function paypalToolkitTools(accountId: string): Promise<Record<string, Tool>> {
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
        if (name === "create_invoice") {
          const problem = prepareInvoice(input);
          if (problem) return { error: problem };
        }
        if (name === "get_order") {
          const order = await getStoredOrder(String(input.id ?? ""));
          if (order?.accountId !== accountId) return { error: "Order not found" };
        }
        const result = readResult(await execute(input, {}));
        if (name === "list_transactions" && result && typeof result === "object" && "transaction_details" in result) {
          const details = (result as { transaction_details?: Transaction[] }).transaction_details ?? [];
          const captures = await accountCaptureIds(accountId);
          Object.assign(result, {
            transaction_details: details.filter(
              (item) => item.transaction_info?.custom_field === accountId || captures.has(item.transaction_info?.transaction_id ?? ""),
            ),
          });
        }
        const text = JSON.stringify(result);
        return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…` : result;
      },
    });
  }
  return tools;
}
