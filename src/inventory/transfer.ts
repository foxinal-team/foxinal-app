import { invoke } from "@tauri-apps/api/core";
import { normalizeInventoryItems } from "./store";
import {
  createId,
  findItem,
  isDescendantOf,
  nextCopyName,
  siblingNameExists,
  type InventoryItem,
} from "./types";

export const EXPORT_FORMAT = "foxinal-inventory" as const;
export const EXPORT_VERSION = 1;

export type FoxinalExport = {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  scope: "all" | "group";
  groupName?: string;
  items: InventoryItem[];
};

export type TransferResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "inventory"
  );
}

export function buildExportPayload(
  items: InventoryItem[],
  scopeParentId: string | null,
): FoxinalExport {
  const exported =
    scopeParentId === null
      ? items
      : items.filter((item) => isDescendantOf(items, item, scopeParentId));

  const exportedIds = new Set(exported.map((item) => item.id));
  const remapped = exported.map((item) => {
    let parentId = item.parentId;
    if (parentId === scopeParentId) parentId = null;
    else if (parentId && !exportedIds.has(parentId)) parentId = null;
    return { ...item, parentId };
  });

  const group =
    scopeParentId !== null ? findItem(items, scopeParentId) : undefined;

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    scope: scopeParentId ? "group" : "all",
    groupName:
      group && group.kind === "group" ? group.name : undefined,
    items: remapped,
  };
}

export function exportFilename(
  scopeParentId: string | null,
  groupName?: string,
): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (scopeParentId && groupName) {
    return `foxinal-${slugify(groupName)}-${stamp}.json`;
  }
  return `foxinal-inventory-${stamp}.json`;
}

export function downloadExport(payload: FoxinalExport, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Write export into Downloads via Tauri; returns the absolute file path. */
export async function writeExportFile(
  payload: FoxinalExport,
  filename: string,
): Promise<string> {
  return invoke<string>("write_export_file", {
    filename,
    contents: JSON.stringify(payload, null, 2),
  });
}

/** Prefer a short path for toasts; full path stays in the title tooltip. */
export function shortPathForDisplay(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  return parts.slice(-2).join("/");
}

/** Label for revealing a file in the OS file manager. */
export function revealInFolderLabel(): string {
  const platform = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (platform.includes("mac")) return "Show in Finder";
  if (platform.includes("win")) return "Show in File Explorer";
  // Linux: GNOME Files, Dolphin, Nautilus, etc.
  return "Show in Files";
}

function sortParentsFirst(items: InventoryItem[]): InventoryItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: InventoryItem[] = [];
  const seen = new Set<string>();

  function visit(id: string) {
    if (seen.has(id)) return;
    const item = byId.get(id);
    if (!item) return;
    seen.add(id);
    if (item.parentId && byId.has(item.parentId)) {
      visit(item.parentId);
    }
    ordered.push(item);
  }

  for (const item of items) visit(item.id);
  return ordered;
}

function resolveImportName(
  existing: InventoryItem[],
  parentId: string | null,
  name: string,
): string {
  const base = name.trim() || "Untitled";
  if (!siblingNameExists(existing, parentId, base)) return base;
  return nextCopyName(existing, parentId, base);
}

export function parseExportPayload(raw: unknown): TransferResult & {
  items?: InventoryItem[];
} {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid file: expected a JSON object." };
  }

  const data = raw as Record<string, unknown>;
  if (data.format !== EXPORT_FORMAT) {
    return {
      ok: false,
      error: "Invalid file: not a foxinal inventory export.",
    };
  }
  if (data.version !== EXPORT_VERSION) {
    return { ok: false, error: "Unsupported export version." };
  }
  if (!Array.isArray(data.items)) {
    return { ok: false, error: "Invalid file: missing items list." };
  }

  const items = normalizeInventoryItems(data.items);
  if (items.length === 0 && data.items.length > 0) {
    return { ok: false, error: "No valid groups or hosts found in the file." };
  }

  return { ok: true, count: items.length, items };
}

/** Merge exported items under `targetParentId` (null = inventory root). */
export function mergeImportedItems(
  existing: InventoryItem[],
  incoming: InventoryItem[],
  targetParentId: string | null,
): TransferResult & { items?: InventoryItem[] } {
  if (incoming.length === 0) {
    return { ok: false, error: "The file has nothing to import." };
  }

  const ordered = sortParentsFirst(incoming);
  const idMap = new Map<string, string>();
  const next = [...existing];
  let imported = 0;

  for (const item of ordered) {
    const newId = createId();
    idMap.set(item.id, newId);

    const mappedParent =
      item.parentId === null
        ? targetParentId
        : (idMap.get(item.parentId) ?? targetParentId);

    const name = resolveImportName(next, mappedParent, item.name);

    if (item.kind === "group") {
      next.push({
        id: newId,
        kind: "group",
        name,
        parentId: mappedParent,
        createdAt: Date.now(),
      });
    } else {
      next.push({
        ...item,
        id: newId,
        name,
        parentId: mappedParent,
        createdAt: Date.now(),
      });
    }
    imported += 1;
  }

  return { ok: true, count: imported, items: next };
}

export async function readExportFile(
  file: File,
): Promise<TransferResult & { items?: InventoryItem[] }> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "Could not read the selected file." };
  }

  try {
    return parseExportPayload(JSON.parse(text));
  } catch {
    return { ok: false, error: "Invalid JSON file." };
  }
}

/** Read + parse an export from a filesystem path (Tauri dialog / drag-drop). */
export async function readExportPath(
  path: string,
): Promise<TransferResult & { items?: InventoryItem[] }> {
  let text: string;
  try {
    text = await invoke<string>("read_text_file", { path });
  } catch (err) {
    const message =
      typeof err === "string" && err.trim()
        ? err
        : err instanceof Error
          ? err.message
          : "Could not read the selected file.";
    return { ok: false, error: message };
  }

  try {
    return parseExportPayload(JSON.parse(text));
  } catch {
    return { ok: false, error: "Invalid JSON file." };
  }
}

export function isJsonPath(path: string): boolean {
  return path.toLowerCase().endsWith(".json");
}

export function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}
