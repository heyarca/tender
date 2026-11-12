// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreditsSection } from "@/components/credits/credits-section";
import { useCreditsStore } from "@/components/credits/credits-store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getMarketSpec, sampleFor } from "@/lib/registry";
import { createTenderStore, TenderProvider } from "@/lib/tender/client";
import { MarketUiProvider } from "../market-ui";
import { RequestInputs } from "./request-inputs";
import { MarketOverview } from "./market-overview";
import { useMarketView } from "@/lib/tender/client";

vi.mock("@/components/credits/add-funds-dialog", () => ({ AddFundsDialog: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Overview({ marketId }: { marketId: string }) {
  return <MarketOverview view={useMarketView(marketId)} />;
}

describe("paid request inputs", () => {
  it.each([
    ["translate-en-ko", "text", "Please translate this"],
    ["chat-general", "prompt", "Explain an API"],
    ["address-geocode", "query", "Seoul Station"],
    ["web-metadata", "url", "https://example.com/?a=1&b=two"],
  ])("uses submitted inputs for %s, not a later draft", async (marketId, key, submitted) => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetcher);
    useCreditsStore.setState({ status: "ready", balanceMicros: 1_000_000 });
    const store = createTenderStore();
    render(<TenderProvider store={store}><TooltipProvider><MarketUiProvider>
      <RequestInputs marketId={marketId} /><Overview marketId={marketId} /><CreditsSection marketId={marketId} />
    </MarketUiProvider></TooltipProvider></TenderProvider>);
    expect(fetcher).not.toHaveBeenCalled();
    expect(store.api.getState().markets[marketId].requests).toEqual([]);
    const input = document.getElementById(`request-${marketId}-${key}`)!;
    const run = screen.getByRole("button", { name: "Run with credits" });
    fireEvent.change(input, { target: { value: " " } });
    expect((run as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: submitted } });
    fireEvent.click(run);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0] as unknown as [string];
    expect(new URL(call[0], "https://tender.test").searchParams.get(key)).toBe(submitted);
    fireEvent.change(input, { target: { value: "Next request" } });
    const market = store.api.getState().markets[marketId];
    await act(async () => finish(Response.json({
      request_id: "req_input", provider: market.route.activeProviderId,
      latency_ms: 20, data_age_ms: 0, price_usd: 0.000001,
      params: { [key]: submitted }, data: sampleFor(getMarketSpec(marketId)!),
      payment: { method: "credits", charged_micros: 1, balance_micros: 999_999 },
    })));
    await waitFor(() => expect(screen.getByLabelText("Source input").textContent).toContain(submitted));
    expect(screen.getByLabelText("Source input").textContent).not.toContain("Next request");
    expect(store.api.getState().markets[marketId].requests[0]).toMatchObject({ source: "credits", params: { [key]: submitted } });
  });
});
