import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  basenameFromPath,
  buildExportPayload,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  exportFilename,
  isJsonPath,
  mergeImportedItems,
  parseExportPayload,
  readExportFile,
  readExportPath,
  revealInFolderLabel,
  shortPathForDisplay,
} from "./transfer";
import type { GroupItem, HostItem, InventoryItem } from "./types";

const mockGroup: GroupItem = {
  id: "grp-prod",
  kind: "group",
  name: "Production",
  parentId: null,
  createdAt: 1000,
};

const mockSubgroup: GroupItem = {
  id: "grp-db",
  kind: "group",
  name: "Databases",
  parentId: "grp-prod",
  createdAt: 1001,
};

const mockHost1: HostItem = {
  id: "host-pg",
  kind: "host",
  name: "Postgres Master",
  address: "10.0.0.5",
  port: 5432,
  username: "postgres",
  authMethod: "key",
  password: "",
  privateKey: "PRIVATE_KEY_DATA",
  parentId: "grp-db",
  createdAt: 1002,
};

const mockHost2: HostItem = {
  id: "host-web",
  kind: "host",
  name: "Web Edge",
  address: "edge.foxinal.dev",
  port: 22,
  username: "deploy",
  authMethod: "password",
  password: "secret_password",
  privateKey: "",
  parentId: "grp-prod",
  createdAt: 1003,
};

const mockRootHost: HostItem = {
  id: "host-standalone",
  kind: "host",
  name: "Bastion",
  address: "bastion.foxinal.dev",
  port: 2222,
  username: "admin",
  authMethod: "password",
  password: "",
  privateKey: "",
  parentId: null,
  createdAt: 1004,
};

const testInventory: InventoryItem[] = [
  mockGroup,
  mockSubgroup,
  mockHost1,
  mockHost2,
  mockRootHost,
];

describe("Inventory Transfer Suite", () => {
  describe("buildExportPayload", () => {
    it("exports entire inventory when scopeParentId is null", () => {
      const payload = buildExportPayload(testInventory, null);

      expect(payload.format).toBe(EXPORT_FORMAT);
      expect(payload.version).toBe(EXPORT_VERSION);
      expect(payload.scope).toBe("all");
      expect(payload.groupName).toBeUndefined();
      expect(payload.items.length).toBe(testInventory.length);

      // Verify all items are preserved
      const ids = payload.items.map((i) => i.id);
      expect(ids).toContain("grp-prod");
      expect(ids).toContain("grp-db");
      expect(ids).toContain("host-pg");
      expect(ids).toContain("host-web");
      expect(ids).toContain("host-standalone");
    });

    it("isolates group and descendants when exporting scoped group", () => {
      // Export "Production" group (which contains grp-db, host-web, and nested host-pg)
      const payload = buildExportPayload(testInventory, "grp-prod");

      expect(payload.scope).toBe("group");
      expect(payload.groupName).toBe("Production");
      expect(payload.items.length).toBe(3);

      const dbGroup = payload.items.find((i) => i.id === "grp-db");
      const webHost = payload.items.find((i) => i.id === "host-web");
      const pgHost = payload.items.find((i) => i.id === "host-pg");

      expect(dbGroup).toBeDefined();
      expect(webHost).toBeDefined();
      expect(pgHost).toBeDefined();

      // Invariant: Direct children of the exported group have parentId remapped to null
      expect(dbGroup!.parentId).toBeNull();
      expect(webHost!.parentId).toBeNull();
      // Invariant: Nested children pointing to an exported subgroup retain their parent link
      expect(pgHost!.parentId).toBe("grp-db");

      // Invariant: Items outside the exported subtree must NOT be present
      expect(payload.items.some((i) => i.id === "grp-prod")).toBe(false);
      expect(payload.items.some((i) => i.id === "host-standalone")).toBe(false);
    });

    it("severs parent link to null when exporting a leaf subgroup", () => {
      const payload = buildExportPayload(testInventory, "grp-db");
      expect(payload.scope).toBe("group");
      expect(payload.groupName).toBe("Databases");
      expect(payload.items.length).toBe(1);

      const pgHost = payload.items[0];
      expect(pgHost.id).toBe("host-pg");
      expect(pgHost.parentId).toBeNull(); // Severed from grp-db to null
    });

    it("handles non-existent scopeParentId gracefully", () => {
      const payload = buildExportPayload(testInventory, "non-existent-id");
      expect(payload.scope).toBe("group");
      expect(payload.groupName).toBeUndefined();
      expect(payload.items.length).toBe(0);
    });
  });

  describe("exportFilename", () => {
    it("generates date-stamped filename for full inventory", () => {
      const filename = exportFilename(null);
      expect(filename).toMatch(/^foxinal-inventory-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it("slugifies group name and handles special characters in filename", () => {
      const filename = exportFilename("grp-1", "EU-West // Production (K8s)!");
      expect(filename).toMatch(/^foxinal-eu-west-production-k8s-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it("falls back to default if group name slugifies to empty string", () => {
      const filename = exportFilename("grp-1", "   !@#$%^&*()   ");
      expect(filename).toMatch(/^foxinal-inventory-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  describe("parseExportPayload", () => {
    it("rejects non-object or null payloads", () => {
      expect(parseExportPayload(null)).toEqual({
        ok: false,
        error: "Invalid file: expected a JSON object.",
      });
      expect(parseExportPayload("string")).toEqual({
        ok: false,
        error: "Invalid file: expected a JSON object.",
      });
      expect(parseExportPayload(12345)).toEqual({
        ok: false,
        error: "Invalid file: expected a JSON object.",
      });
    });

    it("rejects wrong export format identifier", () => {
      const res = parseExportPayload({
        format: "other-tool-export",
        version: EXPORT_VERSION,
        items: [],
      });
      expect(res.ok).toBe(false);
      expect((res as { error: string }).error).toContain("not a foxinal inventory export");
    });

    it("rejects unsupported future schema versions", () => {
      const res = parseExportPayload({
        format: EXPORT_FORMAT,
        version: 999,
        items: [],
      });
      expect(res.ok).toBe(false);
      expect((res as { error: string }).error).toContain("Unsupported export version");
    });

    it("rejects payload missing items array", () => {
      const res = parseExportPayload({
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        items: "not-an-array",
      });
      expect(res.ok).toBe(false);
      expect((res as { error: string }).error).toContain("missing items list");
    });

    it("rejects payload where items contains only corrupt or unparseable objects", () => {
      const res = parseExportPayload({
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        items: [{ invalid: "data", random: 123 }],
      });
      expect(res.ok).toBe(false);
      expect((res as { error: string }).error).toContain("No valid groups or hosts found");
    });

    it("parses and normalizes valid export payload without conditional skips", () => {
      const payload = {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: 1700000000000,
        scope: "all",
        items: [mockGroup, mockHost1],
      };

      const res = parseExportPayload(payload);
      expect(res.ok).toBe(true);
      if (!res.ok || !res.items) throw new Error("Expected parse to succeed");

      expect(res.count).toBe(2);
      expect(res.items).toHaveLength(2);

      const parsedGroup = res.items.find((i) => i.id === "grp-prod") as GroupItem;
      const parsedHost = res.items.find((i) => i.id === "host-pg") as HostItem;

      expect(parsedGroup).toBeDefined();
      expect(parsedGroup.name).toBe("Production");
      expect(parsedGroup.kind).toBe("group");

      expect(parsedHost).toBeDefined();
      expect(parsedHost.name).toBe("Postgres Master");
      expect(parsedHost.port).toBe(5432);
      expect(parsedHost.authMethod).toBe("key");
      expect(parsedHost.privateKey).toBe("PRIVATE_KEY_DATA");
    });
  });

  describe("mergeImportedItems (Hierarchy & Invariants)", () => {
    it("returns an error if incoming list is empty", () => {
      const res = mergeImportedItems(testInventory, [], null);
      expect(res.ok).toBe(false);
      expect((res as { error: string }).error).toContain("nothing to import");
    });

    it("does NOT mutate the original existing array or objects", () => {
      const existingClone = JSON.parse(JSON.stringify(testInventory));
      const incoming = [
        {
          id: "new-host",
          kind: "host" as const,
          name: "Fresh Server",
          address: "fresh.dev",
          port: 22,
          username: "root",
          authMethod: "password" as const,
          password: "",
          privateKey: "",
          parentId: null,
          createdAt: 2000,
        },
      ];

      const res = mergeImportedItems(testInventory, incoming, null);
      expect(res.ok).toBe(true);
      expect(testInventory).toEqual(existingClone); // Existing array unchanged
    });

    it("imports 3-level deep hierarchy and remaps parent IDs accurately regardless of input order", () => {
      // Notice: Child host is intentionally listed FIRST, then subgroup, then root group!
      // This tests topological sorting (sortParentsFirst) in transfer.ts
      const scrambledIncoming: InventoryItem[] = [
        {
          id: "old-host-leaf",
          kind: "host",
          name: "Redis Cache",
          address: "10.10.0.9",
          port: 6379,
          username: "redis",
          authMethod: "password",
          password: "pw",
          privateKey: "",
          parentId: "old-subgroup",
          createdAt: 50,
        },
        {
          id: "old-subgroup",
          kind: "group",
          name: "Internal Services",
          parentId: "old-root-group",
          createdAt: 40,
        },
        {
          id: "old-root-group",
          kind: "group",
          name: "Staging Cluster",
          parentId: null,
          createdAt: 30,
        },
      ];

      // Merge under target group "grp-prod"
      const res = mergeImportedItems(testInventory, scrambledIncoming, "grp-prod");
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("Expected merge to succeed");

      expect(res.count).toBe(3);
      const merged = res.items!;
      expect(merged.length).toBe(testInventory.length + 3);

      const importedRoot = merged.find((i) => i.name === "Staging Cluster") as GroupItem;
      const importedSub = merged.find((i) => i.name === "Internal Services") as GroupItem;
      const importedHost = merged.find((i) => i.name === "Redis Cache") as HostItem;

      expect(importedRoot).toBeDefined();
      expect(importedSub).toBeDefined();
      expect(importedHost).toBeDefined();

      // INVARIANT 1: All imported items must have brand new unique IDs
      expect(importedRoot.id).not.toBe("old-root-group");
      expect(importedSub.id).not.toBe("old-subgroup");
      expect(importedHost.id).not.toBe("old-host-leaf");

      // INVARIANT 2: Top-level imported group's parentId must be the targetParentId
      expect(importedRoot.parentId).toBe("grp-prod");

      // INVARIANT 3: Subgroup's parentId must be remapped to the NEW ID of the root group
      expect(importedSub.parentId).toBe(importedRoot.id);

      // INVARIANT 4: Host's parentId must be remapped to the NEW ID of the subgroup
      expect(importedHost.parentId).toBe(importedSub.id);

      // INVARIANT 5: Host configuration properties preserved
      expect(importedHost.port).toBe(6379);
      expect(importedHost.username).toBe("redis");
    });

    it("resolves name collisions ONLY within the same parent folder", () => {
      // Existing: "Postgres Master" is under "grp-db". "Web Edge" is under "grp-prod".
      const incoming: InventoryItem[] = [
        {
          id: "inc-1",
          kind: "host",
          name: "Postgres Master", // Collides with existing in grp-db
          address: "10.0.0.99",
          port: 5432,
          username: "postgres",
          authMethod: "password",
          password: "",
          privateKey: "",
          parentId: null,
          createdAt: 3000,
        },
        {
          id: "inc-2",
          kind: "host",
          name: "Web Edge", // Same name as one in grp-prod, BUT we are importing into grp-db!
          address: "10.0.0.100",
          port: 22,
          username: "web",
          authMethod: "password",
          password: "",
          privateKey: "",
          parentId: null,
          createdAt: 3001,
        },
      ];

      const res = mergeImportedItems(testInventory, incoming, "grp-db");
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("Expected merge to succeed");

      const merged = res.items!;
      const importedCollision = merged.find((i) => i.kind === "host" && i.address === "10.0.0.99")!;
      const importedNonCollision = merged.find((i) => i.kind === "host" && i.address === "10.0.0.100")!;

      // "Postgres Master" was already inside grp-db -> must be renamed to "Postgres Master copy"
      expect(importedCollision.name).toBe("Postgres Master copy");

      // "Web Edge" was in grp-prod, NOT grp-db -> inside grp-db it has NO collision, name stays "Web Edge"!
      expect(importedNonCollision.name).toBe("Web Edge");
    });

    it("resolves multiple existing copy collisions incrementally", () => {
      const existingWithCopies: InventoryItem[] = [
        mockRootHost, // "Bastion" at root
        { ...mockRootHost, id: "copy-1", name: "Bastion copy" },
      ];

      const incoming: InventoryItem[] = [
        {
          ...mockRootHost,
          id: "inc-bastion",
          name: "Bastion",
        },
      ];

      const res = mergeImportedItems(existingWithCopies, incoming, null);
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("Expected merge to succeed");

      const imported = res.items!.find((i) => i.id !== "host-standalone" && i.id !== "copy-1")!;
      expect(imported.name).toBe("Bastion copy 2");
    });
  });

  describe("File and Tauri Path Reading", () => {
    it("reads and parses export from a File object", async () => {
      const validPayload = {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: Date.now(),
        scope: "all",
        items: [mockGroup],
      };

      const file = new File([JSON.stringify(validPayload)], "export.json", {
        type: "application/json",
      });

      const res = await readExportFile(file);
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("Expected file read to succeed");
      expect(res.count).toBe(1);
    });

    it("handles invalid JSON when reading File", async () => {
      const badFile = new File(["{ invalid json content"], "bad.json", {
        type: "application/json",
      });

      const res = await readExportFile(badFile);
      expect(res.ok).toBe(false);
      expect((res as { error: string }).error).toBe("Invalid JSON file.");
    });

    it("reads and parses export from filesystem path via Tauri invoke", async () => {
      const validPayload = {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: Date.now(),
        scope: "all",
        items: [mockGroup],
      };

      vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify(validPayload));

      const res = await readExportPath("/Users/dev/export.json");
      expect(invoke).toHaveBeenCalledWith("read_text_file", { path: "/Users/dev/export.json" });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("Expected path read to succeed");
      expect(res.count).toBe(1);
    });

    it("returns error message when Tauri invoke read_text_file fails", async () => {
      vi.mocked(invoke).mockRejectedValueOnce("Permission denied: cannot read file");

      const res = await readExportPath("/protected/export.json");
      expect(res.ok).toBe(false);
      expect((res as { error: string }).error).toBe("Permission denied: cannot read file");
    });
  });

  describe("Path & OS display helpers", () => {
    it("checks isJsonPath accurately case-insensitively", () => {
      expect(isJsonPath("test.JSON")).toBe(true);
      expect(isJsonPath("test.json")).toBe(true);
      expect(isJsonPath("test.yaml")).toBe(false);
      expect(isJsonPath("test.json.bak")).toBe(false);
    });

    it("extracts basename accurately across POSIX and Windows delimiters", () => {
      expect(basenameFromPath("/var/log/foxinal-export.json")).toBe("foxinal-export.json");
      expect(basenameFromPath("C:\\Users\\Admin\\foxinal-export.json")).toBe("foxinal-export.json");
      expect(basenameFromPath("standalone.json")).toBe("standalone.json");
    });

    it("shortens paths for display toasts while keeping last segments", () => {
      expect(shortPathForDisplay("/Users/danial/Downloads/inventory.json")).toBe("Downloads/inventory.json");
      expect(shortPathForDisplay("Downloads/inventory.json")).toBe("Downloads/inventory.json");
    });

    it("returns a non-empty revealInFolderLabel for the OS platform", () => {
      const label = revealInFolderLabel();
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    });
  });
});
