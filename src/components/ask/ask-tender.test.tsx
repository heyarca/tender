// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChat } from "@ai-sdk/react";
import { createTenderStore, TenderProvider } from "@/lib/tender/client";
import { AskTender } from "./ask-tender";

const mocks = vi.hoisted(() => ({ addToolOutput: vi.fn() }));
vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn(() => ({ messages: [], sendMessage: vi.fn(), addToolOutput: mocks.addToolOutput, status: "ready", stop: vi.fn(), regenerate: vi.fn(), setMessages: vi.fn(), clearError: vi.fn() })) }));
beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); });
afterEach(cleanup);

it("prepares policy directly for an approval card without answering or authorizing spending", () => {
  const store = createTenderStore();
  render(<TenderProvider store={store}><AskTender marketId="sf-weather" onSwitchMarket={vi.fn()} /></TenderProvider>);
  const options = vi.mocked(useChat).mock.calls[0][0];
  if (!options || !("onToolCall" in options)) throw new Error("Expected tool handler");
  act(() => {
    void options.onToolCall?.({ toolCall: { toolName: "request_spending_limit", toolCallId: "limit", dynamic: false, input: { marketId: "sf-weather", weeklyCapUsd: 5, policy: { maxPrice: 30, maxP95LatencyMs: 300, preference: "lowest-cost" } } } });
  });
  expect(store.api.getState().markets["sf-weather"].policy).toMatchObject({ maxPrice: 30, maxP95LatencyMs: 300 });
  expect(store.api.getState().markets["sf-weather"].route.activeProviderId).toBe("fernline");
  expect(mocks.addToolOutput).not.toHaveBeenCalled();
});

it("rejects an invented market rather than preparing or approving it", () => {
  const store = createTenderStore();
  const switchMarket = vi.fn();
  render(<TenderProvider store={store}><AskTender marketId="sf-weather" onSwitchMarket={switchMarket} /></TenderProvider>);
  const options = vi.mocked(useChat).mock.calls[0][0];
  if (!options || !("onToolCall" in options)) throw new Error("Expected tool handler");
  act(() => {
    void options.onToolCall?.({ toolCall: { toolName: "request_spending_limit", toolCallId: "unknown", dynamic: false, input: { marketId: "invented", weeklyCapUsd: 5, policy: {} } } });
  });
  expect(mocks.addToolOutput).toHaveBeenCalledWith({ tool: "request_spending_limit", toolCallId: "unknown", output: { approved: false, reason: "Unknown market: invented" } });
  expect(switchMarket).not.toHaveBeenCalled();
});
