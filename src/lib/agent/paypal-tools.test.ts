import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { paypalToolkitTools } from "./paypal-tools";

const mocks = vi.hoisted(() => ({ send: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/paypal/client", () => ({ paypalApiBase: () => "https://api-m.sandbox.paypal.com", paypalCredentials: () => ({ clientId: "test", secret: "test" }), paypalFetch: mocks.fetch }));
vi.mock("@/lib/ledger", () => ({ listLedger: vi.fn() }));
vi.mock("@/lib/paypal/orders", () => ({ getStoredOrder: vi.fn() }));
vi.mock("@paypal/agent-toolkit/ai-sdk", () => ({ PayPalAgentToolkit: class {
  getTools() { return { send_invoice: { parameters: z.object({ invoice_id: z.string() }), execute: mocks.send } }; }
} }));
const invoiceId = "INV2-AAAA-BBBB-CCCC-DDDD";
const url = "https://www.sandbox.paypal.com/invoice/p/#RETURNED-BY-PAYPAL";
async function send() {
  const tools = await paypalToolkitTools("account");
  return tools.paypal_send_invoice.execute!({ invoice_id: invoiceId }, { toolCallId: "call", messages: [], context: undefined });
}
beforeEach(() => vi.resetAllMocks());

describe("sent invoice result", () => {
  it("exposes the validated payer link without a second API request", async () => {
    mocks.send.mockResolvedValue(JSON.stringify({ rel: "payer-view", href: url }));
    expect(await send()).toEqual({ invoice_id: invoiceId, status: "sent", invoice_url: url });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("looks up an empty send response through the fixed invoice API path", async () => {
    mocks.send.mockResolvedValue("");
    mocks.fetch.mockResolvedValue({ detail: { metadata: { recipient_view_url: url } } });
    expect(await send()).toMatchObject({ invoice_url: url });
    expect(mocks.fetch).toHaveBeenCalledWith(`/v2/invoicing/invoices/${invoiceId}`);
  });
  it("preserves successful sending when link lookup fails, without inventing a URL", async () => {
    mocks.send.mockResolvedValue("");
    mocks.fetch.mockRejectedValue(new Error("unavailable"));
    expect(await send()).toEqual({ invoice_id: invoiceId, status: "sent", note: expect.stringContaining("recipient email") });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("does not claim failed sends succeeded", async () => {
    mocks.send.mockResolvedValue({ ok: false, message: "Not sent" });
    expect(await send()).toEqual({ error: "Not sent" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
