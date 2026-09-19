import { describe, expect, it } from "vitest";
import {
  breadcrumbPath,
  canMoveItem,
  childrenOf,
  collectSubtreeIds,
  defaultHostInput,
  findItem,
  hostInputFromItem,
  hostSummary,
  isDescendantOf,
  matchesInventorySearch,
  nextCopyName,
  normalizeHostInput,
  relativeLocationLabel,
  siblingNameExists,
  type GroupItem,
  type HostItem,
  type InventoryItem,
} from "./types";

const mockGroup: GroupItem = {
  id: "group-prod",
  kind: "group",
  name: "Production",
  parentId: null,
  createdAt: 1000,
};

const mockSubGroup: GroupItem = {
  id: "group-db",
  kind: "group",
  name: "Databases",
  parentId: "group-prod",
  createdAt: 1001,
};

const mockHost1: HostItem = {
  id: "host-1",
  kind: "host",
  name: "Postgres Master",
  address: "10.0.0.5",
  port: 22,
  username: "postgres",
  authMethod: "password",
  password: "secret",
  privateKey: "",
  parentId: "group-db",
  createdAt: 1002,
};

const mockHost2: HostItem = {
  id: "host-2",
  kind: "host",
  name: "Redis Cache",
  address: "10.0.0.6",
  port: 2222,
  username: "redis",
  authMethod: "key",
  password: "",
  privateKey: "---KEY---",
  parentId: null,
  createdAt: 1003,
};

const items: InventoryItem[] = [mockGroup, mockSubGroup, mockHost1, mockHost2];

describe("inventory types helpers", () => {
  describe("hostSummary", () => {
    it("formats standard port 22 without explicit port", () => {
      expect(hostSummary(mockHost1)).toBe("postgres@10.0.0.5");
    });

    it("formats custom port explicitly", () => {
      expect(hostSummary(mockHost2)).toBe("redis@10.0.0.6:2222");
    });

    it("handles missing username", () => {
      const hostNoUser = { ...mockHost1, username: "" };
      expect(hostSummary(hostNoUser)).toBe("10.0.0.5");
    });
  });

  describe("childrenOf", () => {
    it("sorts groups before hosts, then alphabetically", () => {
      const rootChildren = childrenOf(items, null);
      expect(rootChildren.length).toBe(2);
      expect(rootChildren[0].id).toBe("group-prod");
      expect(rootChildren[1].id).toBe("host-2");
    });
  });

  describe("breadcrumbPath", () => {
    it("returns empty array for root (null)", () => {
      expect(breadcrumbPath(items, null)).toEqual([]);
    });

    it("returns hierarchy leading to subgroup", () => {
      const path = breadcrumbPath(items, "group-db");
      expect(path.map((g) => g.id)).toEqual(["group-prod", "group-db"]);
    });
  });

  describe("collectSubtreeIds", () => {
    it("collects root id and all descendants", () => {
      const subtree = collectSubtreeIds(items, "group-prod");
      expect(subtree.has("group-prod")).toBe(true);
      expect(subtree.has("group-db")).toBe(true);
      expect(subtree.has("host-1")).toBe(true);
      expect(subtree.has("host-2")).toBe(false);
    });
  });

  describe("isDescendantOf", () => {
    it("returns true for root null", () => {
      expect(isDescendantOf(items, mockHost1, null)).toBe(true);
    });

    it("detects direct and indirect descendants", () => {
      expect(isDescendantOf(items, mockHost1, "group-db")).toBe(true);
      expect(isDescendantOf(items, mockHost1, "group-prod")).toBe(true);
      expect(isDescendantOf(items, mockHost2, "group-prod")).toBe(false);
    });
  });

  describe("relativeLocationLabel", () => {
    it("returns null if item is a direct child of browsing group", () => {
      expect(relativeLocationLabel(items, mockHost1, "group-db")).toBeNull();
      expect(relativeLocationLabel(items, mockHost2, null)).toBeNull();
    });

    it("returns relative folder label when browsing from ancestor or root", () => {
      expect(relativeLocationLabel(items, mockHost1, null)).toBe("Production / Databases");
      expect(relativeLocationLabel(items, mockHost1, "group-prod")).toBe("Databases");
    });
  });

  describe("matchesInventorySearch", () => {
    it("matches against name, username, address, or summary", () => {
      expect(matchesInventorySearch(mockHost1, "postgres")).toBe(true);
      expect(matchesInventorySearch(mockHost1, "10.0.0.5")).toBe(true);
      expect(matchesInventorySearch(mockHost2, "redis")).toBe(true);
      expect(matchesInventorySearch(mockGroup, "Production")).toBe(true);
      expect(matchesInventorySearch(mockGroup, "NonExistent")).toBe(false);
    });
  });

  describe("normalizeHostInput", () => {
    it("normalizes valid host input", () => {
      const input = {
        name: "  Web  ",
        address: "  1.1.1.1  ",
        port: 22,
        username: "root",
        authMethod: "password" as const,
        password: "secret",
        privateKey: "ignored",
      };
      const normalized = normalizeHostInput(input);
      expect(normalized).not.toBeNull();
      expect(normalized?.name).toBe("Web");
      expect(normalized?.address).toBe("1.1.1.1");
      expect(normalized?.privateKey).toBe("");
    });

    it("rejects invalid ports or empty addresses", () => {
      const base = defaultHostInput();
      expect(normalizeHostInput({ ...base, address: "", username: "root" })).toBeNull();
      expect(normalizeHostInput({ ...base, address: "1.1.1.1", username: "" })).toBeNull();
      expect(normalizeHostInput({ ...base, address: "1.1.1.1", username: "root", port: -1 })).toBeNull();
      expect(normalizeHostInput({ ...base, address: "1.1.1.1", username: "root", port: 99999 })).toBeNull();
    });
  });

  describe("siblingNameExists & nextCopyName", () => {
    it("checks for sibling name collisions case-insensitively", () => {
      expect(siblingNameExists(items, null, "production")).toBe(true);
      expect(siblingNameExists(items, null, "Production")).toBe(true);
      expect(siblingNameExists(items, null, "Staging")).toBe(false);
    });

    it("generates next copy names incrementally", () => {
      expect(nextCopyName(items, null, "Redis Cache")).toBe("Redis Cache copy");
      const withFirstCopy = [
        ...items,
        { ...mockHost2, id: "host-2-copy", name: "Redis Cache copy" },
      ];
      expect(nextCopyName(withFirstCopy, null, "Redis Cache")).toBe("Redis Cache copy 2");
    });
  });

  describe("canMoveItem", () => {
    it("returns error if moving item does not exist", () => {
      const res = canMoveItem(items, "ghost-id", "group-prod");
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error("Expected missing item to fail");
      expect(res.error).toBe("Item not found.");
    });

    it("rejects moving item to the same parent folder", () => {
      const res = canMoveItem(items, "host-1", "group-db");
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error("Expected same parent to fail");
      expect(res.error).toBe("Already in that folder.");
    });

    it("rejects dropping an item onto a non-group host item", () => {
      const res = canMoveItem(items, "host-1", "host-2");
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error("Expected drop onto host to fail");
      expect(res.error).toBe("Drop onto a group or breadcrumb.");
    });

    it("rejects moving a group into itself or into its descendant", () => {
      const resSelf = canMoveItem(items, "group-prod", "group-prod");
      expect(resSelf.ok).toBe(false);

      const resSub = canMoveItem(items, "group-prod", "group-db");
      expect(resSub.ok).toBe(false);
      if (resSub.ok) throw new Error("Expected move into descendant to fail");
      expect(resSub.error).toBe("Can't move a group into itself or one of its nested groups.");
    });

    it("rejects moving if destination folder already contains a sibling with the same name", () => {
      // In items, root (null) has "group-prod" ("Production") and "host-2" ("Redis Cache")
      // In "group-prod", let's create a scenario where an item has same name as a root item
      const customItems: InventoryItem[] = [
        ...items,
        {
          id: "host-dup",
          kind: "host",
          name: "Redis Cache", // Duplicate of host-2 at root
          address: "10.0.0.9",
          port: 22,
          username: "admin",
          authMethod: "password",
          password: "",
          privateKey: "",
          parentId: "group-prod",
          createdAt: 1004,
        },
      ];

      // Try moving host-dup from "group-prod" to root (null), where "Redis Cache" already exists
      const res = canMoveItem(customItems, "host-dup", null);
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error("Expected name collision to fail");
      expect(res.error).toBe("A group or host with this name already exists there.");
    });

    it("allows valid moves to root or other groups", () => {
      const resToGroup = canMoveItem(items, "host-2", "group-prod");
      expect(resToGroup.ok).toBe(true);

      const resToRoot = canMoveItem(items, "host-1", null);
      expect(resToRoot.ok).toBe(true);
    });
  });

  describe("findItem & hostInputFromItem", () => {
    it("finds item by id or returns undefined", () => {
      expect(findItem(items, "host-1")?.name).toBe("Postgres Master");
      expect(findItem(items, "non-existent")).toBeUndefined();
    });

    it("converts host item to HostInput form state", () => {
      const input = hostInputFromItem(mockHost1);
      expect(input.name).toBe("Postgres Master");
      expect(input.address).toBe("10.0.0.5");
      expect(input.port).toBe(22);
      expect(input.authMethod).toBe("password");
    });
  });
});
