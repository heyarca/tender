"use client";

import { Toast } from "@base-ui/react/toast";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "info" | "positive" | "warning" | "negative";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Pass an existing id to update that toast in place instead of stacking a new one. */
  id?: string;
  title: React.ReactNode;
  /** One short muted line under the title. */
  description?: React.ReactNode;
  /** Sets the icon and its color. Default `info`. */
  tone?: ToastTone;
  /** Optional button. Clicking it runs `onClick` and dismisses the toast. */
  action?: ToastAction;
  /** Auto-dismiss delay in ms. Default 5000. `0` keeps the toast until it is dismissed. */
  timeout?: number;
}

const TONES: Record<ToastTone, { icon: LucideIcon; className: string; label: string }> = {
  info: { icon: Info, className: "text-info", label: "Info" },
  positive: { icon: CircleCheck, className: "text-positive", label: "Success" },
  warning: { icon: TriangleAlert, className: "text-warning", label: "Warning" },
  negative: { icon: CircleAlert, className: "text-negative", label: "Error" },
};

function isTone(value: string | undefined): value is ToastTone {
  return value === "info" || value === "positive" || value === "warning" || value === "negative";
}

/** One manager for the app, so toasts can be raised from any component or callback. */
const toastManager = Toast.createToastManager();
let toastCount = 0;

/**
 * Shows a toast in the `<Toaster />` stack and returns its id.
 * Call it from event handlers or effects, never during render.
 */
export function toast({ id, title, description, tone = "info", action, timeout }: ToastOptions): string {
  toastCount += 1;
  const toastId = id ?? `toast-${toastCount}`;
  toastManager.add({
    id: toastId,
    title,
    description,
    type: tone,
    timeout,
    priority: tone === "warning" || tone === "negative" ? "high" : "low",
    actionProps: action
      ? {
          children: action.label,
          onClick: () => {
            action.onClick();
            toastManager.close(toastId);
          },
        }
      : undefined,
  });
  return toastId;
}

/** Dismisses one toast, or every toast when `id` is omitted. */
export function dismissToast(id?: string) {
  toastManager.close(id);
}

const toastApi = { toast, dismiss: dismissToast } as const;

/**
 * Returns `{ toast, dismiss }`. Both functions are stable and also exported directly.
 *
 * @example
 * const { toast } = useToast();
 * toast({ title: "Switched to DeepInfra", description: "Together exceeded the P95 limit.", tone: "warning" });
 */
export function useToast() {
  return toastApi;
}

export interface ToasterProps {
  /** Maximum visible toasts. Older ones collapse behind the newest. Default 3. */
  limit?: number;
  /** Default auto-dismiss delay in ms. Default 5000. */
  timeout?: number;
}

/** Bottom-right toast stack. Mount once, near the root of the app. */
export function Toaster({ limit = 3, timeout = 5000 }: ToasterProps) {
  return (
    <Toast.Provider toastManager={toastManager} limit={limit} timeout={timeout}>
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-[60] mx-auto w-[calc(100vw-2rem)] outline-none sm:right-6 sm:bottom-6 sm:w-[22.5rem]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

const ROOT_CLASS = cn(
  "[--gap:0.5rem] [--peek:0.625rem] [--scale:calc(max(0,1-(var(--toast-index)*0.06)))] [--shrink:calc(1-var(--scale))]",
  "[--height:var(--toast-frontmost-height,var(--toast-height))]",
  "[--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))]",
  "absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] w-full origin-bottom select-none",
  // shadow-popover includes a 1px ink/8% ring, which draws the card border.
  "rounded-lg bg-card text-card-foreground shadow-popover outline-none focus-visible:ring-2 focus-visible:ring-focus-border",
  "[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))]",
  "h-[var(--height)] data-expanded:h-[var(--toast-height)]",
  "data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
  "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
  "data-starting-style:[transform:translateY(150%)] data-ending-style:opacity-0 data-limited:opacity-0",
  "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
  "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
  "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
  "[transition:transform_0.45s_cubic-bezier(0.22,1,0.36,1),opacity_0.45s,height_0.15s] motion-reduce:transition-none",
);

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((item) => {
    const tone = isTone(item.type) ? item.type : "info";
    const { icon: Icon, className: toneClass, label: toneLabel } = TONES[tone];
    return (
      <Toast.Root key={item.id} toast={item} className={ROOT_CLASS} data-tone={tone}>
        <Toast.Content className="flex items-start gap-2.5 overflow-hidden py-3 pr-10 pl-3.5 transition-opacity duration-fast ease-smooth-out data-behind:opacity-0 data-expanded:opacity-100">
          <Icon className={cn("mt-0.5 size-4 shrink-0", toneClass)} strokeWidth={2} aria-label={toneLabel} role="img" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Toast.Title className="text-body leading-snug font-medium text-foreground" />
            <Toast.Description className="text-body leading-snug text-muted-foreground empty:hidden" />
            <Toast.Action className="mt-2 inline-flex h-7 w-fit cursor-pointer items-center justify-center rounded-md border border-input bg-background px-2.5 text-button font-medium text-foreground transition-colors duration-quick hover:bg-muted hover:text-accent-foreground focus-visible:border-focus-border focus-visible:shadow-focus focus-visible:outline-none" />
          </div>
          <Toast.Close
            aria-label="Dismiss"
            className="absolute top-2.5 right-2.5 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-faint transition-colors duration-quick hover:bg-muted hover:text-foreground focus-visible:shadow-focus focus-visible:outline-none"
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}
