"use client";

import { useCallback, useRef, useState } from "react";
import { PaymentResponseError, readPaidResponse } from "./client-response";
import type { PaidRequestResult, PaymentMarket, PaymentPolicy, PaymentReceipt, PaidRequestOptions, PaidRequestFailure, PaidRequestStage } from "./types";
export type { PaidRequestResult, PaymentMarket, PaymentPolicy, PaymentReceipt, PaidRequestOptions, PaymentConditions, PaidResponsePayload, PaidRequestFailure, PaidRequestStage, PaidRequestProgress, PaidRequestEvent, BalanceEntry, BalancesResponse } from "./types";

export function usePaidRequest(market: PaymentMarket) {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<PaidRequestFailure | null>(null);
  const [stage, setStage] = useState<PaidRequestStage>("idle");
  const inFlight = useRef(false);
  const run = useCallback(async (options?: PaidRequestOptions | PaymentPolicy): Promise<PaidRequestResult | null> => {
    const requestOptions: PaidRequestOptions = options && ("policy" in options || "conditions" in options || "params" in options) ? options as PaidRequestOptions : { policy: options as PaymentPolicy | undefined };
    if (inFlight.current) return null;
    inFlight.current = true;
    setPending(true);
    setError(null);
    setFailure(null);
    setStage("idle");
    try {
      const response = await fetch("/api/payments/demo-request", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: JSON.stringify({ market, ...requestOptions }) });
      const paid = await readPaidResponse(response, (event) => setStage(event.type));
      setStage("complete");
      setReceipts((current) => [paid.receipt, ...current].slice(0, 50));
      return paid;
    } catch (cause) {
      const nextFailure: PaidRequestFailure = cause instanceof PaymentResponseError ? cause.failure : { status: 0, message: cause instanceof Error ? cause.message : "Payment request failed" };
      setFailure(nextFailure);
      setError(nextFailure.message);
      setStage("failed");
      return null;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [market]);
  return { run, receipts, pending, error, failure, stage };
}
