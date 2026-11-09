"use client";

import { ExternalLink } from "lucide-react";
import type * as React from "react";

import { CopyButton } from "@/components/ui/copy-button";
import { format } from "@/lib/tender";
import { useNow } from "@/lib/tender/client";
import { cn } from "@/lib/utils";

import { addressUrl, shortAddress, shortHash, txUrl } from "./payment-model";

const linkClass =
  "rounded-sm text-foreground underline decoration-current/30 underline-offset-2 transition-colors duration-quick hover:text-accent-foreground hover:decoration-current focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export interface AddressProps {
  address: string;
  /** Accessible role of the address, e.g. "payee" → "Copy payee address". */
  role: string;
  className?: string;
}

/** Short address linked to Basescan, with a copy button for the full address. */
export function Address({ address, role, className }: AddressProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-0.5", className)}>
      <a
        href={addressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        title={address}
        aria-label={`${role} address ${address} on Basescan (opens in a new tab)`}
        className={cn(linkClass, "font-mono text-[13px] whitespace-nowrap")}
      >
        {shortAddress(address)}
      </a>
      <CopyButton value={address} label={`Copy ${role} address`} variant="ghost" size="xs" />
    </span>
  );
}

export interface TxLinkProps {
  hash: string;
  /** Show "Basescan" with an external-link icon after the hash. */
  withLabel?: boolean;
  className?: string;
}

/** Short transaction hash linked to Basescan, an external-link icon, and a copy button. */
export function TxLink({ hash, withLabel = false, className }: TxLinkProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-0.5", className)}>
      <a
        href={txUrl(hash)}
        target="_blank"
        rel="noopener noreferrer"
        title={hash}
        aria-label={`Transaction ${hash} on Basescan (opens in a new tab)`}
        className={cn(linkClass, "inline-flex items-center gap-1 font-mono text-[13px] whitespace-nowrap")}
      >
        {shortHash(hash)}
        {withLabel ? <span className="font-sans text-caption text-muted-foreground">Basescan</span> : null}
        <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
      </a>
      <CopyButton value={hash} label="Copy transaction hash" variant="ghost" size="xs" />
    </span>
  );
}

/** "12 s ago", re-rendered by the store clock. Isolated so only this text ticks. */
export function RelativeTime({ at, className }: { at: number; className?: string }) {
  const now = useNow();
  return <span className={cn("tabular-nums", className)}>{format.relativeTime(at, Math.max(now, at))}</span>;
}

/** Amount with a muted unit: `0.000018` + ` USDC`. */
export function Amount({ value, unit, className }: { value: React.ReactNode; unit?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("tabular-nums text-foreground", className)}>
      {value}
      {unit ? <span className="ml-1 text-muted-foreground">{unit}</span> : null}
    </span>
  );
}

export type NoticeTone = "neutral" | "info" | "warning" | "negative";

const noticeTone: Record<NoticeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-info/20 bg-info-bg text-info-text",
  warning: "border-warning/25 bg-warning-bg text-warning-text",
  negative: "border-negative/20 bg-negative-bg text-negative-text",
};

export interface NoticeProps extends Omit<React.ComponentProps<"div">, "title"> {
  tone?: NoticeTone;
  icon?: React.ReactNode;
  title?: React.ReactNode;
}

/** Compact inline callout (12px), for routing notes and failures. */
export function Notice({ tone = "neutral", icon, title, className, children, ...props }: NoticeProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-caption leading-snug [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0",
        noticeTone[tone],
        className,
      )}
      {...props}
    >
      {icon}
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "text-pretty")}>{children}</div> : null}
      </div>
    </div>
  );
}
