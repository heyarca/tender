// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { PAYEES } from "@/lib/payments/payees";
import { createTenderStore, TenderProvider, type TenderStore } from "@/lib/tender/client";

import { MarketUiProvider } from "../../market-ui";
import { PaymentsSection } from "../payments-section";
import { paymentsStore, RECORDS_STORAGE_KEY } from "../payments-store";

const PAYER = "0xd04E205d98127221AFBAb52CeF6870067C8549EA";
const TX = `0x${"85".repeat(32)}`;

beforeAll(() => {
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

function balancesBody(payerAtomic = "19999940") {
  return {
    network: "base-sepolia",
    asset: "USDC",
    tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payer: { id: "payer", address: PAYER, amountAtomic: payerAtomic, amountUsd: (Number(payerAtomic) / 1e6).toString() },
    payees: Object.entries(PAYEES).map(([id, address]) => ({ id, address, amountAtomic: "36", amountUsd: "0.000036" })),
  };
}

function paidResult(providerId: string, providerName: string, atomic: number) {
  return {
    response: { provider: providerId, latency_ms: 140, data_age_ms: 360_000, temperature_f: 61.2, condition: "Overcast" },
    receipt: {
      price_usd: atomic / 1e6,
      settled_usd: atomic / 1e6,
      settled_atomic: String(atomic),
      txHash: TX,
      amountUsd: atomic / 1e6,
      amountAtomic: String(atomic),
      asset: "USDC",
      payer: PAYER,
      payTo: PAYEES[providerId as keyof typeof PAYEES],
      providerId,
      providerName,
      latency_ms: 140,
      data_age_ms: 360_000,
      network: "base-sepolia",
      explorerUrl: `https://sepolia.basescan.org/tx/${TX}`,
    },
  };
}

/** NDJSON response whose events are pushed by the test. */
function streamResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => { controller = c; } });
  const encoder = new TextEncoder();
  return {
    response: new Response(body, { headers: { "content-type": "application/x-ndjson" } }),
    push: (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)),
    close: () => controller.close(),
  };
}

type Handler = (init: RequestInit | undefined) => Promise<Response> | Response;

function mockFetch(paid: Handler) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/api/payments/balances")) return Response.json(balancesBody());
    if (url.includes("/api/payments/demo-request")) return paid(init);
    throw new Error(`Unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function mount(store: TenderStore = createTenderStore(), marketId: "sf-weather" | "btc-usd" = "sf-weather") {
  const view = render(
    <TenderProvider store={store}>
      <TooltipProvider>
        <MarketUiProvider>
          <PaymentsSection key={marketId} marketId={marketId} />
        </MarketUiProvider>
      </TooltipProvider>
    </TenderProvider>,
  );
  return { ...view, store };
}

const runButton = () => screen.getByRole("button", { name: /run paid request|paying/i });
const stepStatus = (id: string) => document.querySelector(`[data-step="${id}"]`)?.getAttribute("data-status");
const paidCalls = (calls: { url: string; init?: RequestInit }[]) => calls.filter((call) => call.url.includes("demo-request"));

beforeEach(() => {
  window.localStorage.clear();
  paymentsStore.reset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PaymentsSection", () => {
  it("quotes the next paid request and shows the payer balance", async () => {
    mockFetch(() => Response.json({}));
    mount();
    expect(screen.getByRole("heading", { name: "Pay with USDC" })).toBeTruthy();
    const quote = document.querySelector('[data-slot="payment-quote"]') as HTMLElement;
    expect(within(quote).getByText("Fernline")).toBeTruthy();
    expect(within(quote).getByText("$0.000018")).toBeTruthy();
    expect(within(quote).getByText("0.000018")).toBeTruthy();
    expect(screen.getByText("Testnet")).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-slot="payer-balance"]')?.textContent).toBe("19.999940"));
    expect((runButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("No paid requests yet")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/demo|simulat|mock/i);
  });

  it("follows the streamed stages and renders the receipt", async () => {
    const stream = streamResponse();
    const calls = mockFetch(() => stream.response);
    mount();
    await waitFor(() => expect(document.querySelector('[data-slot="payer-balance"]')).toBeTruthy());

    fireEvent.click(runButton());
    await waitFor(() => expect(runButton().textContent).toContain("Paying"));
    expect(stepStatus("payment-required")).toBe("current");
    const body = JSON.parse(String(paidCalls(calls)[0].init?.body));
    expect(body).toEqual({
      market: "sf-weather",
      policy: { maxPrice: 40, maxP95LatencyMs: 400, maxDataAgeMs: 900_000, minSuccessRate: 0.995, preference: "lowest-cost", mode: { kind: "auto" } },
    });

    await act(async () => stream.push({ type: "payment-required", providerId: "fernline", payTo: PAYEES.fernline, settled_atomic: "18" }));
    await waitFor(() => expect(stepStatus("payment-required")).toBe("complete"));
    expect(stepStatus("signed")).toBe("current");

    await act(async () => stream.push({ type: "signed" }));
    await waitFor(() => expect(stepStatus("settled")).toBe("current"));

    await act(async () => {
      stream.push({ type: "result", result: paidResult("fernline", "Fernline", 18) });
      stream.close();
    });
    await waitFor(() => expect(stepStatus("served")).toBe("complete"));
    expect(runButton().textContent).toContain("Run paid request");

    const receipt = document.querySelector('[data-slot="payment-receipt"]') as HTMLElement;
    expect(within(receipt).getByText("Fernline")).toBeTruthy();
    expect(within(receipt).getByText("61°F Overcast")).toBeTruthy();
    const txLink = within(receipt).getByRole("link", { name: new RegExp(`Transaction ${TX}`) });
    expect(txLink.getAttribute("href")).toBe(`https://sepolia.basescan.org/tx/${TX}`);
    expect(txLink.getAttribute("target")).toBe("_blank");
    expect(document.querySelector(`[data-tx="${TX}"]`)).toBeTruthy();
    expect(screen.getByText(/Settled 0.000018 USDC to Fernline/)).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(RECORDS_STORAGE_KEY)!).records["sf-weather"][0].id).toBe(TX);
    await waitFor(() => expect(calls.filter((call) => call.url.includes("balances")).length).toBeGreaterThanOrEqual(2));
  });

  it("sends edited provider conditions so the paid request pays the rerouted provider", async () => {
    const calls = mockFetch(() => Response.json(paidResult("kitefin", "Kitefin", 22)));
    const { store } = mount();
    act(() => store.actions.updateProvider("sf-weather", "fernline", { bidPrice: 45 }));
    const quote = document.querySelector('[data-slot="payment-quote"]') as HTMLElement;
    await waitFor(() => expect(within(quote).getByText("Kitefin")).toBeTruthy());
    expect(screen.getByText(/edited conditions for Fernline/)).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-slot="payer-balance"]')).toBeTruthy());

    fireEvent.click(runButton());
    await waitFor(() => expect(document.querySelector('[data-slot="payment-receipt"]')).toBeTruthy());
    const body = JSON.parse(String(paidCalls(calls)[0].init?.body));
    expect(body.conditions).toEqual({ fernline: { bidPrice: 45 } });
    expect(document.querySelector('[data-slot="payment-receipt"]')?.textContent).toContain("Kitefin");
  });

  it("shows the rate limit and blocks retries until Retry-After passes", async () => {
    mockFetch(() => Response.json({ error: "Payment request limit reached" }, { status: 429, headers: { "Retry-After": "60" } }));
    mount();
    await waitFor(() => expect(document.querySelector('[data-slot="payer-balance"]')).toBeTruthy());
    fireEvent.click(runButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Payment request limit reached");
    await waitFor(() => expect((runButton() as HTMLButtonElement).disabled).toBe(true));
    expect(document.getElementById("payments-run-status")?.textContent).toMatch(/Try again in \d+ s/);
    expect(stepStatus("payment-required")).toBe("upcoming");
  });

  it("marks a provider error as served-failed and not settled", async () => {
    mockFetch(() =>
      Response.json(
        { error: "Paid request did not complete; inspect the response before trying again", details: { response: { error: { code: "provider_error", message: "502 Bad Gateway" } } } },
        { status: 502 },
      ),
    );
    mount();
    await waitFor(() => expect(document.querySelector('[data-slot="payer-balance"]')).toBeTruthy());
    fireEvent.click(runButton());
    expect((await screen.findByRole("alert")).textContent).toContain("Provider error");
    expect(stepStatus("served")).toBe("failed");
    expect(stepStatus("settled")).toBe("skipped");
    expect(document.querySelector('[data-slot="payment-receipt"]')).toBeNull();
  });

  it("does not request payment when no provider qualifies", async () => {
    const calls = mockFetch(() => Response.json({}));
    const { store } = mount();
    act(() => store.actions.setPolicy("sf-weather", { maxPrice: 1 }));
    await waitFor(() => expect(screen.getByText("No eligible provider")).toBeTruthy());
    expect((runButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(runButton());
    expect(paidCalls(calls)).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Edit routing policy" })).toBeTruthy();
  });

  it("keeps receipts per market across remounts and discloses rounding", async () => {
    mockFetch(() => Response.json(paidResult("fernline", "Fernline", 18)));
    const first = mount();
    await waitFor(() => expect(document.querySelector('[data-slot="payer-balance"]')).toBeTruthy());
    fireEvent.click(runButton());
    await waitFor(() => expect(document.querySelector('[data-slot="payment-receipt"]')).toBeTruthy());
    first.unmount();

    mount(createTenderStore(), "btc-usd");
    expect(screen.getByText("No paid requests yet")).toBeTruthy();
    expect(screen.getByText(/Rounded up to the USDC minimum unit \(0\.000001\)/)).toBeTruthy();
    cleanup();

    mount(createTenderStore(), "sf-weather");
    expect(document.querySelector('[data-slot="payment-receipt"]')?.textContent).toContain("Fernline");
  });

  it("previews five receipts and expands the table on request", async () => {
    mockFetch(() => Response.json({}));
    const base = paidResult("fernline", "Fernline", 18).receipt;
    const records = Array.from({ length: 7 }, (_, index) => {
      const txHash = `0x${String(index + 1).padStart(2, "0").repeat(32)}`;
      return { id: txHash, at: 1_000 + index, receipt: { ...base, txHash, explorerUrl: `https://sepolia.basescan.org/tx/${txHash}` }, summary: "61°F Overcast" };
    });
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify({ version: 1, records: { "sf-weather": records } }));
    mount();
    const grid = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-slot="payment-receipts"]');
      expect(element?.querySelector("[role=grid]")?.getAttribute("aria-label")).toBe("Recent paid requests");
      return element!;
    });
    // Removed rows animate out before AG Grid drops them, so wait for the count to settle.
    const rows = () => grid.querySelectorAll(".ag-center-cols-container .ag-row[row-id]").length;
    await waitFor(() => expect(rows()).toBe(5));
    fireEvent.click(screen.getByRole("button", { name: "Show all 7" }));
    await waitFor(() => expect(rows()).toBe(7));
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    await waitFor(() => expect(rows()).toBe(5));
  });
});
