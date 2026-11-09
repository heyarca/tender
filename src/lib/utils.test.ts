import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps semantic font sizes next to text colors", () => {
    expect(cn("text-body", "text-muted-foreground")).toBe("text-body text-muted-foreground");
    expect(cn("text-caption text-positive-text")).toBe("text-caption text-positive-text");
  });

  it("resolves conflicts within the same group", () => {
    expect(cn("text-muted-foreground", "text-foreground")).toBe("text-foreground");
    expect(cn("text-caption", "text-body")).toBe("text-body");
    expect(cn("px-2", "px-3")).toBe("px-3");
  });
});
