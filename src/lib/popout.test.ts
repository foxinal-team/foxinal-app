import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  buildPopoutUrl,
  clearPopoutTabData,
  closeDetachedWindow,
  focusDetachedWindow,
  loadPopoutTabData,
  openDetachedWindow,
  parsePopoutParams,
  POPOUT_STORAGE_PREFIX,
  savePopoutTabData,
} from "./popout";
import { createLocalTab } from "./sessions";

describe("Popout Window Utilities (Multi-Window Subsystem)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("buildPopoutUrl & parsePopoutParams", () => {
    it("builds popout URL for terminal session with query parameters", () => {
      const url = buildPopoutUrl("tab-123", "terminal");
      expect(url).toBe("index.html?popout=true&tabId=tab-123&kind=terminal");
    });

    it("builds popout URL for SFTP session", () => {
      const url = buildPopoutUrl("tab-456", "sftp");
      expect(url).toBe("index.html?popout=true&tabId=tab-456&kind=sftp");
    });

    it("parses popout query parameters accurately", () => {
      const parsed = parsePopoutParams("?popout=true&tabId=tab-789&kind=terminal");
      expect(parsed.isPopout).toBe(true);
      expect(parsed.tabId).toBe("tab-789");
      expect(parsed.kind).toBe("terminal");
    });

    it("handles missing leading question mark or missing parameters gracefully", () => {
      const parsed = parsePopoutParams("popout=true&tabId=tab-999&kind=sftp");
      expect(parsed.isPopout).toBe(true);
      expect(parsed.tabId).toBe("tab-999");
      expect(parsed.kind).toBe("sftp");

      const empty = parsePopoutParams("");
      expect(empty.isPopout).toBe(false);
      expect(empty.tabId).toBeNull();
      expect(empty.kind).toBe("terminal");
    });
  });

  describe("Storage Persistence (save, load, clear)", () => {
    it("saves and loads SessionTab cleanly from localStorage", () => {
      const tab = createLocalTab();
      savePopoutTabData(tab.id, tab);

      const loaded = loadPopoutTabData(tab.id);
      expect(loaded).not.toBeNull();
      if (!loaded) throw new Error("Expected tab to load");

      expect(loaded.id).toBe(tab.id);
      expect(loaded.title).toBe(tab.title);
      expect(loaded.layout.type).toBe("leaf");

      clearPopoutTabData(tab.id);
      expect(loadPopoutTabData(tab.id)).toBeNull();
    });

    it("returns null for corrupt or non-existent tab data", () => {
      expect(loadPopoutTabData("non-existent")).toBeNull();

      localStorage.setItem(`${POPOUT_STORAGE_PREFIX}bad-json`, "{ corrupted json");
      expect(loadPopoutTabData("bad-json")).toBeNull();

      localStorage.setItem(
        `${POPOUT_STORAGE_PREFIX}partial`,
        JSON.stringify({ someField: "missing id and layout" }),
      );
      expect(loadPopoutTabData("partial")).toBeNull();
    });
  });

  describe("Tauri IPC Window Management", () => {
    it("invokes open_detached_window with correct label, title, and URL", async () => {
      const tab = createLocalTab();
      tab.title = "Production DB";
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await openDetachedWindow(tab, "terminal");

      expect(invoke).toHaveBeenCalledWith("open_detached_window", {
        label: `popout-${tab.id}`,
        title: "Production DB — Foxinal",
        url: `index.html?popout=true&tabId=${tab.id}&kind=terminal`,
      });

      // INVARIANT: Tab data must be saved to storage before window opens
      const saved = loadPopoutTabData(tab.id);
      expect(saved?.id).toBe(tab.id);
    });

    it("invokes focus_window with target window label", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await focusDetachedWindow("tab-xyz");

      expect(invoke).toHaveBeenCalledWith("focus_window", {
        label: "popout-tab-xyz",
      });
    });

    it("invokes close_window with target window label", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await closeDetachedWindow("tab-xyz");

      expect(invoke).toHaveBeenCalledWith("close_window", {
        label: "popout-tab-xyz",
      });
    });
  });
});
