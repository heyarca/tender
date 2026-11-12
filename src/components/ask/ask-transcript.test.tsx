// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AskUIMessage } from "@/lib/agent/types";
import { AskTranscript } from "./ask-transcript";
vi.mock("./ask-cards", () => ({ SpendingLimitCard: () => null, TopUpCard: () => null }));
afterEach(cleanup);
const props = { status: "ready" as const, error: undefined, onRetry: vi.fn(), onLimitAnswer: vi.fn() };
function invoiceMessage(url?: string): AskUIMessage {
  return { id: "invoice", role: "assistant", parts: [{ type: "dynamic-tool", toolName: "paypal_send_invoice", toolCallId: "invoice", state: "output-available", input: { invoice_id: "INV2-AAAA-BBBB-CCCC-DDDD" }, output: { status: "sent", invoice_url: url } }] };
}
describe("invoice transcript", () => {
  it("renders an actionable PayPal link separately from model text", () => {
    const url = "https://www.sandbox.paypal.com/invoice/p/#RETURNED";
    render(<AskTranscript {...props} messages={[invoiceMessage(url)]} />);
    const link = screen.getByRole("link", { name: "Open PayPal invoice" });
    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
  it.each([undefined, "javascript:alert(1)", "https://evil.test/invoice/p/x"])("does not render missing or unsafe links", (url) => {
    render(<AskTranscript {...props} messages={[invoiceMessage(url)]} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/Sent PayPal invoice/)).toBeTruthy();
  });
});

it("keeps useful progress visible between completed tools and the next model step", () => {
  const message: AskUIMessage = { id: "routing", role: "assistant", parts: [{ type: "tool-apply_policy", toolCallId: "policy", state: "output-available", input: { marketId: "sf-weather", policy: {} }, output: { applied: true, market: "San Francisco Weather" } }] };
  render(<AskTranscript {...props} status="streaming" messages={[message]} />);
  expect(screen.getByRole("status").textContent).toContain("Preparing your routing");
});

it("does not show a second pending indicator while the approval card waits for the user", () => {
  const message: AskUIMessage = { id: "approval", role: "assistant", parts: [{ type: "tool-request_spending_limit", toolCallId: "limit", state: "input-available", input: { marketId: "sf-weather", weeklyCapUsd: 5, policy: {} } }] };
  render(<AskTranscript {...props} status="streaming" messages={[message]} />);
  expect(screen.queryByRole("status")).toBeNull();
});
