import { beforeEach, describe, expect, it } from "vitest";
import {
  loadInventoryLayout,
  loadInventorySort,
  saveInventoryLayout,
  saveInventorySort,
} from "./viewPrefs";

describe("inventory viewPrefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads default layout as list", () => {
    expect(loadInventoryLayout()).toBe("list");
  });

  it("persists and loads grid layout", () => {
    saveInventoryLayout("grid");
    expect(loadInventoryLayout()).toBe("grid");
  });

  it("loads default sort as asc", () => {
    expect(loadInventorySort()).toBe("asc");
  });

  it("persists and loads desc sort", () => {
    saveInventorySort("desc");
    expect(loadInventorySort()).toBe("desc");
  });
});
