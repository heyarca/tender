import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { AskTools } from "./tools";

export type AskUITools = InferUITools<AskTools>;
export type AskUIMessage = UIMessage<unknown, UIDataTypes, AskUITools>;
