import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, validateUIMessages } from "ai";
import { askInstructions } from "@/lib/agent/instructions";
import { ASK_MODEL } from "@/lib/agent/model";
import { hasPayPalCredentials } from "@/lib/agent/paypal-tools";
import { createAskTools } from "@/lib/agent/tools";
import { cookieAccountForWrite } from "@/lib/ledger";
import { accountError, requireJson } from "@/lib/ledger/http";
import { isMarketId } from "@/lib/tender";

/** Model steps per turn (tool calls plus the reply). */
const MAX_STEPS = 8;
/** Messages of the conversation sent to the model. */
const MAX_MESSAGES = 40;

/** `POST /api/ask`: one Ask Tender turn as an AI SDK UI message stream, for the visitor's cookie account. */
export async function POST(request: Request) {
  const notJson = requireJson(request);
  if (notJson) return notJson;
  let messages;
  let marketId: string | null = null;
  try {
    const body = (await request.json()) as { messages?: unknown; marketId?: unknown };
    messages = await validateUIMessages({ messages: body.messages });
    if (typeof body.marketId === "string" && isMarketId(body.marketId)) marketId = body.marketId;
  } catch {
    return accountError(400, "invalid_messages", "Send the chat messages");
  }
  // The account row is created on its first write (a spending limit or a top-up); the cookie names it now.
  const { accountId, setCookie } = cookieAccountForWrite(request);
  const result = streamText({
    model: ASK_MODEL,
    instructions: askInstructions(marketId, hasPayPalCredentials()),
    messages: await convertToModelMessages(messages.slice(-MAX_MESSAGES)),
    tools: await createAskTools({ accountId, origin: new URL(request.url).origin }),
    stopWhen: isStepCount(MAX_STEPS),
  });
  const response = createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        console.error("Ask Tender error", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
        return "Ask Tender could not answer. Try again.";
      },
    }),
  });
  response.headers.set("Cache-Control", "private, no-store");
  if (setCookie) response.headers.append("Set-Cookie", setCookie);
  return response;
}
