import { getContract, getMarketSpec, inputParams } from "@/lib/registry";

export function requestInputFields(marketId: string) {
  const market = getMarketSpec(marketId);
  const contract = market && getContract(market.contractId);
  return contract ? inputParams(contract) : [];
}

export function defaultRequestInputs(marketId: string): Record<string, string> {
  const market = getMarketSpec(marketId);
  return Object.fromEntries(requestInputFields(marketId).map((field) => [field.key, market?.inputs?.[field.key] ?? field.example]));
}

/** Only contract inputs may be overridden; market bindings and routing policy stay separate. */
export function parseRequestInputs(marketId: string, value: unknown): Record<string, string> {
  if (value === undefined) return defaultRequestInputs(marketId);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request inputs");
  const fields = requestInputFields(marketId);
  const values = value as Record<string, unknown>;
  if (Object.keys(values).some((key) => !fields.some((field) => field.key === key))) throw new Error("Unknown request input");
  const inputs = defaultRequestInputs(marketId);
  for (const field of fields) {
    const raw = values[field.key] ?? inputs[field.key];
    if (typeof raw !== "string" || !raw.trim()) throw new Error(`Enter ${field.label.toLowerCase()}`);
    const text = raw.trim();
    if (field.maxLength && [...text].length > field.maxLength) throw new Error(`${field.label} must be ${field.maxLength} characters or fewer`);
    if (field.type === "number" && !Number.isFinite(Number(text))) throw new Error(`${field.label} must be a number`);
    if (field.type === "enum" && !field.values?.includes(text)) throw new Error(`Choose ${field.label.toLowerCase()}`);
    inputs[field.key] = text;
  }
  return inputs;
}
