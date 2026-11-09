import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BitcoinResult, JsonView, ResultMeta, WeatherResult } from "@/components/result";
import { LatencyStrip, PriceChart, Sparkline, SuccessBars, type PricePoint } from "@/components/viz";

const T0 = Date.UTC(2026, 10, 9, 18, 30);
const points: PricePoint[] = Array.from({ length: 40 }, (_, i) => ({
  t: T0 + i * 2_000,
  price: 75_230.75 + Math.sin(i / 3) * 20,
  providerId: i < 20 ? "coreweave" : "parasail",
  status: i === 12 ? "failed" : "ok",
}));
const providers = {
  coreweave: { name: "CoreWeave", logo: "/providers/coreweave.svg" },
  parasail: { name: "Parasail", logo: "/providers/parasail.png" },
};

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("server render", () => {
  it("renders sparklines for empty, single, and full series", () => {
    expect(render(createElement(Sparkline, { values: [] }))).toContain("<svg");
    expect(render(createElement(Sparkline, { values: [210] }))).toContain("<svg");
    const html = render(createElement(Sparkline, { values: [200, 210, 205, 640], limit: 400, tone: "warning" }));
    expect(html).toContain('data-slot="sparkline-limit"');
    expect(render(createElement(Sparkline, { values: [200, 210, 205], limit: 40_000 }))).toContain(
      'data-slot="sparkline-limit-edge"',
    );
  });

  it("renders the price chart at the default width with markers and failures", () => {
    const html = render(createElement(PriceChart, { points, providers, timeZone: "UTC" }));
    expect(html).toContain('width="640"');
    expect(html).toContain('data-slot="provider-change"');
    expect(html).toContain('data-slot="failed-request"');
    expect(html).toContain("18:30:30");
    expect(render(createElement(PriceChart, { points: [] }))).toContain("No prices yet");
  });

  it("renders the latency strip, including rejected requests", () => {
    const html = render(
      createElement(LatencyStrip, {
        requests: [
          { id: "req_1", t: T0, latencyMs: 120, providerId: "together", status: "ok" },
          { id: "req_2", t: T0 + 1, latencyMs: null, providerId: null, status: "rejected" },
          { id: "req_3", t: T0 + 2, latencyMs: 90, providerId: "deepinfra", status: "ok" },
        ],
        limitMs: 400,
      }),
    );
    expect(html).toContain('data-slot="latency-limit"');
    expect(html).toContain('data-slot="provider-change"');
    expect(html).toContain("400 ms");
  });

  it("renders success bars with tones", () => {
    const html = render(createElement(SuccessBars, { values: [0.9995, 0.992, 0.98], threshold: 0.995 }));
    expect(html).toContain('data-tone="positive"');
    expect(html).toContain('data-tone="warning"');
    expect(html).toContain('data-tone="negative"');
    expect(html).toContain("98.00%");
  });

  it("renders results in every state", () => {
    const reading = {
      location: "San Francisco, CA",
      observedAt: T0 - 360_000,
      dataAgeMs: 372_000,
      temperatureF: 61,
      feelsLikeF: 60,
      condition: "Overcast",
      humidityPct: 86,
      windMph: 9,
      windDirectionDeg: 278,
      pressureHpa: 1018,
      visibilityMi: 9.4,
      dewPointF: 57,
      cloudCoverPct: 100,
    };
    const ok = render(
      createElement(WeatherResult, {
        reading,
        request: { id: "req_000123", status: "ok", provider: { id: "together", name: "Together" }, latencyMs: 84 },
      }),
    );
    expect(ok).toContain("61°F");
    expect(ok).toContain("Overcast");
    expect(ok).toContain("Observed 10:24 AM PT");
    expect(ok).toContain("Served by");

    const failed = render(
      createElement(WeatherResult, {
        reading,
        request: {
          id: "req_000124",
          status: "failed",
          provider: { id: "nebius", name: "Nebius" },
          latencyMs: 1_240,
          error: "503 Service Unavailable",
        },
      }),
    );
    expect(failed).toContain("Nebius failed: 503 Service Unavailable");

    const rejected = render(
      createElement(BitcoinResult, {
        quote: { pair: "BTC/USD", price: 75_230.75, change: 3.25, sourceTimestamp: T0, dataAgeMs: 220, latencyMs: 84 },
        request: { id: "req_000125", status: "rejected", provider: null, latencyMs: null },
        points,
        providers,
      }),
    );
    expect(rejected).toContain("$75,230.75");
    expect(rejected).toContain("No eligible provider — request not sent");
    expect(rejected).toContain("Not sent");
  });

  it("renders the shared provider tile for a provider without a logo", () => {
    const meta = render(
      createElement(ResultMeta, {
        provider: { id: "sambanova", name: "SambaNova" },
        latencyMs: 84,
      }),
    );
    // ProviderLogo (src/components/ui/provider-logo): the one provider-tile implementation.
    expect(meta).toContain('data-slot="provider-logo"');
    expect(meta).toContain("uppercase");
    expect(meta.replace(/<[^>]+>/g, "")).toContain("S");
  });

  it("renders the provenance line and JSON", () => {
    const meta = render(
      createElement(ResultMeta, {
        provider: { id: "parasail", name: "Parasail", logo: "/providers/parasail.png" },
        latencyMs: 84,
        dataAgeMs: 220,
        requestId: "req_000123",
      }),
    );
    expect(meta).toContain('src="/providers/parasail.png"');
    expect(meta.replace(/<[^>]+>/g, "")).toContain("Served byParasail·84 ms·data age 220 ms·req_000123");
    expect(render(createElement(JsonView, { value: { a: 1 } }))).toContain("&quot;a&quot;");
  });
});
