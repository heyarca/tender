import { beforeEach, describe, expect, it, vi } from "vitest";
import { serveWithCredits } from "./credits";

const handleContract = vi.hoisted(() => vi.fn(async () => Response.json({ ok: true })));
vi.mock("./handlers", () => ({ handleContract }));

const requestUrl = () => new URL((handleContract.mock.calls[0] as unknown as [Request])[0].url);

beforeEach(() => handleContract.mockClear());

describe("serveWithCredits", () => {
  it("passes contract inputs and keeps the approved routing policy", async () => {
    await serveWithCredits({ accountId: "acct_x", actor: "agent", marketId: "translate-en-ko", params: { text: " Hello " }, policy: { maxPrice: 20 } });
    const url = requestUrl();
    expect(url.searchParams.get("text")).toBe("Hello");
    expect(url.searchParams.get("max_price")).toBe("20");
  });

  it("refuses params that are not contract inputs, so they cannot pin a provider or change limits", async () => {
    const result = await serveWithCredits({
      accountId: "acct_x",
      actor: "agent",
      marketId: "translate-en-ko",
      params: { text: "hi", pin: "some-provider", max_price: "999999" },
      policy: { maxPrice: 20 },
    });
    expect(result.status).toBe(400);
    expect(handleContract).not.toHaveBeenCalled();
  });
});
