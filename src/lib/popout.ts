import { invoke } from "@tauri-apps/api/core";
import type { SessionTab } from "./sessions";

export const POPOUT_STORAGE_PREFIX = "foxinal-popout-tab-";
export const REATTACH_EVENT = "foxinal:reattach-session";

export type PopoutParams = {
  isPopout: boolean;
  tabId: string | null;
  kind: "terminal" | "sftp";
};

export type ReattachPayload = {
  tabId: string;
  tab?: SessionTab;
};

export function buildPopoutUrl(
  tabId: string,
  kind: "terminal" | "sftp" = "terminal",
): string {
  const params = new URLSearchParams({
    popout: "true",
    tabId,
    kind,
  });
  return `index.html?${params.toString()}`;
}

export function parsePopoutParams(search: string): PopoutParams {
  const query = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const isPopout = query.get("popout") === "true";
  const tabId = query.get("tabId") || null;
  const rawKind = query.get("kind");
  const kind = rawKind === "sftp" ? "sftp" : "terminal";

  return {
    isPopout,
    tabId,
    kind,
  };
}

export function savePopoutTabData(tabId: string, tab: SessionTab): void {
  try {
    localStorage.setItem(
      `${POPOUT_STORAGE_PREFIX}${tabId}`,
      JSON.stringify(tab),
    );
  } catch (err) {
    console.error("Failed to save popout tab data:", err);
  }
}

export function loadPopoutTabData(tabId: string): SessionTab | null {
  try {
    const raw = localStorage.getItem(`${POPOUT_STORAGE_PREFIX}${tabId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionTab;
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.layout) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPopoutTabData(tabId: string): void {
  try {
    localStorage.removeItem(`${POPOUT_STORAGE_PREFIX}${tabId}`);
  } catch {
    // Ignore cleanup errors
  }
}

export async function openDetachedWindow(
  tab: SessionTab,
  kind: "terminal" | "sftp" = "terminal",
): Promise<void> {
  savePopoutTabData(tab.id, tab);
  const label = `popout-${tab.id}`;
  const title = `${tab.title} — Foxinal`;
  const url = buildPopoutUrl(tab.id, kind);

  await invoke("open_detached_window", {
    label,
    title,
    url,
  });
}

export async function focusDetachedWindow(tabId: string): Promise<void> {
  const label = `popout-${tabId}`;
  await invoke("focus_window", { label });
}

export async function closeDetachedWindow(tabId: string): Promise<void> {
  const label = `popout-${tabId}`;
  await invoke("close_window", { label });
}
