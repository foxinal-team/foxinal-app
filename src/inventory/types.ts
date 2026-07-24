export type InventoryKind = "group" | "host";
export type HostAuthMethod = "password" | "key";

export type HostConfig = {
  address: string;
  port: number;
  username: string;
  authMethod: HostAuthMethod;
  password: string;
  privateKey: string;
};

export type GroupItem = {
  id: string;
  kind: "group";
  name: string;
  parentId: string | null;
  createdAt: number;
};

export type HostItem = {
  id: string;
  kind: "host";
  name: string;
  parentId: string | null;
  createdAt: number;
} & HostConfig;

export type InventoryItem = GroupItem | HostItem;

export type InventoryState = {
  items: InventoryItem[];
};

export type HostInput = {
  name: string;
  address: string;
  port: number;
  username: string;
  authMethod: HostAuthMethod;
  password: string;
  privateKey: string;
};

export const DEFAULT_SSH_PORT = 22;

export const INVENTORY_STORAGE_KEY = "foxinal-inventory";

export function createId(): string {
  return crypto.randomUUID();
}

export function emptyInventory(): InventoryState {
  return { items: [] };
}

export function defaultHostInput(): HostInput {
  return {
    name: "",
    address: "",
    port: DEFAULT_SSH_PORT,
    username: "",
    authMethod: "password",
    password: "",
    privateKey: "",
  };
}

export function hostInputFromItem(host: HostItem): HostInput {
  return {
    name: host.name,
    address: host.address,
    port: host.port,
    username: host.username,
    authMethod: host.authMethod,
    password: host.password,
    privateKey: host.privateKey,
  };
}

export function hostSummary(host: HostItem): string {
  const endpoint =
    host.port === DEFAULT_SSH_PORT
      ? host.address
      : `${host.address}:${host.port}`;
  if (host.username.trim()) return `${host.username}@${endpoint}`;
  return endpoint;
}

export function childrenOf(
  items: InventoryItem[],
  parentId: string | null,
): InventoryItem[] {
  return items
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "group" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function findItem(
  items: InventoryItem[],
  id: string,
): InventoryItem | undefined {
  return items.find((item) => item.id === id);
}

export function breadcrumbPath(
  items: InventoryItem[],
  groupId: string | null,
): InventoryItem[] {
  if (!groupId) return [];

  const path: InventoryItem[] = [];
  let current = findItem(items, groupId);

  while (current && current.kind === "group") {
    path.unshift(current);
    current = current.parentId ? findItem(items, current.parentId) : undefined;
  }

  return path;
}

/** Root id plus every nested child (groups and hosts). */
export function collectSubtreeIds(
  items: InventoryItem[],
  rootId: string,
): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;

  while (grew) {
    grew = false;
    for (const item of items) {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        grew = true;
      }
    }
  }

  return ids;
}

/** True if item lives under `rootId` (or anywhere when root is null). */
export function isDescendantOf(
  items: InventoryItem[],
  item: InventoryItem,
  rootId: string | null,
): boolean {
  if (rootId === null) return true;

  let parentId = item.parentId;
  while (parentId) {
    if (parentId === rootId) return true;
    parentId = findItem(items, parentId)?.parentId ?? null;
  }
  return false;
}

/**
 * Path label relative to the folder being browsed.
 * Returns null when the item is a direct child of `fromGroupId`.
 */
export function relativeLocationLabel(
  items: InventoryItem[],
  item: InventoryItem,
  fromGroupId: string | null,
): string | null {
  if (item.parentId === fromGroupId) return null;

  const parentPath = breadcrumbPath(items, item.parentId);
  if (fromGroupId === null) {
    const label = parentPath.map((group) => group.name).join(" / ");
    return label || null;
  }

  const anchor = parentPath.findIndex((group) => group.id === fromGroupId);
  const relative =
    anchor === -1 ? parentPath : parentPath.slice(anchor + 1);
  const label = relative.map((group) => group.name).join(" / ");
  return label || null;
}

export function matchesInventorySearch(
  item: InventoryItem,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (item.name.toLowerCase().includes(needle)) return true;
  if (item.kind !== "host") return false;
  return (
    hostSummary(item).toLowerCase().includes(needle) ||
    item.address.toLowerCase().includes(needle) ||
    item.username.toLowerCase().includes(needle)
  );
}

export function normalizeHostInput(input: HostInput): HostInput | null {
  const name = input.name.trim() || input.address.trim();
  const address = input.address.trim();
  const username = input.username.trim();
  const port = Number(input.port);

  if (!address || !username) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

  return {
    name,
    address,
    port,
    username,
    authMethod: input.authMethod === "key" ? "key" : "password",
    password: input.authMethod === "password" ? input.password : "",
    privateKey: input.authMethod === "key" ? input.privateKey.trim() : "",
  };
}

/** True if any sibling (group or host) under the same parent already uses this name. */
export function siblingNameExists(
  items: InventoryItem[],
  parentId: string | null,
  name: string,
  excludeId?: string,
): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  return items.some(
    (item) =>
      item.parentId === parentId &&
      item.id !== excludeId &&
      item.name.trim().toLowerCase() === needle,
  );
}

export function nextCopyName(
  items: InventoryItem[],
  parentId: string | null,
  baseName: string,
): string {
  const root = baseName.trim() || "Untitled";
  const first = `${root} copy`;
  if (!siblingNameExists(items, parentId, first)) return first;

  let n = 2;
  while (siblingNameExists(items, parentId, `${root} copy ${n}`)) {
    n += 1;
  }
  return `${root} copy ${n}`;
}

export type MoveResult = { ok: true } | { ok: false; error: string };

/** Whether `itemId` can be reparented under `newParentId` (null = inventory root). */
export function canMoveItem(
  items: InventoryItem[],
  itemId: string,
  newParentId: string | null,
): MoveResult {
  const item = findItem(items, itemId);
  if (!item) return { ok: false, error: "Item not found." };

  if (item.parentId === newParentId) {
    return { ok: false, error: "Already in that folder." };
  }

  if (newParentId !== null) {
    const parent = findItem(items, newParentId);
    if (!parent || parent.kind !== "group") {
      return { ok: false, error: "Drop onto a group or breadcrumb." };
    }
    if (item.kind === "group") {
      const subtree = collectSubtreeIds(items, item.id);
      if (subtree.has(newParentId)) {
        return {
          ok: false,
          error: "Can't move a group into itself or one of its nested groups.",
        };
      }
    }
  }

  if (siblingNameExists(items, newParentId, item.name, item.id)) {
    return {
      ok: false,
      error: "A group or host with this name already exists there.",
    };
  }

  return { ok: true };
}
