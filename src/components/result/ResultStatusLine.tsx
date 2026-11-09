import type { ReactNode } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResultRequest } from "./types";

export interface ResultStatusLineProps {
  /** Latest request. Failed and rejected requests replace `children` with a message. */
  request?: ResultRequest | null;
  /** Whether an earlier successful result is still on screen (adds "Showing previous result"). */
  hasPrevious?: boolean;
  /** Content for successful requests, e.g. the meta row. */
  children?: ReactNode;
  className?: string;
}

const REJECTED_MESSAGE = "No eligible provider — request not sent";

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
  const message =
    status === "failed" && request ? failureMessage(request) : status === "rejected" ? REJECTED_MESSAGE : null;
  const previousNote = hasPrevious && (
    <span className="text-muted-foreground"> · Showing previous result</span>
  );
  return (
    <div
      // One line in wide containers, two reserved lines in narrow ones, so items wrap instead of
      // all truncating and the height never depends on the state.
      className={cn(
        "flex h-10 min-w-0 items-start text-caption leading-5 @md:h-5 @md:items-center",
        className,
      )}
      data-status={status}
    >
      <span className="sr-only" aria-live="polite">
        {message ?? ""}
      </span>
      {message !== null ? (
        <p
          className={cn(
            "flex min-w-0 items-start gap-1.5 @md:items-center",
            status === "failed" ? "text-negative-text" : "text-warning-text",
          )}
          aria-hidden="true"
        >
          {status === "failed" ? (
            <CircleAlert className="mt-[3px] size-3.5 shrink-0 @md:mt-0" strokeWidth={2} />
          ) : (
            <TriangleAlert className="mt-[3px] size-3.5 shrink-0 @md:mt-0" strokeWidth={2} />
          )}
          <span className="line-clamp-2 @md:line-clamp-none @md:truncate">
            {message}
            {previousNote}
          </span>
        </p>
      ) : (
        <div className="flex max-h-full min-w-0 flex-wrap items-center gap-x-1.5 overflow-hidden text-muted-foreground @md:flex-nowrap">
          {children}
        </div>
      )}
    </div>
  );
}
