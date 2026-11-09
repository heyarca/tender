import { describe, expect, it } from "vitest";
import { paymentTransportHeaders } from "./transport";

describe("protected preview transport", () => {
  it("sends a bypass secret only to the configured HTTPS origin", () => {
    expect(paymentTransportHeaders(new URL("https://trusted.vercel.app/api"), undefined, "test-secret", "https://trusted.vercel.app").get("x-vercel-protection-bypass")).toBe("test-secret");
    for (const target of ["https://evil.test", "http://trusted.vercel.app", "https://user:pass@trusted.vercel.app"]) {
      expect(() => paymentTransportHeaders(new URL(target), undefined, "test-secret", "https://trusted.vercel.app")).toThrow();
    }
    expect(() => paymentTransportHeaders(new URL("https://trusted.vercel.app"), undefined, "test-secret")).toThrow();
  });
  it("never sends a bypass credential to localhost", () => {
    expect(paymentTransportHeaders(new URL("http://localhost:3106"), { "x-vercel-protection-bypass": "stale-secret" }, "test-secret").has("x-vercel-protection-bypass")).toBe(false);
  });
});
