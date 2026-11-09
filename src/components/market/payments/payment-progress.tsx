"use client";

import { Check, LoaderCircle, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PaymentStep, StepStatus } from "./payment-flow";

const statusText: Record<StepStatus, string> = {
  upcoming: "Not started",
  current: "In progress",
  complete: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

const barClass: Record<StepStatus, string> = {
  upcoming: "bg-border",
  current: "bg-primary/40",
  complete: "bg-positive",
  failed: "bg-negative",
  skipped: "bg-border",
};

function StepIcon({ status, index }: { status: StepStatus; index: number }) {
  const base = "flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3";
  if (status === "complete") {
    return (
      <span className={cn(base, "bg-positive text-primary-foreground")}>
        <Check aria-hidden="true" strokeWidth={3} />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={cn(base, "bg-negative text-primary-foreground")}>
        <X aria-hidden="true" strokeWidth={3} />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className={cn(base, "bg-accent text-accent-foreground [&_svg]:size-3.5")}>
        <LoaderCircle aria-hidden="true" strokeWidth={2.25} className="motion-safe:animate-spin" />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className={cn(base, "border border-border text-faint")}>
        <Minus aria-hidden="true" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className={cn(base, "border border-border text-micro font-medium text-muted-foreground tabular-nums")}>
      {index + 1}
    </span>
  );
}

/**
 * Four-step progress of a paid request. A thin segment bar per step (like a
 * checkout stepper), then the status icon, label, and one line of evidence.
 */
export function PaymentProgress({ steps, className }: { steps: PaymentStep[]; className?: string }) {
  return (
    <ol aria-label="Payment progress" className={cn("grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {steps.map((step, index) => (
        <li
          key={step.id}
          data-step={step.id}
          data-status={step.status}
          aria-current={step.status === "current" ? "step" : undefined}
          className="min-w-0"
        >
          <span
            aria-hidden="true"
            className={cn(
              "mb-2.5 block h-1 rounded-full transition-colors duration-fast ease-smooth-out motion-reduce:transition-none",
              barClass[step.status],
            )}
          />
          <div className="flex min-w-0 items-start gap-2">
            <StepIcon status={step.status} index={index} />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-xs leading-5 font-medium",
                  step.status === "upcoming" || step.status === "skipped" ? "text-muted-foreground" : "text-foreground",
                  step.status === "failed" && "text-negative-text",
                )}
              >
                {step.label}
                <span className="sr-only"> ({statusText[step.status]})</span>
              </p>
              <p className="mt-0.5 truncate text-caption text-muted-foreground" title={step.detail}>
                {step.detail}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
