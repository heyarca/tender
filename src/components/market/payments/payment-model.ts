import {
  getProviderFixture,
  MARKETS,
  PREFERENCE_LABELS,
  selectRoute,
  type ConditionsPatch,
  type MarketId,
  type MarketView,
  type ProviderConditions,
  type ProviderId,
  type RouteSelection,
} from "@/lib/tender";
import { EXPLORER_URL, MAX_PAYMENT_ATOMIC } from "@/lib/payments/config";
import { PAYEES } from "@/lib/payments/payees";
import type { PaymentConditions, PaymentPolicy } from "@/lib/payments/types";

/** USDC has six decimals: one atomic unit is 0.000001 USDC. */
export const USDC_DECIMALS = 6;
/** Same copy as the payments API (`settlement_note`). */
export const ROUNDING_NOTE = "Rounded up to the USDC minimum unit (0.000001)";
/** Per-request spend cap of the payer wallet, in atomic USDC. */
export const SPEND_CAP_ATOMIC = Number(MAX_PAYMENT_ATOMIC);
export const NETWORK_LABEL = "Base Sepolia";
export { EXPLORER_URL };

const CONDITION_FIELDS = ["bidPrice", "p95LatencyMs", "dataAgeMs", "errorRate", "available"] as const;

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

export interface QuoteAmounts {
  /** Exact bid per request in USD (bid / 1,000,000). */
  priceUsd: number;
  /** Integer USDC atomic units actually transferred. */
  settledAtomic: string;
  /** `settledAtomic` / 1,000,000. */
  settledUsd: number;
  /** True when the exact price had a fractional atomic unit and was rounded up. */
  rounded: boolean;
}

/**
 * Ceil a positive decimal number shifted by `decimalShift` places, without
 * floating-point error. Mirrors the server's settlement rounding
 * (`settlementAmounts` in `@/lib/payments/quote`), checked by tests.
 */
function ceilShifted(value: number, decimalShift: number): { atomic: bigint; rounded: boolean } {
  const [coefficient, exponent = "0"] = value.toString().toLowerCase().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = BigInt(whole + fraction);
  const shift = Number(exponent) - fraction.length + decimalShift;
  const divisor = shift < 0 ? BigInt(10) ** BigInt(-shift) : BigInt(1);
  const numerator = shift >= 0 ? digits * BigInt(10) ** BigInt(shift) : digits;
  const rounded = numerator % divisor !== BigInt(0);
  return { atomic: (numerator + divisor - BigInt(1)) / divisor, rounded };
}

/**
 * Exact and settled amounts of one request for a bid in USD per 1M requests.
 * A bid of `$X /M` is `X / 1e6` USD per request; USDC settles whole atomic
 * units, rounded up (never down to zero). Returns `null` for a non-positive bid.
 */
export function quoteAmounts(bidPerMillion: number): QuoteAmounts | null {
  if (!Number.isFinite(bidPerMillion) || bidPerMillion <= 0) return null;
  const priceUsd = bidPerMillion / 1_000_000;
  const { atomic, rounded } = ceilShifted(priceUsd, USDC_DECIMALS);
  return { priceUsd, settledAtomic: atomic.toString(), settledUsd: Number(atomic) / 1_000_000, rounded };
}

/**
 * Atomic USDC as a fixed six-decimal amount: `"18"` → `"0.000018"`,
 * `"19999820"` → `"19.999820"`, with thousands separators.
 */
export function formatUsdcAtomic(atomic: string | bigint): string {
  let value: bigint;
  try {
    value = typeof atomic === "bigint" ? atomic : BigInt(atomic);
  } catch {
    return "—";
  }
  const negative = value < BigInt(0);
  const abs = negative ? -value : value;
  const scale = BigInt(10) ** BigInt(USDC_DECIMALS);
  const whole = (abs / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (abs % scale).toString().padStart(USDC_DECIMALS, "0");
  return `${negative ? "\u2212" : ""}${whole}.${fraction}`;
}

/** `"18"` → `"18 atomic units"`, `"1"` → `"1 atomic unit"`. */
export function atomicUnitsLabel(atomic: string): string {
  return `${atomic} atomic ${atomic === "1" ? "unit" : "units"}`;
}

// ---------------------------------------------------------------------------
// Addresses and links
// ---------------------------------------------------------------------------

/** `0xE2A9aA92…5f5D` style: first 6 and last 4 characters. */
export function shortAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** Transaction hash shortened like Basescan: `0x3f9a1c…8e21`. */
export function shortHash(hash: string): string {
  return shortAddress(hash, 8, 6);
}

export function addressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function txUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

/** Public receiving address of a provider, or `null` for an unknown id. */
export function payeeOf(providerId: ProviderId): string | null {
  return Object.hasOwn(PAYEES, providerId) ? PAYEES[providerId as keyof typeof PAYEES] : null;
}

// ---------------------------------------------------------------------------
// Request input (what the console sends with a paid request)
// ---------------------------------------------------------------------------

interface ConditionRow {
  id: ProviderId;
  conditions: ProviderConditions;
  defaults: ProviderConditions;
}

/**
 * Only the provider fields that differ from fixture defaults, so the paid
 * request routes exactly like the console. `undefined` when nothing changed.
 */
export function modifiedConditions(rows: readonly ConditionRow[]): PaymentConditions | undefined {
  const out: PaymentConditions = {};
  let count = 0;
  for (const row of rows) {
    const patch: ConditionsPatch = {};
    let changed = false;
    for (const field of CONDITION_FIELDS) {
      if (row.conditions[field] !== row.defaults[field]) {
        (patch as Record<string, unknown>)[field] = row.conditions[field];
        changed = true;
      }
    }
    if (changed) {
      out[row.id] = patch;
      count += 1;
    }
  }
  return count > 0 ? out : undefined;
}

/** The console policy in the paid request's wire shape. */
export function paymentPolicy(policy: MarketView["policy"]): PaymentPolicy {
  return {
    maxPrice: policy.maxPrice,
    maxP95LatencyMs: policy.maxP95LatencyMs,
    maxDataAgeMs: policy.maxDataAgeMs,
    minSuccessRate: policy.minSuccessRate,
    preference: policy.preference,
    mode: policy.mode.kind === "pinned" ? { kind: "pinned", providerId: policy.mode.providerId } : { kind: "auto" },
  };
}

// ---------------------------------------------------------------------------
// Quote for the next paid request
// ---------------------------------------------------------------------------

export type QuoteBlocker =
  | { kind: "no-eligible"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "spend-cap"; message: string }
  | { kind: "no-bid"; message: string };

export interface PaymentQuoteView {
  marketId: MarketId;
  selection: RouteSelection;
  providerId: ProviderId | null;
  providerName: string | null;
  logo: string | null;
  /** "Lowest cost", "Lowest latency", "Freshest data", or "Pinned". */
  routeLabel: string;
  bidPrice: number | null;
  amounts: QuoteAmounts | null;
  payTo: string | null;
  /** Why a paid request cannot run now (checked before anything is signed). */
  blocker: QuoteBlocker | null;
  /** Pinned provider that fails the policy: requests still go to it. */
  violation: string | null;
  /**
   * Set when the console's active route differs from the per-request selection
   * (for example while an optimization switch waits for the cooldown).
   */
  consoleProviderName: string | null;
}

/**
 * The provider, price, and payee of the next paid request. Uses the same
 * stateless selection as the payments API (policy + current conditions), so
 * the preview names exactly who will be paid.
 */
export function buildPaymentQuote(view: Pick<MarketView, "id" | "policy" | "providers" | "route">): PaymentQuoteView {
  const conditions: Record<ProviderId, ProviderConditions> = {};
  for (const row of view.providers) conditions[row.id] = row.conditions;
  const selection = selectRoute(view.id, { policy: view.policy, conditions });
  const fixture = selection.providerId ? getProviderFixture(view.id, selection.providerId) : undefined;
  const bidPrice = selection.bidPrice;
  const amounts = bidPrice === null ? null : quoteAmounts(bidPrice);
  const pinned = selection.policy.mode.kind === "pinned";
  const name = fixture?.name ?? null;

  let blocker: QuoteBlocker | null = null;
  if (!selection.providerId || selection.kind === "no-eligible") {
    blocker = { kind: "no-eligible", message: "No provider meets the routing policy. Nothing will be paid." };
  } else if (selection.conditions && !selection.conditions.available) {
    blocker = { kind: "unavailable", message: `${name} is unavailable. A paid request would fail before settlement.` };
  } else if (!amounts) {
    blocker = { kind: "no-bid", message: `${name} has no positive bid.` };
  } else if (Number(amounts.settledAtomic) > SPEND_CAP_ATOMIC) {
    blocker = {
      kind: "spend-cap",
      message: `${name} bids above the ${SPEND_CAP_ATOMIC}-unit per-request spend cap ($${SPEND_CAP_ATOMIC.toFixed(2)} /M req).`,
    };
  }

  const violation =
    selection.kind === "pinned-failing" && selection.violations.length > 0
      ? `Pinned provider fails your policy: ${selection.violations.map((reason) => reason.message).join(", ")}.`
      : null;

  const consoleId = view.route.activeProviderId;
  const consoleProviderName =
    consoleId && selection.providerId && consoleId !== selection.providerId
      ? (getProviderFixture(view.id, consoleId)?.name ?? null)
      : null;

  return {
    marketId: view.id,
    selection,
    providerId: selection.providerId,
    providerName: name,
    logo: fixture?.logo ?? null,
    routeLabel: pinned ? "Pinned" : PREFERENCE_LABELS[selection.policy.preference],
    bidPrice,
    amounts,
    payTo: selection.providerId ? payeeOf(selection.providerId) : null,
    blocker,
    violation,
    consoleProviderName,
  };
}

// ---------------------------------------------------------------------------
// Paid response summary
// ---------------------------------------------------------------------------

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** One line for a paid response: "61°F Overcast" or "$75,230.75". */
export function summarizePayload(marketId: MarketId, payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null;
  if (typeof payload.unit === "string" && finite(payload.price)) {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: payload.price < 100 ? 4 : 2 }).format(payload.price)} ${payload.unit}`;
  }
  if (MARKETS[marketId].units.dataAge === "ms") {
    if (!finite(payload.price)) return null;
    const abs = Math.abs(payload.price);
    // Pairs priced near $1 (FX, XRP) need more decimals than BTC/ETH to be meaningful.
    const decimals = abs < 10 ? 4 : 2;
    const text = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(abs);
    return `${payload.price < 0 ? "\u2212" : ""}$${text}`;
  }
  if (!finite(payload.temperature_f)) return null;
  const rounded = Math.round(payload.temperature_f);
  const temperature = `${rounded < 0 ? "\u2212" : ""}${Math.abs(rounded)}°F`;
  return typeof payload.condition === "string" && payload.condition ? `${temperature} ${payload.condition}` : temperature;
}
