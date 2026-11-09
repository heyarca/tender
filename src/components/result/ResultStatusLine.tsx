import type { ReactNode } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResultRequest } from "./types";

export interface ResultStatusLineProps {
  /** Latest request. Failed and rejected requests replace `children` with a message. */
  request?: ResultRequest | null;
  /** Whether an earlier successful result is still on screen (adds "Showing the previous result"). */
  hasPrevious?: boolean;
  /** Content for successful requests, e.g. the meta row. */
  children?: ReactNode;
  className?: string;
}

/** Text of the failure message, e.g. `Together failed: 503 Service Unavailable`. */
export function failureMessage(request: ResultRequest): string {
  const who = request.provider?.name ?? "Provider";
  return request.error ? `${who} failed: ${request.error}` : `${who} failed`;
}

/**
 * One fixed-height line under a result value. Successful requests show `children`; a failed request
 * shows a red message, a rejected one an amber "No eligible provider — request not sent". The line
 * keeps its height in every state, so nothing below it moves.
 */
export function ResultStatusLine({ request, hasPrevious = false, children, className }: ResultStatusLineProps) {
  const status = request?.status ?? "ok";
  return (
    <div
      className={cn("flex h-5 min-w-0 items-center text-caption", className)}
      role={status === "ok" ? undefined : "status"}
      data-status={status}
    >
      {status === "failed" && request ? (
        <p className="flex min-w-0 items-center gap-1.5 text-negative-text">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">
            {failureMessage(request)}
            {hasPrevious && <span className="text-muted-foreground"> · Showing the previous result</span>}
          </span>
        </p>
      ) : status === "rejected" ? (
        <p className="flex min-w-0 items-center gap-1.5 text-warning-text">
          <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">
            No eligible provider — request not sent
            {hasPrevious && <span className="text-muted-foreground"> · Showing the previous result</span>}
          </span>
        </p>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">{children}</div>
      )}
    </div>
  );
}
