import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./version";

describe("version", () => {
  it("exports a valid semver version string", () => {
    expect(APP_VERSION).toBeDefined();
    expect(typeof APP_VERSION).toBe("string");
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
