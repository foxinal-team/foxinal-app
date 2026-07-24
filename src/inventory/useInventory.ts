import { useEffect, useState } from "react";
import { loadInventory, saveInventory } from "./store";
import {
  breadcrumbPath,
  canMoveItem,
  childrenOf,
  collectSubtreeIds,
  createId,
  findItem,
  nextCopyName,
  normalizeHostInput,
  siblingNameExists,
  type HostInput,
  type HostItem,
  type InventoryItem,
} from "./types";

export type SaveResult = { ok: true } | { ok: false; error: string };

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>(() => loadInventory().items);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

  useEffect(() => {
    saveInventory({ items });
  }, [items]);

  const currentChildren = childrenOf(items, currentGroupId);
  const breadcrumbs = breadcrumbPath(items, currentGroupId);
  const currentGroup = currentGroupId
    ? findItem(items, currentGroupId)
    : undefined;

  function createGroup(name: string): SaveResult {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Enter a group name." };
    if (siblingNameExists(items, currentGroupId, trimmed)) {
      return {
        ok: false,
        error: "A group or host with this name already exists here.",
      };
    }

    const item: InventoryItem = {
      id: createId(),
      kind: "group",
      name: trimmed,
      parentId: currentGroupId,
      createdAt: Date.now(),
    };

    setItems((prev) => [...prev, item]);
    return { ok: true };
  }

  function createHost(input: HostInput): SaveResult {
    const normalized = normalizeHostInput(input);
    if (!normalized) {
      return { ok: false, error: "Enter a valid address, username, and port." };
    }
    if (siblingNameExists(items, currentGroupId, normalized.name)) {
      return {
        ok: false,
        error: "A group or host with this name already exists here.",
      };
    }

    const item: HostItem = {
      id: createId(),
      kind: "host",
      parentId: currentGroupId,
      createdAt: Date.now(),
      ...normalized,
    };

    setItems((prev) => [...prev, item]);
    return { ok: true };
  }

  function renameGroup(id: string, name: string): SaveResult {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Enter a group name." };

    const target = findItem(items, id);
    if (!target || target.kind !== "group") {
      return { ok: false, error: "Group not found." };
    }
    if (siblingNameExists(items, target.parentId, trimmed, id)) {
      return {
        ok: false,
        error: "A group or host with this name already exists here.",
      };
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.kind === "group"
          ? { ...item, name: trimmed }
          : item,
      ),
    );
    return { ok: true };
  }

  function updateHost(id: string, input: HostInput): SaveResult {
    const normalized = normalizeHostInput(input);
    if (!normalized) {
      return { ok: false, error: "Enter a valid address, username, and port." };
    }

    const target = findItem(items, id);
    if (!target || target.kind !== "host") {
      return { ok: false, error: "Host not found." };
    }
    if (siblingNameExists(items, target.parentId, normalized.name, id)) {
      return {
        ok: false,
        error: "A group or host with this name already exists here.",
      };
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.kind === "host"
          ? { ...item, ...normalized }
          : item,
      ),
    );
    return { ok: true };
  }

  function buildDuplicateHostInput(host: HostItem): HostInput {
    return {
      name: nextCopyName(items, host.parentId, host.name),
      address: host.address,
      port: host.port,
      username: host.username,
      authMethod: host.authMethod,
      password: host.password,
      privateKey: host.privateKey,
    };
  }

  function deleteGroup(id: string) {
    const target = findItem(items, id);
    if (!target || target.kind !== "group") return false;

    const removeIds = collectSubtreeIds(items, id);
    const viewingDeleted =
      currentGroupId !== null && removeIds.has(currentGroupId);

    setItems((prev) => prev.filter((item) => !removeIds.has(item.id)));

    if (viewingDeleted) {
      setCurrentGroupId(target.parentId);
    }

    return true;
  }

  function deleteHost(id: string) {
    const target = findItem(items, id);
    if (!target || target.kind !== "host") return false;

    setItems((prev) => prev.filter((item) => item.id !== id));
    return true;
  }

  function moveItem(itemId: string, newParentId: string | null): SaveResult {
    const check = canMoveItem(items, itemId, newParentId);
    if (!check.ok) return check;

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, parentId: newParentId } : item,
      ),
    );
    return { ok: true };
  }

  function openGroup(id: string) {
    setCurrentGroupId(id);
  }

  function replaceItems(next: InventoryItem[]) {
    setItems(next);
  }

  function goToRoot() {
    setCurrentGroupId(null);
  }

  function goToGroup(id: string | null) {
    if (id === null) {
      goToRoot();
      return;
    }
    openGroup(id);
  }

  return {
    items,
    currentGroupId,
    currentGroup,
    currentChildren,
    breadcrumbs,
    createGroup,
    createHost,
    renameGroup,
    updateHost,
    buildDuplicateHostInput,
    deleteGroup,
    deleteHost,
    moveItem,
    replaceItems,
    openGroup,
    goToRoot,
    goToGroup,
  };
}
