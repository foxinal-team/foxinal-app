import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  checkForUpdates,
  clearSkippedVersion,
  compareSemver,
  fetchLatestRelease,
  getSkippedVersion,
  isNewerVersion,
  normalizeVersion,
  openReleasePage,
  shouldCheckForUpdates,
  skipVersion,
} from "./updates";

describe("updates module", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("normalizeVersion & compareSemver", () => {
    it("strips leading v and whitespace", () => {
      expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
      expect(normalizeVersion("  V2.0.0  ")).toBe("2.0.0");
      expect(normalizeVersion("1.0.0")).toBe("1.0.0");
    });

    it("compares semver versions correctly", () => {
      expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
      expect(compareSemver("1.3.0", "1.2.9")).toBe(1);
      expect(compareSemver("1.2.0", "1.2.1")).toBe(-1);
      expect(compareSemver("2.0.0", "1.99.99")).toBe(1);
      expect(compareSemver("1.0.0.0", "1.0.0")).toBe(0);
    });

    it("evaluates isNewerVersion", () => {
      expect(isNewerVersion("1.4.0", "1.3.0")).toBe(true);
      expect(isNewerVersion("1.3.0", "1.3.0")).toBe(false);
      expect(isNewerVersion("1.2.9", "1.3.0")).toBe(false);
    });
  });

  describe("skip version helpers", () => {
    it("manages skipped versions in localStorage", () => {
      expect(getSkippedVersion()).toBeNull();
      skipVersion("v1.5.0");
      expect(getSkippedVersion()).toBe("1.5.0");
      clearSkippedVersion();
      expect(getSkippedVersion()).toBeNull();
    });
  });

  describe("throttling check", () => {
    it("permits check when no previous check exists", () => {
      expect(shouldCheckForUpdates()).toBe(true);
    });

    it("throttles when checked recently", () => {
      const now = Date.now();
      localStorage.setItem("foxinal-update-last-check", new Date(now - 1000).toISOString());
      expect(shouldCheckForUpdates(now)).toBe(false);
    });

    it("allows check after 24 hours have elapsed", () => {
      const now = Date.now();
      const past = now - (25 * 60 * 60 * 1000);
      localStorage.setItem("foxinal-update-last-check", new Date(past).toISOString());
      expect(shouldCheckForUpdates(now)).toBe(true);
    });
  });

  describe("fetchLatestRelease", () => {
    it("parses valid release response", async () => {
      const mockData = {
        tag_name: "v1.4.0",
        name: "Foxinal 1.4.0 Release",
        html_url: "https://github.com/foxinal-team/foxinal-app/releases/tag/v1.4.0",
        draft: false,
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const release = await fetchLatestRelease();
      expect(release.version).toBe("1.4.0");
      expect(release.tagName).toBe("v1.4.0");
      expect(release.name).toBe("Foxinal 1.4.0 Release");
    });

    it("throws error for 404 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(fetchLatestRelease()).rejects.toThrow("No published releases found yet.");
    });

    it("throws error when draft", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tag_name: "v1.4.0", draft: true }),
      } as Response);

      await expect(fetchLatestRelease()).rejects.toThrow("Latest release is still a draft.");
    });

    it("throws error when missing tag_name", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ draft: false }),
      } as Response);

      await expect(fetchLatestRelease()).rejects.toThrow("Release response was missing a version tag.");
    });
  });

  describe("checkForUpdates", () => {
    it("returns throttled when not forced and throttled", async () => {
      const now = Date.now();
      localStorage.setItem("foxinal-update-last-check", new Date(now).toISOString());

      const res = await checkForUpdates({ force: false });
      expect(res.status).toBe("throttled");
    });

    it("detects up-to-date status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tag_name: "v1.3.0", draft: false }),
      } as Response);

      const res = await checkForUpdates({ force: true, currentVersion: "1.3.0" });
      expect(res.status).toBe("up-to-date");
    });

    it("detects available update and records skipped status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ tag_name: "v1.4.0", draft: false }),
      } as Response);

      skipVersion("1.4.0");

      const res = await checkForUpdates({ force: true, currentVersion: "1.3.0" });
      expect(res.status).toBe("available");
      if (res.status === "available") {
        expect(res.latest.version).toBe("1.4.0");
        expect(res.skipped).toBe(true);
      }
    });

    it("returns error status on fetch failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network offline"));

      const res = await checkForUpdates({ force: true });
      expect(res.status).toBe("error");
      if (res.status === "error") {
        expect(res.error).toBe("Network offline");
      }
    });
  });

  describe("openReleasePage", () => {
    it("calls tauri openUrl with provided url", async () => {
      await openReleasePage("https://github.com/foxinal-team/foxinal-app/releases/tag/v1.4.0");
      expect(openUrl).toHaveBeenCalledWith(
        "https://github.com/foxinal-team/foxinal-app/releases/tag/v1.4.0",
      );
    });
  });
});
