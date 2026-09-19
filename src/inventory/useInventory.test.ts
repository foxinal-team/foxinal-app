import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useInventory } from "./useInventory";
import type { HostInput, HostItem, InventoryItem } from "./types";

describe("useInventory hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with initial items", () => {
    const { result } = renderHook(() => useInventory(null, []));
    expect(result.current.items).toEqual([]);
    expect(result.current.currentGroupId).toBeNull();
  });

  it("creates a group, renames it, and validates unique names", () => {
    const { result } = renderHook(() => useInventory(null, []));

    act(() => {
      const res = result.current.createGroup("Backend");
      expect(res.ok).toBe(true);
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].name).toBe("Backend");
    const groupId = result.current.items[0].id;

    // Duplicate name should fail
    act(() => {
      const res = result.current.createGroup("Backend");
      expect(res.ok).toBe(false);
    });

    // Rename group
    act(() => {
      const renameRes = result.current.renameGroup(groupId, "Backend Services");
      expect(renameRes.ok).toBe(true);
    });
    expect(result.current.items[0].name).toBe("Backend Services");
  });

  it("creates, updates, and duplicates a host", () => {
    const { result } = renderHook(() => useInventory(null, []));

    const hostInput: HostInput = {
      name: "API Node",
      address: "api.domain.com",
      port: 22,
      username: "ubuntu",
      authMethod: "password",
      password: "123",
      privateKey: "",
    };

    act(() => {
      const res = result.current.createHost(hostInput);
      expect(res.ok).toBe(true);
    });

    expect(result.current.items.length).toBe(1);
    const hostId = result.current.items[0].id;

    // Update host
    act(() => {
      const updateRes = result.current.updateHost(hostId, {
        ...hostInput,
        name: "API Node Updated",
      });
      expect(updateRes.ok).toBe(true);
    });

    expect(result.current.items[0].name).toBe("API Node Updated");

    // Duplicate host
    act(() => {
      const hostToDup = result.current.items[0] as HostItem;
      const dupInput = result.current.buildDuplicateHostInput(hostToDup);
      const dupRes = result.current.createHost(dupInput);
      expect(dupRes.ok).toBe(true);
    });

    expect(result.current.items.length).toBe(2);
    expect(result.current.items[1].name).toBe("API Node Updated copy");

    // Delete host
    act(() => {
      result.current.deleteHost(hostId);
    });
    expect(result.current.items.length).toBe(1);
  });

  it("deletes group and recursively removes child items", () => {
    const initialItems: InventoryItem[] = [
      {
        id: "g1",
        kind: "group",
        name: "Servers",
        parentId: null,
        createdAt: 1000,
      },
      {
        id: "h1",
        kind: "host",
        name: "Web",
        parentId: "g1",
        address: "1.1.1.1",
        port: 22,
        username: "root",
        authMethod: "password",
        password: "",
        privateKey: "",
        createdAt: 1001,
      },
    ];

    const { result } = renderHook(() => useInventory(null, initialItems));

    act(() => {
      result.current.deleteGroup("g1");
    });

    // Both group and child host should be deleted
    expect(result.current.items.length).toBe(0);
  });

  it("navigates into groups and back to root", () => {
    const initialItems: InventoryItem[] = [
      {
        id: "g1",
        kind: "group",
        name: "Servers",
        parentId: null,
        createdAt: 1000,
      },
    ];

    const { result } = renderHook(() => useInventory(null, initialItems));

    act(() => {
      result.current.goToGroup("g1");
    });
    expect(result.current.currentGroupId).toBe("g1");

    act(() => {
      result.current.goToGroup(null);
    });
    expect(result.current.currentGroupId).toBeNull();
  });

  it("moves item between folders and replaces items", () => {
    const initialItems: InventoryItem[] = [
      {
        id: "g1",
        kind: "group",
        name: "Servers",
        parentId: null,
        createdAt: 1000,
      },
      {
        id: "h1",
        kind: "host",
        name: "Web",
        parentId: null,
        address: "1.1.1.1",
        port: 22,
        username: "root",
        authMethod: "password",
        password: "",
        privateKey: "",
        createdAt: 1001,
      },
    ];

    const { result } = renderHook(() => useInventory(null, initialItems));

    act(() => {
      const moveRes = result.current.moveItem("h1", "g1");
      expect(moveRes.ok).toBe(true);
    });

    const movedHost = result.current.items.find((i) => i.id === "h1");
    expect(movedHost?.parentId).toBe("g1");

    act(() => {
      result.current.replaceItems([]);
    });
    expect(result.current.items).toEqual([]);
  });
});
