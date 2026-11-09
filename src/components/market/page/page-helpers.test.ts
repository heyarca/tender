import { describe, expect, it } from "vitest";
import {
  createInitialState,
  getDefaultPolicy,
  MARKETS,
  reduce,
  selectMarketViewFromState,
  type RequestResult,
  type RouteEvent,
  type TenderState,
} from "@/lib/tender";
import { buildCurlSnippet, contractPath, contractUrl, policyQuery, settlementQuote } from "./api-snippets";
import { isSectionId, topNavLinks } from "./market-top-nav";
import {
  providerIdsOf,
  toBitcoinQuote,
  toPricePoints,
  toResultRequest,
  toTimelineRequests,
  toWeatherReading,
  vizProvidersOf,
} from "./result-mapping";
import { routeEventToast } from "./route-toast-copy";
import { splitUnit } from "./stat-values";

const T0 = createInitialState().now;

function run(state: TenderState, actions: ((now: number) => Parameters<typeof reduce>[1])[]): TenderState {
  return actions.reduce((current, build, index) => reduce(current, build(T0 + (index + 1) * 1000)), state);
}

describe("result mapping", () => {
  const state = run(createInitialState(), [
    (now) => ({ type: "run-request", marketId: "sf-weather", now }),
    (now) => ({ type: "run-request", marketId: "btc-usd", now }),
  ]);
  const weather = selectMarketViewFromState(state, "sf-weather");
  const btc = selectMarketViewFromState(state, "btc-usd");

  it("maps a served request to the result request shape", () => {
    const request = toResultRequest(weather.lastResult, weather.providersById);
    expect(request).toMatchObject({ status: "ok", provider: { id: "together", name: "Together", logo: "/providers/together.png" } });
    expect(request?.id).toMatch(/^req_\d{6}$/);
    expect(request?.latencyMs).toBeGreaterThan(0);
  });

  it("maps failed and rejected requests", () => {
    const failed: RequestResult = {
      status: "failed",
      marketId: "sf-weather",
      providerId: "nebius",
      providerName: "Nebius",
      latencyMs: 120,
      error: { code: 503, message: "Service Unavailable" },
      cost: 0,
      requestId: "req_000010",
      requestedAt: T0,
      routingMode: "pinned",
    };
    expect(toResultRequest(failed, weather.providersById)).toEqual({
      id: "req_000010",
      status: "failed",
      provider: { id: "nebius", name: "Nebius", logo: "/providers/nebius.png" },
      latencyMs: 120,
      error: "503 Service Unavailable",
    });
    const rejected: RequestResult = {
      status: "rejected",
      marketId: "sf-weather",
      providerId: null,
      reason: "No eligible provider",
      cost: 0,
      requestId: "req_000011",
      requestedAt: T0,
      routingMode: "auto",
    };
    expect(toResultRequest(rejected, weather.providersById)).toEqual({
      id: "req_000011",
      status: "rejected",
      provider: null,
      latencyMs: null,
      error: "No eligible provider",
    });
    expect(toResultRequest(null, weather.providersById)).toBeNull();
  });

  it("maps payloads per market and ignores the other market", () => {
    const reading = toWeatherReading(weather.lastServed);
    expect(reading).toMatchObject({ location: "San Francisco, CA", condition: expect.any(String) });
    expect(reading?.temperatureF).toBeGreaterThan(50);
    expect(toWeatherReading(btc.lastServed)).toBeNull();

    const quote = toBitcoinQuote(btc.lastServed);
    expect(quote?.pair).toBe("BTC/USD");
    expect(quote?.price).toBeGreaterThan(70_000);
    expect(toBitcoinQuote(weather.lastServed)).toBeNull();
  });

  it("builds chart points with failed requests marked, in time order", () => {
    const failed: RequestResult = {
      status: "failed",
      marketId: "btc-usd",
      providerId: "parasail",
      providerName: "Parasail",
      latencyMs: 90,
      error: { code: 502, message: "Bad Gateway" },
      cost: 0,
      requestId: "req_000099",
      requestedAt: btc.series[btc.series.length - 1].at + 500,
      routingMode: "auto",
    };
    const points = toPricePoints(btc.series, [failed, ...btc.recentResults]);
    expect(points).toHaveLength(btc.series.length + 1);
    expect(points.at(-1)).toMatchObject({ status: "failed", providerId: "parasail", id: "req_000099" });
    for (let i = 1; i < points.length; i += 1) expect(points[i].t).toBeGreaterThanOrEqual(points[i - 1].t);
  });

  it("orders the latency strip oldest first and drops latency for rejected requests", () => {
    const strict = run(state, [
      (now) => ({ type: "set-policy", marketId: "sf-weather", patch: { maxPrice: 1 }, now }),
      (now) => ({ type: "run-request", marketId: "sf-weather", now }),
    ]);
    const view = selectMarketViewFromState(strict, "sf-weather");
    const timeline = toTimelineRequests(view.recentResults);
    expect(timeline.map((r) => r.id)).toEqual([...view.recentResults].reverse().map((r) => r.requestId));
    expect(timeline.at(-1)).toMatchObject({ status: "rejected", latencyMs: null, providerId: null });
  });

  it("gives every provider a stable color in fixture order", () => {
    const providers = vizProvidersOf(MARKETS["sf-weather"]);
    expect(providerIdsOf(MARKETS["sf-weather"])[0]).toBe("together");
    expect(providers.together).toMatchObject({ name: "Together", logo: "/providers/together.png", color: "var(--chart-1)" });
    expect(providers.deepinfra.color).toBe("var(--chart-2)");
  });
});

describe("API snippets", () => {
  it("serializes the policy with API units", () => {
    expect(policyQuery(getDefaultPolicy("sf-weather"))).toBe(
      "max_price=40&max_p95_ms=400&max_data_age_ms=900000&min_success_rate=0.995&preference=lowest-cost",
    );
    const pinned = { ...getDefaultPolicy("btc-usd"), mode: { kind: "pinned" as const, providerId: "novita" } };
    expect(policyQuery(pinned)).toContain("&pin=novita");
  });

  it("points at each market's contract endpoint", () => {
    expect(contractPath("sf-weather")).toBe("/api/v1/weather/current?location=san-francisco");
    expect(contractPath("btc-usd")).toBe("/api/v1/prices/spot?pair=BTC-USD");
    expect(contractUrl("https://tender.test/", "btc-usd", getDefaultPolicy("btc-usd"))).toBe(
      "https://tender.test/api/v1/prices/spot?pair=BTC-USD&max_price=2&max_p95_ms=150&max_data_age_ms=1000&min_success_rate=0.999&preference=lowest-cost",
    );
  });

  it("walks through the 402 challenge and the signed retry", () => {
    const curl = buildCurlSnippet("http://localhost:3111/", "sf-weather", getDefaultPolicy("sf-weather"));
    expect(curl).toContain("BASE=http://localhost:3111\n");
    expect(curl).toContain('POLICY="max_price=40&');
    expect(curl).toContain('curl -sS "$BASE/api/v1/markets/sf-weather?$POLICY"');
    expect(curl).toContain('curl -i "$BASE/api/v1/weather/current?location=san-francisco&$POLICY"');
    expect(curl).toContain('-H "PAYMENT-SIGNATURE: $PAYMENT_SIGNATURE"');
  });

  it("rounds settlement up to whole USDC atomic units, never to zero", () => {
    expect(settlementQuote(18)).toEqual({ priceUsd: 0.000018, settledAtomic: 18, settledUsd: 0.000018, rounded: false });
    expect(settlementQuote(0.7)).toMatchObject({ settledAtomic: 1, settledUsd: 0.000001, rounded: true });
    expect(settlementQuote(27.5)).toMatchObject({ settledAtomic: 28, rounded: true });
    expect(settlementQuote(0)).toMatchObject({ settledAtomic: 1 });
  });
});

describe("route toasts", () => {
  const context = { marketName: "San Francisco Weather", current: true, recommendedProviderId: null };

  function events(state: TenderState): RouteEvent[] {
    return state.markets["sf-weather"].activity.filter(
      (entry): entry is RouteEvent =>
        entry.notify && (entry.kind === "route-switch" || entry.kind === "no-eligible" || entry.kind === "pin-violation"),
    );
  }

  it("names the new provider and the trigger of a failover", () => {
    const state = run(createInitialState(), [
      (now) => ({ type: "update-provider", marketId: "sf-weather", providerId: "together", patch: { p95LatencyMs: 640 }, now }),
    ]);
    const [event] = events(state);
    expect(event.kind).toBe("route-switch");
    const toastSpec = routeEventToast(event, context);
    expect(toastSpec).toMatchObject({ id: "route-sf-weather", title: "Switched to DeepInfra", tone: "warning" });
    expect(toastSpec.description).toContain("P95 640 ms exceeds 400 ms");
    expect(toastSpec.action).toBeUndefined();
  });

  it("offers to edit the policy when no provider qualifies", () => {
    const state = run(createInitialState(), [
      (now) => ({ type: "set-policy", marketId: "sf-weather", patch: { maxPrice: 1 }, now }),
    ]);
    const [event] = events(state);
    const toastSpec = routeEventToast(event, context);
    expect(toastSpec).toMatchObject({ id: "route-sf-weather", title: "No eligible provider", tone: "negative" });
    expect(toastSpec.description).toMatch(/Requests are rejected and nothing is sent\.$/);
    expect(toastSpec.action).toEqual({ kind: "edit-policy", label: "Edit policy" });
  });

  it("surfaces a pinned violation with a switch action", () => {
    const state = run(createInitialState(), [
      (now) => ({ type: "set-routing-mode", marketId: "sf-weather", mode: { kind: "pinned", providerId: "cloudflare" }, now }),
    ]);
    const event = events(state).find((entry) => entry.kind === "pin-violation");
    expect(event).toBeDefined();
    const toastSpec = routeEventToast(event!, { ...context, recommendedProviderId: "together" });
    expect(toastSpec).toMatchObject({
      id: "pin-sf-weather",
      title: "Pinned provider Cloudflare fails your policy",
      description: "P95 640 ms exceeds 400 ms. Requests still go to Cloudflare.",
      action: { kind: "switch-to-recommended", label: "Switch to Together" },
    });
    expect(routeEventToast(event!, context).action).toEqual({ kind: "use-automatic", label: "Use automatic switching" });
  });

  it("prefixes events of the other market and offers to open it", () => {
    const state = run(createInitialState(), [
      (now) => ({ type: "update-provider", marketId: "sf-weather", providerId: "together", patch: { available: false }, now }),
    ]);
    const [event] = events(state);
    const toastSpec = routeEventToast(event, { ...context, current: false });
    expect(toastSpec.title).toBe("San Francisco Weather: Switched to DeepInfra");
    expect(toastSpec.action).toEqual({ kind: "view-market", label: "View market", marketId: "sf-weather" });
  });
});

describe("page helpers", () => {
  it("splits formatted values into number and unit", () => {
    expect(splitUnit("210 ms")).toEqual(["210", "ms"]);
    expect(splitUnit("1 h 12 min")).toEqual(["1 h 12", "min"]);
    expect(splitUnit("99.94%")).toEqual(["99.94%", ""]);
  });

  it("links the TopNav to the market, its sections, and the API dialog", () => {
    expect(topNavLinks("btc-usd").map((link) => link.href)).toEqual([
      "/markets/btc-usd",
      "#providers",
      "#routing",
      "#payments",
      "#activity",
      "#api",
    ]);
    expect(isSectionId("conditions")).toBe(true);
    expect(isSectionId("api")).toBe(false);
  });
});
