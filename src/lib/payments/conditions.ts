import { getMarketDefinition } from "@/lib/tender";
import { sanitizeConditionsPatch } from "@/lib/tender/sanitize";
import type { ConditionsPatch } from "@/lib/tender/types";
import type { PaymentConditions, PaymentMarket } from "./types";

export function parsePaymentConditions(market: PaymentMarket, value: unknown): PaymentConditions | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid provider conditions");
  const entries = Object.entries(value);
  if (entries.length > 16) throw new Error("At most 16 provider conditions are allowed");
  const providers = getMarketDefinition(market).providers;
  const numeric = ["bidPrice", "p95LatencyMs", "dataAgeMs", "errorRate"];
  const result: PaymentConditions = {};
  for (const [providerId, patch] of entries) {
    if (!providers.some((provider) => provider.id === providerId)) throw new Error("Unknown provider for this market");
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Invalid provider conditions patch");
    for (const [key, value] of Object.entries(patch)) {
      if (numeric.includes(key)) {
        if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid provider condition ${key}`);
      } else if (key === "available") {
        if (typeof value !== "boolean") throw new Error("Invalid provider availability");
      } else throw new Error("Unknown provider condition field");
    }
    result[providerId] = sanitizeConditionsPatch(market, patch as ConditionsPatch);
  }
  return result;
}
