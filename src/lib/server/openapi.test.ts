import { describe, expect, it } from "vitest";
import { openapiDocument } from "./openapi";
import { GET } from "../../app/api/v1/openapi.json/route";
describe("OpenAPI", () => {
  it("serves an OpenAPI 3.1 document for all five public routes", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    const doc = await response.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toHaveLength(5);
  });
  it("resolves every schema reference and uses unique operation ids", () => {
    const refs: string[] = [];
    const walk = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (key === "$ref") refs.push(child as string);
        else walk(child);
      }
    };
    walk(openapiDocument);
    for (const path of refs) expect(openapiDocument.components.schemas).toHaveProperty(path.replace("#/components/schemas/", ""));
    const ids = Object.values(openapiDocument.paths).map((p) => p.get.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("documents x402, routing, and explicit minimum-unit settlement", () => {
    const operation = openapiDocument.paths["/prices/spot"].get;
    expect(operation.responses["402"].headers).toHaveProperty("PAYMENT-REQUIRED");
    expect(operation.responses["200"].headers).toHaveProperty("PAYMENT-RESPONSE");
    expect(operation.parameters.some((p) => p.name === "PAYMENT-SIGNATURE")).toBe(true);
    expect(openapiDocument.components.schemas.PriceResult.properties).toHaveProperty("settled_atomic");
  });
  it("documents the CORS preflight on every path", () => {
    for (const path of Object.keys(openapiDocument.paths) as (keyof typeof openapiDocument.paths)[]) {
      const options = openapiDocument.paths[path].options;
      expect(options, path).toBeDefined();
      expect(options.summary).toBe("CORS preflight");
      expect(options.responses["204"]).toBeDefined();
    }
  });
  it("documents a 405 with an Allow header on every GET operation", () => {
    for (const path of Object.keys(openapiDocument.paths) as (keyof typeof openapiDocument.paths)[]) {
      const notAllowed = openapiDocument.paths[path].get.responses["405"];
      expect(notAllowed, path).toBeDefined();
      expect(notAllowed.headers).toHaveProperty("Allow");
    }
  });
  it("lists the settlement response headers on every paid operation and status", () => {
    for (const path of ["/prices/spot", "/weather/current"] as const) {
      for (const status of ["200", "402"] as const) {
        const headers = openapiDocument.paths[path].get.responses[status].headers;
        expect(headers["Tender-Price-USD"], `${path} ${status}`).toBeDefined();
        expect(headers["Tender-Settled-Atomic"], `${path} ${status}`).toBeDefined();
      }
    }
  });
});
