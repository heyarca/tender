import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { invoiceReference, paypalToolkitTools } from "./paypal-tools";

const mocks = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/paypal/client", () => ({ paypalApiBase: () => "https://api-m.sandbox.paypal.com", paypalCredentials: () => ({ clientId: "test", secret: "test" }), paypalFetch: mocks.fetch }));
vi.mock("@/lib/ledger", () => ({ listLedger: vi.fn() }));
vi.mock("@/lib/paypal/orders", () => ({ getStoredOrder: vi.fn() }));
vi.mock("@paypal/agent-toolkit/ai-sdk", () => ({ PayPalAgentToolkit: class {
  getTools() {
    return {
      create_invoice: { parameters: z.object({ primary_recipients: z.array(z.unknown()), reference: z.string().optional() }), execute: mocks.create },
      send_invoice: { parameters: z.object({ invoice_id: z.string() }), execute: mocks.send },
    };
  }
} }));
const invoiceId = "INV2-AAAA-BBBB-CCCC-DDDD";
const url = "https://www.sandbox.paypal.com/invoice/p/#RETURNED-BY-PAYPAL";
const owned = { detail: { reference: invoiceReference("account") } };
async function send(accountId = "account") {
  const tools = await paypalToolkitTools(accountId);
  return tools.paypal_send_invoice.execute!({ invoice_id: invoiceId }, { toolCallId: "call", messages: [], context: undefined });
}
beforeEach(() => vi.resetAllMocks());

describe("sent invoice result", () => {
  it("binds created invoices to the requesting account", async () => {
    mocks.create.mockResolvedValue({ id: invoiceId });
    const tools = await paypalToolkitTools("account");
    const input = { primary_recipients: [{ billing_info: { email_address: "buyer@example.com" } }], reference: "other" };
    await tools.paypal_create_invoice.execute!(input, { toolCallId: "call", messages: [], context: undefined });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ reference: invoiceReference("account") }), {});
    // The account id doubles as the account cookie, so it must never reach PayPal.
    expect(mocks.create.mock.calls[0][0].reference).not.toContain("account");
  });
  it("exposes the validated payer link from an owned invoice", async () => {
    mocks.fetch.mockResolvedValue(owned);
    mocks.send.mockResolvedValue(JSON.stringify({ rel: "payer-view", href: url }));
    expect(await send()).toEqual({ invoice_id: invoiceId, status: "sent", invoice_url: url });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("looks up an owned empty send response through the fixed invoice API path", async () => {
    mocks.send.mockResolvedValue("");
    mocks.fetch.mockResolvedValueOnce(owned).mockResolvedValueOnce({ ...owned, detail: { ...owned.detail, metadata: { recipient_view_url: url } } });
    expect(await send()).toMatchObject({ invoice_url: url });
    expect(mocks.fetch).toHaveBeenNthCalledWith(2, `/v2/invoicing/invoices/${invoiceId}`);
  });
  it("does not send another account's invoice or expose its link", async () => {
    mocks.fetch.mockResolvedValue({ detail: { reference: invoiceReference("other"), metadata: { recipient_view_url: url } } });
    expect(await send()).toEqual({ error: "Invoice not found" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("preserves successful sending when link lookup fails, without inventing a URL", async () => {
    mocks.send.mockResolvedValue("");
    mocks.fetch.mockResolvedValueOnce(owned).mockRejectedValueOnce(new Error("unavailable"));
    expect(await send()).toEqual({ invoice_id: invoiceId, status: "sent", note: expect.stringContaining("recipient email") });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("does not claim failed sends succeeded", async () => {
    mocks.fetch.mockResolvedValue(owned);
    mocks.send.mockResolvedValue({ ok: false, message: "Not sent" });
    expect(await send()).toEqual({ error: "Not sent" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
