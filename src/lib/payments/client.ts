"use client";

import { useCallback, useRef, useState } from "react";
import type { PaidRequestResult, PaymentMarket, PaymentPolicy, PaymentReceipt, PaidRequestOptions } from "./types";
export type { PaidRequestResult, PaymentMarket, PaymentPolicy, PaymentReceipt, PaidRequestOptions, PaymentConditions, PaidResponsePayload } from "./types";

export function usePaidRequest(market: PaymentMarket) {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const run = useCallback(async (options?: PaidRequestOptions | PaymentPolicy): Promise<PaidRequestResult | null> => {
    const requestOptions: PaidRequestOptions = options && ("policy" in options || "conditions" in options) ? options as PaidRequestOptions : { policy: options as PaymentPolicy | undefined };
    if (inFlight.current) return null;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/demo-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market, ...requestOptions }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Payment request failed");
      const paid = result as PaidRequestResult;
      setReceipts((current) => [paid.receipt, ...current].slice(0, 50));
      return paid;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment request failed");
      return null;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [market]);
  return { run, receipts, pending, error };
}
