"use client";

import type * as React from "react";

/** The parts of the PayPal JS SDK v6 that Tender uses. */
export interface PayPalSdk {
  createInstance(options: { clientToken: string; components: string[]; pageType?: string }): Promise<PayPalSdkInstance>;
}

export interface PayPalSdkInstance {
  findEligibleMethods(options: { currencyCode: string }): Promise<{ isEligible(method: string): boolean }>;
  createPayPalOneTimePaymentSession(callbacks: {
    onApprove(data: { orderId: string }): Promise<void> | void;
    onCancel?(data: { orderId?: string }): void;
    onError?(error: Error): void;
  }): PayPalPaymentSession;
}

export interface PayPalPaymentSession {
  start(options: { presentationMode: "auto" | "popup" | "modal" | "redirect" }, order: Promise<{ orderId: string }>): Promise<void>;
}

declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { type?: "pay" | "checkout" | "buynow" };
    }
  }
}

/** Refresh the SDK instance this long before its client token expires. */
const TOKEN_MARGIN_MS = 60_000;

let scriptPromise: Promise<PayPalSdk> | null = null;
let instance: { promise: Promise<PayPalSdkInstance>; expiresAt: number } | null = null;

function loadScript(src: string): Promise<PayPalSdk> {
  scriptPromise ??= new Promise<PayPalSdk>((resolve, reject) => {
    if (window.paypal) return resolve(window.paypal);
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal did not load")));
    script.onerror = () => reject(new Error("PayPal did not load"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

/** The PayPal SDK instance for this page, created once and again when its client token is about to expire. */
export function getPayPalInstance(): Promise<PayPalSdkInstance> {
  if (instance && Date.now() < instance.expiresAt) return instance.promise;
  const entry = { promise: Promise.resolve(null as unknown as PayPalSdkInstance), expiresAt: Number.POSITIVE_INFINITY };
  entry.promise = (async () => {
    const response = await fetch("/api/paypal/client-token", { method: "POST", cache: "no-store" });
    if (!response.ok) throw new Error("PayPal checkout is not available right now. Try again later.");
    const { clientToken, expiresIn, sdkUrl } = (await response.json()) as { clientToken: string; expiresIn: number; sdkUrl: string };
    entry.expiresAt = Date.now() + expiresIn * 1000 - TOKEN_MARGIN_MS;
    const sdk = await loadScript(sdkUrl);
    return sdk.createInstance({ clientToken, components: ["paypal-payments"], pageType: "checkout" });
  })();
  entry.promise.catch(() => {
    if (instance === entry) instance = null;
  });
  instance = entry;
  return entry.promise;
}
