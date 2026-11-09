// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePaidRequest } from "./client";

afterEach(() => vi.unstubAllGlobals());
describe("paid request client hook", () => {
  it("exposes typed HTTP failure and resets it for the next request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ error: "Slow down" }, { status: 429, headers: { "Retry-After": "60" } })).mockRejectedValueOnce(new Error("Network offline")));
    const { result } = renderHook(() => usePaidRequest("btc-usd"));
    await act(async () => { await result.current.run(); });
    expect(result.current).toMatchObject({ pending: false, error: "Slow down", stage: "failed", failure: { status: 429, message: "Slow down", retryAfterSeconds: 60 } });
    await act(async () => { await result.current.run(); });
    expect(result.current.failure).toEqual({ status: 0, message: "Network offline" });
  });
});
