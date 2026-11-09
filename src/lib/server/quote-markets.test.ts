import { describe, expect, it } from "vitest";
import { MARKET_IDS, getMarketDefinition, sampleRequest } from "@/lib/tender";
import { QUOTE_MARKET_IDS } from "@/lib/tender/fixtures";
import { contractPath } from "@/components/market/page/api-snippets";
import { marketDetail } from "./markets";

describe("quote markets", () => {
  it("are listed, routable, and labelled as indicative sample data", () => {
    for (const id of QUOTE_MARKET_IDS) {
      expect(MARKET_IDS).toContain(id);
      const market = getMarketDefinition(id);
      expect(market.priceDefinition).toMatch(/sample index.*Not a live/);
      const detail = marketDetail(new Request(`https://tender.test/api/v1/markets/${id}`), id);
      expect(detail.routing.active_provider).not.toBeNull();
      const provider = market.providers[0];
      const { result } = sampleRequest({ marketId: id, providerId: provider.id, requestId: "req_1", now: Date.UTC(2026, 10, 9), seed: 7, conditions: { ...provider.defaults, errorRate: 0 } });
      expect(result.status).toBe("ok");
      if (result.status !== "ok" || result.payload.kind !== "quote") throw new Error("expected a quote");
      expect(result.payload.value).toBeGreaterThan(0);
      expect(contractPath(id)).toMatch(/^\/api\/v1\//);
    }
  });
});
