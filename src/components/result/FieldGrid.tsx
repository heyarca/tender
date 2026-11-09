import type { ReactNode } from "react";
import type { FieldSpec } from "@/lib/registry";
import { readField } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { Delta } from "@/components/viz/Delta";
import {
  displayUnit,
  formatLoose,
  formatPlainNumber,
  formatScalar,
  isAttachedUnit,
  labelFromKey,
  shortUrl,
  type FormatContext,
} from "./field-format";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Unit after a value. Symbols (`%`, `°F`) attach directly; words (`mph`, `shares`) get a space. */
export function FieldUnit({ unit }: { unit: string }) {
  return <span className={cn("font-normal text-muted-foreground", !isAttachedUnit(unit) && "ml-1")}>{unit}</span>;
}

/** External link to a result URL. */
export function ResultLink({ href, children, className }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "truncate text-accent-foreground underline decoration-current/40 underline-offset-2 hover:decoration-current",
        className,
      )}
    >
      {children ?? shortUrl(href)}
    </a>
  );
}

/** A list value: links for `{ title, url }` items, a short vector for numbers, else comma-separated text. */
export function ListValue({ value }: { value: readonly unknown[] }) {
  if (!value.length) return <span className="text-muted-foreground">None</span>;
  if (value.every((item) => typeof item === "number")) {
    const shown = (value as number[]).slice(0, 6).map((item) => formatPlainNumber(item));
    return (
      <code className="truncate font-mono text-[12px] font-normal text-foreground">
        [{shown.join(", ")}
        {value.length > 6 ? ", …" : ""}]
      </code>
    );
  }
  if (value.every(isRecord)) {
    return (
      <ul className="flex min-w-0 flex-col gap-1">
        {(value as Record<string, unknown>[]).map((item, index) => {
          const title = typeof item.title === "string" ? item.title : formatLoose(item);
          const url = typeof item.url === "string" ? item.url : null;
          return (
            <li key={index} className="flex min-w-0 flex-col">
              {url ? <ResultLink href={url}>{title}</ResultLink> : <span className="truncate">{title}</span>}
              {url ? <span className="truncate text-caption font-normal text-muted-foreground">{shortUrl(url)}</span> : null}
            </li>
          );
        })}
      </ul>
    );
  }
  return <span className="whitespace-normal">{value.map((item) => formatLoose(item)).join(", ")}</span>;
}

/** An object value as a nested label/value grid. */
export function ObjectValue({ value, className }: { value: Record<string, unknown>; className?: string }) {
  const entries = Object.entries(value);
  if (!entries.length) return <span className="text-muted-foreground">None</span>;
  return (
    <dl className={cn("grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 @md:grid-cols-4", className)}>
      {entries.map(([key, item]) => (
        <div key={key} className="min-w-0">
          <dt className="truncate text-caption font-normal text-muted-foreground">{labelFromKey(key)}</dt>
          <dd className="mt-0.5 truncate text-body leading-5 font-medium text-foreground tabular-nums">
            {isRecord(item) ? formatLoose(item) : Array.isArray(item) ? <ListValue value={item} /> : formatLoose(item)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One field value with its unit, by field type. */
export function FieldValue({ field, value, context }: { field: FieldSpec; value: unknown; context: FormatContext }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">–</span>;
  if (field.type === "url" && typeof value === "string") return <ResultLink href={value} />;
  if (field.type === "list" && Array.isArray(value)) return <ListValue value={value} />;
  if (field.type === "object" && isRecord(value)) return <ObjectValue value={value} className="mt-1" />;
  const unit = displayUnit(field);
  return (
    <>
      {formatScalar(field, value, context)}
      {unit ? <FieldUnit unit={unit} /> : null}
    </>
  );
}

/** Fields that need a full row (long text, lists of items, nested objects). */
export function isWideField(field: FieldSpec, value: unknown): boolean {
  if (field.type === "object") return true;
  if (field.type === "list") return Array.isArray(value) && value.some(isRecord);
  if (field.type === "string" && typeof value === "string") return value.length > 40;
  return false;
}

export interface FieldGridProps {
  fields: readonly FieldSpec[];
  /** Schema-shaped result, or `null` before the first result (values render as dashes). */
  values: Readonly<Record<string, unknown>> | null;
  context: FormatContext;
  /** Change of the series field vs the previous request, shown beside its value. */
  change?: { key: string; value: number | null } | null;
  className?: string;
}

/** Label/value grid of contract fields with units; nested values use dotted keys. */
export function FieldGrid({ fields, values, context, change, className }: FieldGridProps) {
  if (!fields.length) return null;
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-3 @md:grid-cols-3 @xl:grid-cols-4", className)}>
      {fields.map((field) => {
        const value = values ? readField(values, field.key) : undefined;
        const wide = isWideField(field, value);
        const fieldChange = change && change.key === field.key ? change.value : null;
        return (
          <div key={field.key} className={cn("min-w-0", wide && "col-span-full")}>
            <dt className="truncate text-caption text-muted-foreground">{field.label}</dt>
            <dd
              className={cn(
                "mt-0.5 flex min-w-0 items-baseline gap-x-1.5 text-body leading-5 font-medium text-foreground tabular-nums",
                wide ? "flex-wrap whitespace-normal" : "truncate",
              )}
            >
              <div className={cn("min-w-0", wide ? "w-full whitespace-normal" : "truncate")}>
                <FieldValue field={field} value={value} context={context} />
              </div>
              {fieldChange !== null ? (
                <Delta value={fieldChange} format={(v) => formatPlainNumber(v, 2)} className="text-caption" />
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
