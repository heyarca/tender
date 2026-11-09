import { describe, expect, it } from "vitest";
import { getMarketDefinition } from "@/lib/tender";
import { contractInput, marketForContract } from "./handlers";
import { marketDetail } from "./markets";

const IDS = ["sz-mlcc", "lithium-carbonate", "freight-sha-lax"] as const;

describe("real-world goods markets", () => {
  it("route through prices.spot, label sample data, and have an eligible route", () => {
    for (const id of IDS) {
      const market = getMarketDefinition(id);
      expect(market.priceDefinition).toMatch(/sample index\. Not a live/);
      expect(marketForContract("price", contractInput(id).value)).toBe(id);
      expect(marketDetail(new Request(`https://tender.test/api/v1/markets/${id}`), id).routing.active_provider).not.toBeNull();
    }
  });
  it("ranks Arca Labs first on Shenzhen MLCC", () => {
    expect(marketDetail(new Request("https://tender.test/api/v1/markets/sz-mlcc"), "sz-mlcc").routing.active_provider).toBe("arca-labs");
  });
});
