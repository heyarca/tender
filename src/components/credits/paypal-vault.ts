"use client";

import { errorMessage } from "./credits-store";

/** `GET /api/paypal/vault`. */
export interface VaultStatus {
  saved: boolean;
  email: string | null;
  weekly_cap_micros: number | null;
  top_ups_this_week_micros: number;
}

export async function readVaultStatus(): Promise<VaultStatus> {
  const response = await fetch("/api/paypal/vault", { cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response, "Could not read automatic top-ups. Try again."));
  return (await response.json()) as VaultStatus;
}

export async function removeSavedPayPal(): Promise<VaultStatus> {
  const response = await fetch("/api/paypal/vault", { method: "DELETE" });
  if (!response.ok) throw new Error(await errorMessage(response, "Could not remove the saved PayPal. Try again."));
  return (await response.json()) as VaultStatus;
}

/** Message the PayPal window posts when saving ends (`/api/paypal/vault/return`). */
const MESSAGE_TYPE = "tender-paypal-vault";
const CLOSED_POLL_MS = 600;

/**
 * Saves the visitor's PayPal for automatic top-ups in a PayPal window. Call it from a click: the
 * window opens right away, then `prepare` runs (for example saving the spending limit) and the
 * window goes to PayPal. Resolves with the status after the window closes.
 */
export async function savePayPal(prepare?: () => Promise<unknown>): Promise<VaultStatus> {
  const popup = window.open("", "tender-paypal-vault", "popup,width=480,height=720");
  if (!popup) throw new Error("Allow pop-ups for Tender, then try again.");
  const ended: { error: string | null } = { error: null };
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; error?: unknown } | null;
    if (event.origin === window.location.origin && data?.type === MESSAGE_TYPE && typeof data.error === "string") ended.error = data.error;
  };
  window.addEventListener("message", onMessage);
  try {
    await prepare?.();
    const response = await fetch("/api/paypal/vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!response.ok) throw new Error(await errorMessage(response, "PayPal could not start. Try again."));
    popup.location.href = ((await response.json()) as { approve_url: string }).approve_url;
    await new Promise<void>((resolve) => {
      const timer = window.setInterval(() => {
        if (!popup.closed) return;
        window.clearInterval(timer);
        resolve();
      }, CLOSED_POLL_MS);
    });
  } catch (error) {
    popup.close();
    throw error;
  } finally {
    window.removeEventListener("message", onMessage);
  }
  const status = await readVaultStatus();
  if (!status.saved && ended.error) throw new Error(ended.error);
  return status;
}
