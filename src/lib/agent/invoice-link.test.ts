import { describe, expect, it } from "vitest";
import { invoiceUrlFromResponse, validatedInvoiceUrl } from "./invoice-link";

const url = "https://www.sandbox.paypal.com/invoice/p/#PAYPAL-LINK";
describe("PayPal invoice links", () => {
  it("uses a payer-view link or invoice metadata returned by PayPal", () => {
    expect(invoiceUrlFromResponse({ href: url, rel: "payer-view" })).toBe(url);
    expect(invoiceUrlFromResponse({ links: [{ href: url, rel: "payer-view" }] })).toBe(url);
    expect(invoiceUrlFromResponse({ detail: { metadata: { recipient_view_url: url } } })).toBe(url);
  });
  it("never guesses a browser link from an id or a REST self link", () => {
    expect(invoiceUrlFromResponse({ id: "INV2-AAAA-BBBB-CCCC-DDDD" })).toBeNull();
    expect(invoiceUrlFromResponse({ href: "https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-AAAA-BBBB-CCCC-DDDD", rel: "self" })).toBeNull();
  });
  it.each(["javascript:alert(1)", "http://www.paypal.com/invoice/p/x", "https://www.paypal.com.evil.test/invoice/p/x", "https://evil.test/invoice/p/x", "https://user@www.paypal.com/invoice/p/x", "https://www.paypal.com:8443/invoice/p/x", "https://www.paypal.com/checkoutnow?token=x", null])("rejects unsafe or non-invoice URLs: %s", (value) => {
    expect(validatedInvoiceUrl(value)).toBeNull();
  });
});
