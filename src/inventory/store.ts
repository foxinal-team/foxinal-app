import {
  emptyInventory,
  INVENTORY_STORAGE_KEY,
  DEFAULT_SSH_PORT,
  type GroupItem,
  type HostAuthMethod,
  type HostItem,
  type InventoryItem,
  type InventoryState,
} from "./types";

function isAuthMethod(value: unknown): value is HostAuthMethod {
  return value === "password" || value === "key";
}

function normalizeItem(raw: unknown): InventoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  if (typeof item.id !== "string") return null;
  if (typeof item.name !== "string") return null;
  if (!(item.parentId === null || typeof item.parentId === "string")) return null;

  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? item.createdAt
      : Date.now();

  if (item.kind === "group") {
    const group: GroupItem = {
      id: item.id,
      kind: "group",
      name: item.name,
      parentId: item.parentId,
      createdAt,
    };
    return group;
  }

  if (item.kind === "host") {
    const portRaw = item.port;
    const port =
      typeof portRaw === "number" && Number.isInteger(portRaw)
        ? portRaw
        : DEFAULT_SSH_PORT;

    const host: HostItem = {
      id: item.id,
      kind: "host",
      name: item.name,
      parentId: item.parentId,
      createdAt,
      address: typeof item.address === "string" ? item.address : "",
      port: port >= 1 && port <= 65535 ? port : DEFAULT_SSH_PORT,
      username: typeof item.username === "string" ? item.username : "",
      authMethod: isAuthMethod(item.authMethod) ? item.authMethod : "password",
      password: typeof item.password === "string" ? item.password : "",
      privateKey: typeof item.privateKey === "string" ? item.privateKey : "",
    };
    return host;
  }

  return null;
}

export function normalizeInventoryItems(rawItems: unknown[]): InventoryItem[] {
  return rawItems
    .map(normalizeItem)
    .filter((item): item is InventoryItem => item !== null);
}

export function loadInventory(): InventoryState {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return emptyInventory();

    const parsed = JSON.parse(raw) as InventoryState;
    if (!parsed || !Array.isArray(parsed.items)) return emptyInventory();

    return {
      items: normalizeInventoryItems(parsed.items),
    };
  } catch {
    return emptyInventory();
  }
}

export function saveInventory(state: InventoryState) {
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(state));
}
