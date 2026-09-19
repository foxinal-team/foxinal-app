import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("utils cn", () => {
  it("merges class names correctly", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional falsy values", () => {
    expect(cn("px-2", false && "py-1", null, undefined, "")).toBe("px-2");
  });

  it("resolves conflicting tailwind classes with precedence", () => {
    expect(cn("px-2 text-red-500", "px-4 text-blue-500")).toBe("px-4 text-blue-500");
  });
});
