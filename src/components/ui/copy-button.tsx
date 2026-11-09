"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

import { buttonVariants } from "./button";

export const COPY_RESET_MS = 1500;

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based fallback (insecure origins, denied permission).
  }
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export interface CopyButtonProps
  extends Omit<React.ComponentProps<"button">, "value" | "children" | "onCopy"> {
  /** Text written to the clipboard. */
  value: string;
  /** Accessible name. Defaults to "Copy". */
  label?: string;
  /** Called after a successful copy. */
  onCopied?: (value: string) => void;
  /** `outline` (default, bordered 28px square) or `ghost`. */
  variant?: "outline" | "ghost";
  /** `sm` = 28px (default), `xs` = 24px. */
  size?: "xs" | "sm";
}

const iconLayer =
  "flex transition-[opacity,translate,filter] duration-fast ease-in-out data-[active=false]:opacity-0 data-[active=false]:blur-[2px] motion-reduce:transition-opacity motion-reduce:translate-y-0! motion-reduce:blur-none!";

/** Copies `value`; the icon swaps to a check for 1.5 s. */
export function CopyButton({
  value,
  label = "Copy",
  onCopied,
  variant = "outline",
  size = "sm",
  className,
  onClick,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const ok = await writeClipboard(value);
    if (!ok) return;
    setCopied(true);
    onCopied?.(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPY_RESET_MS);
  };

  return (
    <button
      type="button"
      data-slot="copy-button"
      data-copied={copied}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      onClick={handleClick}
      className={cn(
        buttonVariants({ variant, size: "icon-sm" }),
        size === "xs" && "size-6 min-w-6",
        "[&_svg]:size-3",
        variant === "ghost" && "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      <span className="inline-grid shrink-0 *:[grid-area:1/1]">
        <span data-active={!copied} className={cn(iconLayer, "data-[active=false]:-translate-y-1")}>
          <Copy aria-hidden="true" />
        </span>
        <span
          data-active={copied}
          aria-hidden="true"
          className={cn(iconLayer, "text-positive-text data-[active=false]:translate-y-1")}
        >
          <Check aria-hidden="true" />
        </span>
      </span>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
