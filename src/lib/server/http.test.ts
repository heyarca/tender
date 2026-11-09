import { describe, expect, it } from "vitest";
import { OPTIONS as marketsOptions } from "../../app/api/v1/markets/route";
import { OPTIONS as spotOptions } from "../../app/api/v1/prices/spot/route";
import { ApiError, errorResponse, json } from "./http";
import { HEAD as spotHead, POST as spotPost } from "../../app/api/v1/prices/spot/route";
import { POST as weatherPost } from "../../app/api/v1/weather/current/route";
import { POST as marketsPost } from "../../app/api/v1/markets/route";
import { POST as marketPost } from "../../app/api/v1/markets/[market]/route";
import { POST as openapiPost } from "../../app/api/v1/openapi.json/route";

describe("method-not-allowed responses", () => {
  it("pairs every 405 with an Allow header naming GET", () => {
    const response = errorResponse(new ApiError(405, "method_not_allowed", "Use GET for this contract"));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });
  it.each([
    ["prices/spot HEAD", spotHead()],
    ["prices/spot POST", spotPost()],
    ["weather/current POST", weatherPost()],
    ["markets POST", marketsPost()],
    ["markets/[market] POST", marketPost()],
    ["openapi.json POST", openapiPost()],
  ])("%s returns 405 with Allow: GET", (_name, response) => {
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("returns the shared method_not_allowed error body on route-level 405s", async () => {
    expect(await marketsPost().json()).toEqual({ error: { code: "method_not_allowed", message: "Use GET for this resource" } });
    expect(await spotPost().json()).toEqual({ error: { code: "method_not_allowed", message: "Use GET for this contract" } });
  });
  it("answers CORS preflight with 204 and the decided headers", async () => {
    for (const response of [marketsOptions(), spotOptions()]) {
      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("PAYMENT-SIGNATURE, X-PAYMENT, Content-Type, Tender-Max-Price, Tender-Max-P95-Ms, Tender-Max-Data-Age-Ms, Tender-Min-Success-Rate, Tender-Preference, Tender-Pin");
      expect(response.headers.get("Access-Control-Max-Age")).toBe("600");
    }
  });
  it("marks every JSON response callable cross-origin", () => {
    expect(json({}).headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(marketsPost().headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  it("keeps HEAD responses bodyless", async () => {
    expect(await spotHead().text()).toBe("");
  });
});
