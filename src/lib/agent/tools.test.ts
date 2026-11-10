import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAskTools } from "./tools";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(), vaultTopUp: vi.fn(), beforeCharge: vi.fn(), account: vi.fn(), serve: vi.fn(),
}));
vi.mock("@/lib/ledger", () => ({ getAccount: mocks.account, getAutopay: vi.fn(), listLedger: vi.fn(), lowBalanceThreshold: () => 1_000_000 }));
vi.mock("@/lib/paypal/orders", () => ({ createTopUpOrder: mocks.createOrder }));
vi.mock("@/lib/paypal/vault", () => ({ createVaultedTopUp: mocks.vaultTopUp, topUpBeforeAgentCharge: mocks.beforeCharge }));
vi.mock("@/lib/server/credits", () => ({ serveWithCredits: mocks.serve }));
vi.mock("./paypal-tools", () => ({ hasPayPalCredentials: () => true, paypalToolkitTools: async () => ({}) }));

async function execute(name: string, input: unknown) {
  const tools = await createAskTools({ accountId: "account", origin: "https://tender.example" });
  const tool = tools[name];
  const parsed = (tool.inputSchema as z.ZodType).parse(input);
  return tool.execute!(parsed, { toolCallId: "call", messages: [], context: undefined });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createOrder.mockResolvedValue({ orderId: "order", approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=order" });
});

describe("manual and automatic top-ups", () => {
  it("requires one-off Checkout approval without reading or consuming the saved PayPal allowance", async () => {
    const result = await execute("top_up", { amountUsd: 5 });
    expect(result).toMatchObject({ amount: "$5.00", status: "waiting_for_approval", order_id: "order" });
    expect(mocks.createOrder).toHaveBeenCalledWith({ accountId: "account", amountMicros: 5_000_000, actor: "user", returnUrl: "https://tender.example/api/ask/top-up", cancelUrl: "https://tender.example/api/ask/top-up?cancel=1" });
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.vaultTopUp).not.toHaveBeenCalled();
    expect(mocks.beforeCharge).not.toHaveBeenCalled();
  });

  it("does not let model-supplied approval or bypass flags select a vault charge", async () => {
    await execute("top_up", { amountUsd: 5, approved: true, automatic: true, bypassWeeklyLimit: true, actor: "agent" });
    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ actor: "user" }));
    expect(mocks.vaultTopUp).not.toHaveBeenCalled();
    expect(mocks.beforeCharge).not.toHaveBeenCalled();
  });

  it("still refuses paid requests without a mandate", async () => {
    mocks.account.mockResolvedValue({ balanceMicros: 0, mandate: null });
    expect(await execute("run_request", { marketId: "sf-weather" })).toMatchObject({ ran: 0, refused: { code: "no_spending_limit" } });
    expect(mocks.beforeCharge).not.toHaveBeenCalled();
    expect(mocks.serve).not.toHaveBeenCalled();
  });

  it("retains the guarded automatic path before low-balance paid requests", async () => {
    mocks.account.mockResolvedValue({ balanceMicros: 0, mandate: { hasVault: true, weeklyCapMicros: 5_000_000, spentThisWeekMicros: 0 } });
    mocks.beforeCharge.mockResolvedValue({ status: "REFUSED", reason: "weekly_limit", weeklyCapMicros: 5_000_000, topUpsThisWeekMicros: 5_000_000 });
    mocks.serve.mockResolvedValue({ status: 402, body: { error: { code: "insufficient_credits", message: "Add funds" } } });
    expect(await execute("run_request", { marketId: "sf-weather" })).toMatchObject({ ran: 0, auto_top_up: { refused: expect.stringContaining("weekly limit reached") } });
    expect(mocks.beforeCharge).toHaveBeenCalledWith("account", expect.any(Number));
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
});

it("records the actual server-validated inputs rather than the draft passed by the agent", async () => {
  mocks.account.mockResolvedValue({ balanceMicros: 5_000_000, mandate: { hasVault: false, weeklyCapMicros: 5_000_000, spentThisWeekMicros: 0 } });
  mocks.serve.mockResolvedValue({ status: 200, body: { request_id: "request", provider: "fernline", params: { text: "Actual trimmed input" }, data: { text: "Result" }, payment: { charged_micros: 18, balance_micros: 4_999_982 } } });
  expect(await execute("run_request", { marketId: "sf-weather", params: { text: "  Draft input  " } })).toMatchObject({ served: [{ params: { text: "Actual trimmed input" } }] });
});
