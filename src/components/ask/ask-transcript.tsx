"use client";

import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { getToolName, isToolUIPart, type ChatStatus } from "ai";

import { Button } from "@/components/ui/button";
import type { AskUIMessage, AskUITools } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

import { SpendingLimitCard, TopUpCard } from "./ask-cards";
import { toolActivity, type Activity } from "./tool-activity";

type LimitOutput = AskUITools["request_spending_limit"]["output"];

function ActivityRow({ activity }: { activity: Activity }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-caption leading-snug [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0",
        activity.tone === "error" ? "text-negative-text" : "text-muted-foreground",
      )}
      data-tone={activity.tone}
    >
      {activity.tone === "pending" ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
      {activity.tone === "done" ? <CircleCheck aria-hidden="true" className="text-primary-strong" /> : null}
      {activity.tone === "error" ? <TriangleAlert aria-hidden="true" /> : null}
      <span className="min-w-0">{activity.text}</span>
    </p>
  );
}

/** Model text without Markdown emphasis markers. */
const plainText = (text: string) =>
  text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/[ \t]+$/gm, "").trim();

function AssistantMessage({
  message,
  onLimitAnswer,
}: {
  message: AskUIMessage;
  onLimitAnswer: (toolCallId: string, output: LimitOutput) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        if (part.type === "text") {
          const text = plainText(part.text);
          return text ? (
            <p key={key} className="text-body leading-relaxed whitespace-pre-wrap text-foreground">
              {text}
            </p>
          ) : null;
        }
        if (!isToolUIPart(part)) return null;
        if (part.type === "tool-request_spending_limit" && part.state === "input-available") {
          return <SpendingLimitCard key={key} input={part.input} onAnswer={(output) => onLimitAnswer(part.toolCallId, output)} />;
        }
        if (part.type === "tool-request_spending_limit" && part.state === "output-available" && part.output.automatic_top_ups) {
          return <SpendingLimitCard key={key} input={part.input} output={part.output} />;
        }
        if (part.type === "tool-top_up" && part.state === "output-available" && "approve_url" in part.output) {
          return <TopUpCard key={key} output={part.output} />;
        }
        const activity = toolActivity(getToolName(part), part);
        return activity ? <ActivityRow key={key} activity={activity} /> : null;
      })}
    </div>
  );
}

export interface AskTranscriptProps {
  messages: AskUIMessage[];
  status: ChatStatus;
  error: Error | undefined;
  onRetry: () => void;
  onLimitAnswer: (toolCallId: string, output: LimitOutput) => void;
}

/** Chat transcript: user bubbles, assistant text, tool activity rows, and approval cards. */
export function AskTranscript({ messages, status, error, onRetry, onLimitAnswer }: AskTranscriptProps) {
  const last = messages.at(-1);
  const waiting = status === "submitted" || (status === "streaming" && last?.role === "assistant" && last.parts.every((part) => part.type === "step-start"));
  return (
    <div className="flex flex-col gap-5">
      {messages.map((message) =>
        message.role === "user" ? (
          <p
            key={message.id}
            className="ml-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-body leading-relaxed whitespace-pre-wrap text-foreground"
          >
            {message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")}
          </p>
        ) : (
          <AssistantMessage key={message.id} message={message} onLimitAnswer={onLimitAnswer} />
        ),
      )}
      {waiting ? <ActivityRow activity={{ tone: "pending", text: "Thinking…" }} /> : null}
      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-negative/30 bg-negative-bg px-3 py-2 text-caption text-negative-text">
          Ask Tender could not answer.
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
