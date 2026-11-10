"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requestInputFields } from "@/lib/tender/request-inputs";
import { useRequestInputs } from "../market-ui";

export function RequestInputs({ marketId }: { marketId: string }) {
  const { values, error, setInput } = useRequestInputs(marketId);
  const fields = requestInputFields(marketId);
  if (!fields.length) return null;
  return (
    <fieldset className="mt-5 min-w-0 rounded-lg border border-border bg-card p-4">
      <legend className="px-1 text-body font-medium">Request input</legend>
      <div className="grid gap-3">
        {fields.map((field) => (
          <div key={field.key} className="min-w-0">
            <label htmlFor={`request-${marketId}-${field.key}`} className="mb-1 block text-caption text-muted-foreground">{field.label}</label>
            {field.type === "enum" ? (
              <Select id={`request-${marketId}-${field.key}`} items={(field.values ?? []).map((value) => ({ value, label: value }))} value={values[field.key]} onValueChange={(value) => setInput(field.key, value)} />
            ) : (
              <Input id={`request-${marketId}-${field.key}`} type={field.type === "number" ? "number" : field.key === "url" ? "url" : "text"} value={values[field.key] ?? ""} onValueChange={(value) => setInput(field.key, value)} invalid={!!error} aria-describedby={error ? `request-${marketId}-error` : undefined} />
            )}
          </div>
        ))}
      </div>
      {error ? <p id={`request-${marketId}-error`} role="alert" className="mt-2 text-caption text-negative-text">{error}</p> : null}
    </fieldset>
  );
}
