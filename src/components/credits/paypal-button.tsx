"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "./credits-store";
import { microsToAmount } from "./money";
import { getPayPalInstance } from "./paypal-sdk";

export interface PayPalButtonProps {
  /** Amount of the next payment. Read when the button is clicked. */
  amountMicros: number;
  /** The buyer clicked the button; PayPal opens. */
  onStart: () => void;
  /** The buyer approved; Tender is capturing the payment. */
  onCapturing: () => void;
  onPaid: (result: { amountMicros: number; balanceMicros: number }) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

const CHECKOUT_UNAVAILABLE = "PayPal checkout is not available right now. Try again later.";

async function createOrder(amountMicros: number): Promise<{ orderId: string }> {
  const response = await fetch("/api/paypal/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountUsd: microsToAmount(amountMicros) }),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Could not start the PayPal payment. Try again."));
  const { orderId } = (await response.json()) as { orderId: string };
  return { orderId };
}

async function captureOrder(orderId: string): Promise<number> {
  const response = await fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error(await errorMessage(response, "PayPal could not complete the payment. Try again."));
  const result = (await response.json()) as { status: string; balanceMicros: number };
  if (result.status !== "COMPLETED") throw new Error("PayPal is still processing this payment. Your balance updates when it completes.");
  return result.balanceMicros;
}

/** PayPal button (JS SDK v6 one-time payment): creates the order, opens PayPal, and captures on approval. */
export function PayPalButton(props: PayPalButtonProps) {
  const buttonRef = useRef<HTMLElement>(null);
  const latest = useRef(props);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;
    (async () => {
      const sdk = await getPayPalInstance();
      const methods = await sdk.findEligibleMethods({ currencyCode: "USD" });
      if (cancelled) return;
      if (!methods.isEligible("paypal")) throw new Error(CHECKOUT_UNAVAILABLE);
      let amountMicros = 0;
      const session = sdk.createPayPalOneTimePaymentSession({
        async onApprove({ orderId }) {
          latest.current.onCapturing();
          try {
            const balanceMicros = await captureOrder(orderId);
            latest.current.onPaid({ amountMicros, balanceMicros });
          } catch (error) {
            latest.current.onError(error instanceof Error ? error.message : "PayPal could not complete the payment. Try again.");
          }
        },
        onCancel: () => latest.current.onCancel(),
        onError: () => latest.current.onError("PayPal could not complete the payment. Try again."),
      });
      const button = buttonRef.current;
      if (!button) return;
      const onClick = () => {
        amountMicros = latest.current.amountMicros;
        latest.current.onStart();
        // Pass the order promise without awaiting it: PayPal needs the click to open its window.
        session.start({ presentationMode: "auto" }, createOrder(amountMicros)).catch((error: unknown) => {
          latest.current.onError(error instanceof Error ? error.message : "Could not start the PayPal payment. Try again.");
        });
      };
      button.addEventListener("click", onClick);
      detach = () => button.removeEventListener("click", onClick);
      setState("ready");
    })().catch((error: unknown) => {
      if (cancelled) return;
      setState("unavailable");
      latest.current.onError(error instanceof Error ? error.message : CHECKOUT_UNAVAILABLE);
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, []);

  return (
    <div className={state === "unavailable" ? undefined : "min-h-11"} data-slot="paypal-button">
      {state === "loading" ? <Skeleton className="h-11 w-full" /> : null}
      <paypal-button ref={buttonRef} type="pay" hidden={state !== "ready"} className="block w-full" />
    </div>
  );
}
