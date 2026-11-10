"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { ArrowUp, Sparkles, Square, SquarePen } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { DialogCloseButton } from "@/components/ui/dialog";
import { describePolicy, toRoutingPolicy, type AskPolicy } from "@/lib/agent/policy";
import type { AskUIMessage, AskUITools } from "@/lib/agent/types";
import { isMarketId, selectMarketView, type MarketId, type RoutingPolicy } from "@/lib/tender";
import { useTenderStore, type TenderStore } from "@/lib/tender/client";

import { AskTranscript } from "./ask-transcript";

export const STARTER_PROMPTS = [
  "Keep my app on the cheapest San Francisco weather feed under $30 per million requests with P95 under 300 ms, and don't spend more than $5 this week.",
  "Which providers bid on this market, and who wins right now?",
  "How much have I spent this week, and what is my balance?",
] as const;

type ApplyPolicyOutput = AskUITools["apply_policy"]["output"];
const POLICY_KEYS = ["maxPrice", "maxP95LatencyMs", "maxDataAgeMs", "minSuccessRate", "preference"] as const;

/**
 * Applies an agent policy through the console store (the same actions as the Routing policy editor)
 * and reports the fields that changed and the routing result.
 */
function applyPolicy(store: TenderStore, marketId: string, policy: AskPolicy): ApplyPolicyOutput {
  if (!isMarketId(marketId) || !store.api.getState().markets[marketId]) return { applied: false, error: `Unknown market: ${marketId}` };
  const before = selectMarketView(store.api.getState().markets[marketId]).policy;
  const { mode, ...patch } = toRoutingPolicy(marketId, policy);
  store.actions.setPolicy(marketId, patch);
  if (mode) store.actions.setRoutingMode(marketId, mode);
  const view = selectMarketView(store.api.getState().markets[marketId]);
  const changed: Partial<RoutingPolicy> = {};
  for (const key of POLICY_KEYS) if (view.policy[key] !== before[key]) Object.assign(changed, { [key]: view.policy[key] });
  if (JSON.stringify(view.policy.mode) !== JSON.stringify(before.mode)) changed.mode = view.policy.mode;
  return {
    applied: true,
    market: view.definition.name,
    policy: Object.keys(changed).length > 0 ? describePolicy(marketId, changed) : "no changes",
    serving: view.route.activeProvider?.name ?? null,
    qualified: `${view.qualifiedCount} of ${view.providers.length} providers qualify`,
  };
}

export interface AskTenderProps {
  marketId: MarketId;
  onSwitchMarket: (marketId: MarketId) => void;
}

/** "Ask Tender" button and its side panel: an agent that routes, sets limits, and buys requests. */
export function AskTender({ marketId, onSwitchMarket }: AskTenderProps) {
  const store = useTenderStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  // useChat always calls the latest transport and callbacks, so both may follow the open market.
  const transport = useMemo(() => new DefaultChatTransport<AskUIMessage>({ api: "/api/ask", body: { marketId } }), [marketId]);
  const { messages, sendMessage, addToolOutput, status, error, stop, regenerate, setMessages, clearError } = useChat<AskUIMessage>({
    id: "ask-tender",
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic || toolCall.toolName !== "apply_policy") return;
      const { marketId: target, policy } = toolCall.input;
      const output = applyPolicy(store, target, policy);
      if (output.applied && target !== marketId) onSwitchMarket(target);
      void addToolOutput({ tool: "apply_policy", toolCallId: toolCall.toolCallId, output });
    },
  });

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const awaitingApproval = messages.at(-1)?.parts.some((part) => part.type === "tool-request_spending_limit" && part.state === "input-available") ?? false;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || awaitingApproval) return;
    clearError();
    void sendMessage({ text: trimmed });
    setDraft("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  };

  return (
    <>
      {open ? null : (
        <Button
          variant="primary"
          size="lg"
          className="fixed right-4 bottom-4 z-40 shadow-popover sm:right-6 sm:bottom-6"
          onClick={() => setOpen(true)}
          data-slot="ask-tender-button"
        >
          <Sparkles aria-hidden="true" />
          Ask Tender
        </Button>
      )}
      <BaseDialog.Root open={open} onOpenChange={setOpen} modal={false} disablePointerDismissal>
        <BaseDialog.Portal>
          <BaseDialog.Popup
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-card text-card-foreground shadow-popover outline-none transition-transform duration-quick ease-smooth-out data-ending-style:translate-x-full data-starting-style:translate-x-full motion-reduce:transition-none sm:w-[420px]"
            data-slot="ask-tender-panel"
          >
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Sparkles aria-hidden="true" className="size-4 text-primary-strong" />
              <BaseDialog.Title className="text-base font-semibold text-foreground">Ask Tender</BaseDialog.Title>
              <div className="ml-auto flex items-center gap-1">
                {messages.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="New chat"
                    disabled={busy}
                    onClick={() => {
                      clearError();
                      setMessages([]);
                    }}
                  >
                    <SquarePen aria-hidden="true" />
                  </Button>
                ) : null}
                <DialogCloseButton aria-label="Close Ask Tender" />
              </div>
            </header>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col gap-4">
                  <BaseDialog.Description className="text-body leading-relaxed text-muted-foreground">
                    Tell Tender what your app needs. It picks a market, sets the routing policy, and buys requests within a weekly limit you approve.
                  </BaseDialog.Description>
                  <ul aria-label="Starter prompts" className="flex flex-col gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <li key={prompt}>
                        <button
                          type="button"
                          onClick={() => send(prompt)}
                          className="w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2.5 text-left text-body leading-snug text-foreground transition-colors duration-quick hover:border-accent-border hover:bg-accent-subtle focus-visible:border-focus-border focus-visible:shadow-focus focus-visible:outline-none"
                        >
                          {prompt}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <AskTranscript
                  messages={messages}
                  status={status}
                  error={error}
                  onRetry={() => void regenerate()}
                  onLimitAnswer={(toolCallId, output) => void addToolOutput({ tool: "request_spending_limit", toolCallId, output })}
                />
              )}
            </div>
            <form onSubmit={submit} className="border-t border-border p-3">
              <div className="flex items-end gap-2 rounded-lg border border-input bg-background p-1.5 focus-within:border-focus-border focus-within:shadow-focus">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  aria-label="Message Ask Tender"
                  placeholder={awaitingApproval ? "Approve or decline the spending limit first" : "Ask about markets, bids, or spending"}
                  disabled={awaitingApproval}
                  className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1.5 py-1 text-body leading-snug text-foreground outline-none placeholder:text-faint disabled:cursor-not-allowed"
                />
                {busy ? (
                  <Button type="button" size="icon" aria-label="Stop" onClick={() => void stop()}>
                    <Square aria-hidden="true" />
                  </Button>
                ) : (
                  <Button type="submit" variant="primary" size="icon" aria-label="Send" disabled={!draft.trim() || awaitingApproval}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                )}
              </div>
            </form>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </>
  );
}
