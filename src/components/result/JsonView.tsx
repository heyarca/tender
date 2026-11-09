import { cn } from "@/lib/utils";

export type JsonTokenType = "key" | "string" | "number" | "boolean" | "null" | "punctuation" | "space";

export interface JsonToken {
  type: JsonTokenType;
  text: string;
}

/**
 * Tokens of `JSON.stringify(value, null, indent)`. Joining the token texts gives exactly that
 * string, so the view is a faithful pretty-print. `undefined`, functions, and symbols are dropped
 * the same way JSON does.
 */
export function tokenizeJson(value: unknown, indent = 2): JsonToken[] {
  const tokens: JsonToken[] = [];
  const push = (type: JsonTokenType, text: string) => tokens.push({ type, text });
  const pad = (depth: number) => " ".repeat(depth * indent);

  const isSkipped = (v: unknown) => v === undefined || typeof v === "function" || typeof v === "symbol";

  const walk = (v: unknown, depth: number) => {
    if (v !== null && typeof v === "object" && typeof (v as { toJSON?: unknown }).toJSON === "function") {
      v = (v as { toJSON: () => unknown }).toJSON();
    }
    if (v === null || (typeof v === "number" && !Number.isFinite(v))) {
      push("null", "null");
    } else if (typeof v === "string") {
      push("string", JSON.stringify(v));
    } else if (typeof v === "number") {
      push("number", JSON.stringify(v));
    } else if (typeof v === "bigint") {
      push("number", v.toString());
    } else if (typeof v === "boolean") {
      push("boolean", String(v));
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        push("punctuation", "[]");
        return;
      }
      push("punctuation", "[");
      v.forEach((item, i) => {
        push("space", `\n${pad(depth + 1)}`);
        if (isSkipped(item)) push("null", "null");
        else walk(item, depth + 1);
        if (i < v.length - 1) push("punctuation", ",");
      });
      push("space", `\n${pad(depth)}`);
      push("punctuation", "]");
    } else if (typeof v === "object") {
      const entries = Object.entries(v as Record<string, unknown>).filter(([, item]) => !isSkipped(item));
      if (entries.length === 0) {
        push("punctuation", "{}");
        return;
      }
      push("punctuation", "{");
      entries.forEach(([key, item], i) => {
        push("space", `\n${pad(depth + 1)}`);
        push("key", JSON.stringify(key));
        push("punctuation", ":");
        push("space", " ");
        walk(item, depth + 1);
        if (i < entries.length - 1) push("punctuation", ",");
      });
      push("space", `\n${pad(depth)}`);
      push("punctuation", "}");
    }
  };

  if (!isSkipped(value)) walk(value, 0);
  return tokens;
}

const TOKEN_CLASS: Record<JsonTokenType, string | undefined> = {
  key: "text-foreground",
  string: "text-positive-text",
  number: "text-info-text",
  boolean: "text-tier-priority",
  null: "text-faint",
  punctuation: "text-muted-foreground",
  space: undefined,
};

export interface JsonViewProps {
  /** Any JSON-serializable value, e.g. the normalized response payload. */
  value: unknown;
  /** Spaces per level. Default 2. */
  indent?: number;
  /** Accessible name for the code block. */
  ariaLabel?: string;
  className?: string;
}

/** Pretty-printed JSON with quiet syntax colors, Geist Mono at caption size. */
export function JsonView({ value, indent = 2, ariaLabel, className }: JsonViewProps) {
  const tokens = tokenizeJson(value, indent);
  return (
    <pre
      aria-label={ariaLabel}
      className={cn(
        "overflow-auto font-mono text-caption leading-relaxed whitespace-pre text-foreground tabular-nums",
        className,
      )}
    >
      <code>
        {tokens.map((token, i) =>
          token.type === "space" ? (
            token.text
          ) : (
            <span key={i} className={TOKEN_CLASS[token.type]}>
              {token.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
