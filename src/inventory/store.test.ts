import { beforeEach, describe, expect, it } from "vitest";
import {
  loadInventory,
  normalizeInventoryItems,
  saveInventory,
} from "./store";
import type { GroupItem, HostItem } from "./types";

describe("inventory store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("normalizeInventoryItems", () => {
    it("filters out invalid records and normalizes fields", () => {
      const raw = [
        null,
        "string-item",
        { kind: "unknown", id: "1" },
        {
          id: "grp-1",
          kind: "group",
          name: "Dev",
          parentId: null,
          createdAt: 12345,
        },
        {
          id: "host-1",
          kind: "host",
          name: "Box",
          parentId: "grp-1",
          address: "1.2.3.4",
          port: 99999, // invalid port, should fallback to 22
          username: "admin",
          authMethod: "invalid-auth", // should fallback to password
        },
      ];

      const normalized = normalizeInventoryItems(raw);
      expect(normalized.length).toBe(2);

      const group = normalized[0] as GroupItem;
      expect(group.kind).toBe("group");
      expect(group.name).toBe("Dev");

      const host = normalized[1] as HostItem;
      expect(host.kind).toBe("host");
      expect(host.port).toBe(22);
      expect(host.authMethod).toBe("password");
    });
  });

  describe("loadInventory & saveInventory", () => {
    it("loads empty inventory on clean storage", () => {
      expect(loadInventory()).toEqual({ items: [] });
    });

    it("saves and loads items correctly", () => {
      const host: HostItem = {
        id: "h1",
        kind: "host",
        name: "Test",
        parentId: null,
        createdAt: 1000,
        address: "localhost",
        port: 22,
        username: "user",
        authMethod: "password",
        password: "pw",
        privateKey: "",
      };

      saveInventory({ items: [host] });
      const loaded = loadInventory();
      expect(loaded.items.length).toBe(1);
      expect(loaded.items[0].name).toBe("Test");
    });

    it("handles corrupted json safely", () => {
      localStorage.setItem("foxinal-inventory", "{ bad json content");
      expect(loadInventory()).toEqual({ items: [] });
    });
  });
});
