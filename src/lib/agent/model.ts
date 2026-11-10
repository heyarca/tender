/** Ask Tender model, through the Vercel AI Gateway (reads `AI_GATEWAY_API_KEY`). */
export const ASK_MODEL = "openai/gpt-5-mini";
/** Models the gateway tries when `ASK_MODEL` fails, for example on a rate limit. */
export const ASK_FALLBACK_MODELS = ["google/gemini-2.5-flash"];
