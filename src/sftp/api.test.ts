import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  canGoUp,
  cancelSftpTransfer,
  formatBytes,
  formatModified,
  fsCreateFile,
  fsHomeDir,
  fsListDir,
  fsMkdir,
  fsParentDir,
  fsReadImage,
  fsReadTextFile,
  fsRemove,
  fsRename,
  fsSetPermissions,
  fsWriteTextFile,
  invokeErrorMessage,
  isTransferCancelledMessage,
  joinLocal,
  joinRemote,
  matrixToMode,
  modeToOctal,
  modeToSymbolic,
  parentLocal,
  parentPath,
  parentRemote,
  parseOctalInput,
  pathCrumbs,
  sftpConnect,
  sftpCreateFile,
  sftpDisconnect,
  sftpHomeDir,
  sftpListDir,
  sftpMkdir,
  sftpReadImage,
  sftpReadTextFile,
  sftpRemove,
  sftpRename,
  sftpSetOwnership,
  sftpSetPermissions,
  sftpSudoExec,
  sftpWriteTextFile,
  transferEntries,
} from "./api";
import type { PermissionMatrix } from "./types";

describe("sftp api and path utilities", () => {
  describe("formatBytes", () => {
    it("formats bytes, KB, MB, and GB boundaries", () => {
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(2048)).toBe("2.0 KB");
      expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
      expect(formatBytes(1024 * 1024 * 1024 * 4)).toBe("4.00 GB");
    });
  });

  describe("formatModified", () => {
    it("handles null epoch", () => {
      expect(formatModified(null)).toBe("—");
    });

    it("formats valid timestamp", () => {
      expect(formatModified(1700000000)).not.toBe("—");
    });
  });

  describe("joinLocal & joinRemote", () => {
    it("joins remote paths with unix forward slash", () => {
      expect(joinRemote("/var", "log")).toBe("/var/log");
      expect(joinRemote("/", "etc")).toBe("/etc");
      expect(joinRemote("", "root")).toBe("/root");
    });

    it("joins local paths handling trailing slash", () => {
      expect(joinLocal("/tmp/", "file.txt")).toBe("/tmp/file.txt");
      expect(joinLocal("", "file.txt")).toBe("file.txt");
    });
  });

  describe("parentRemote & parentLocal", () => {
    it("computes remote parent directory", () => {
      expect(parentRemote("/var/log/nginx")).toBe("/var/log");
      expect(parentRemote("/var")).toBe("/");
      expect(parentRemote("/")).toBe("/");
      expect(parentPath("/var/log", "remote")).toBe("/var");
      expect(parentPath("/test/dir", "local")).toBe("/test");
    });

    it("computes local parent directory", () => {
      expect(parentLocal("/home/user/test")).toBe("/home/user");
      expect(parentLocal("/")).toBe("/");
    });

    it("checks canGoUp accurately", () => {
      expect(canGoUp("/var/log", "remote")).toBe(true);
      expect(canGoUp("/", "remote")).toBe(false);
      expect(canGoUp("", "remote")).toBe(false);
    });
  });

  describe("pathCrumbs", () => {
    it("returns empty crumbs for empty path", () => {
      expect(pathCrumbs("", "remote")).toEqual([]);
    });

    it("splits root path", () => {
      expect(pathCrumbs("/", "remote")).toEqual([{ label: "/", path: "/" }]);
    });

    it("splits deep unix path into clickable segments", () => {
      const crumbs = pathCrumbs("/var/log/nginx", "remote");
      expect(crumbs.length).toBe(4);
      expect(crumbs[0]).toEqual({ label: "/", path: "/" });
      expect(crumbs[1]).toEqual({ label: "var", path: "/var" });
      expect(crumbs[2]).toEqual({ label: "log", path: "/var/log" });
      expect(crumbs[3]).toEqual({ label: "nginx", path: "/var/log/nginx" });
    });

    it("splits windows local paths", () => {
      const crumbs = pathCrumbs("C:\\Users\\User\\Documents", "local");
      expect(crumbs[0].label).toBe("C:\\");
      expect(crumbs.length).toBe(4);
    });
  });

  describe("permissions formatting & octal conversion", () => {
    it("converts mode to octal string", () => {
      expect(modeToOctal(0o755)).toBe("0755");
      expect(modeToOctal(0o644)).toBe("0644");
    });

    it("parses octal input with validation", () => {
      expect(parseOctalInput("755", 0)).toBe(0o755);
      expect(parseOctalInput("0644", 0)).toBe(0o644);
      expect(parseOctalInput("999", 0)).toBeNull();
      expect(parseOctalInput("abc", 0)).toBeNull();
    });

    it("converts mode to symbolic string", () => {
      expect(modeToSymbolic(0o755, true, false)).toBe("drwxr-xr-x");
      expect(modeToSymbolic(0o644, false, false)).toBe("-rw-r--r--");
      expect(modeToSymbolic(0o777, false, true)).toBe("lrwxrwxrwx");
    });

    it("converts permission matrix to numeric mode", () => {
      const matrix: PermissionMatrix = {
        owner: { read: true, write: true, exec: true },
        group: { read: true, write: false, exec: true },
        others: { read: true, write: false, exec: true },
      };
      expect(matrixToMode(matrix)).toBe(0o755);
    });
  });

  describe("error and cancellation messages", () => {
    it("extracts error message from various error shapes", () => {
      expect(invokeErrorMessage("string err", "fallback")).toBe("string err");
      expect(invokeErrorMessage(new Error("custom err"), "fallback")).toBe("custom err");
      expect(invokeErrorMessage({ message: "obj err" }, "fallback")).toBe("obj err");
      expect(invokeErrorMessage(null, "fallback")).toBe("fallback");
    });

    it("identifies transfer cancellation messages", () => {
      expect(isTransferCancelledMessage("Transfer cancelled.")).toBe(true);
      expect(isTransferCancelledMessage("Failed: Transfer cancelled.")).toBe(true);
      expect(isTransferCancelledMessage("Connection reset")).toBe(false);
    });
  });

  describe("Tauri invoke client wrappers", () => {
    it("wraps local fs operations calling invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("/home/user");
      expect(await fsHomeDir()).toBe("/home/user");

      vi.mocked(invoke).mockResolvedValueOnce([]);
      expect(await fsListDir("/test")).toEqual([]);

      vi.mocked(invoke).mockResolvedValueOnce("/parent");
      expect(await fsParentDir("/test/child")).toBe("/parent");

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await fsMkdir("/test/new-folder");
      expect(invoke).toHaveBeenCalledWith("fs_mkdir", { path: "/test/new-folder" });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await fsCreateFile("/test/new-file.txt");
      expect(invoke).toHaveBeenCalledWith("fs_create_file", { path: "/test/new-file.txt" });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await fsRemove("/test/file.txt");
      expect(invoke).toHaveBeenCalledWith("fs_remove", { path: "/test/file.txt" });
    });

    it("wraps sftp connection and transfer operations", async () => {
      vi.mocked(invoke).mockResolvedValueOnce({
        sessionId: "s1",
        home: "/root",
      });
      const res = await sftpConnect({
        id: "h1",
        kind: "host",
        name: "test",
        address: "1.2.3.4",
        port: 22,
        username: "root",
        authMethod: "password",
        password: "pw",
        privateKey: "",
        parentId: null,
        createdAt: 1000,
      });
      expect(res.sessionId).toBe("s1");

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await sftpDisconnect("s1");
      expect(invoke).toHaveBeenCalledWith("sftp_disconnect", { sessionId: "s1" });

      vi.mocked(invoke).mockResolvedValueOnce("/root");
      expect(await sftpHomeDir("s1")).toBe("/root");

      vi.mocked(invoke).mockResolvedValueOnce([]);
      expect(await sftpListDir("s1", "/var")).toEqual([]);

      vi.mocked(invoke).mockResolvedValueOnce({ transferred: 100, message: "OK" });
      const transferRes = await transferEntries({
        transferId: "t1",
        sourceKind: "local",
        destKind: "remote",
        destSessionId: "s1",
        sourcePath: "/tmp/file",
        sourceIsDir: false,
        destDir: "/root",
        entryName: "file",
      });
      expect(transferRes.transferred).toBe(100);

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await cancelSftpTransfer("t1");
      expect(invoke).toHaveBeenCalledWith("cancel_sftp_transfer", { transferId: "t1" });

      // Remote operations
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await sftpRemove("s1", "/tmp/file", false);
      expect(invoke).toHaveBeenCalledWith("sftp_remove", { sessionId: "s1", path: "/tmp/file", isDir: false });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await sftpMkdir("s1", "/tmp/dir");
      expect(invoke).toHaveBeenCalledWith("sftp_mkdir", { sessionId: "s1", path: "/tmp/dir" });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await sftpCreateFile("s1", "/tmp/new.txt");
      expect(invoke).toHaveBeenCalledWith("sftp_create_file", { sessionId: "s1", path: "/tmp/new.txt" });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await sftpRename("s1", "/tmp/old.txt", "/tmp/new.txt");
      expect(invoke).toHaveBeenCalledWith("sftp_rename", { sessionId: "s1", from: "/tmp/old.txt", to: "/tmp/new.txt" });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await sftpSetPermissions("s1", "/tmp/file", 0o755);
      expect(invoke).toHaveBeenCalledWith("sftp_set_permissions", { sessionId: "s1", path: "/tmp/file", mode: 0o755, recursive: false });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await sftpSetOwnership("s1", "/tmp/file", "user", "group");
      expect(invoke).toHaveBeenCalledWith("sftp_set_ownership", { sessionId: "s1", path: "/tmp/file", user: "user", group: "group", recursive: false });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await sftpSudoExec("s1", "chown", "pw");
      expect(invoke).toHaveBeenCalledWith("sftp_sudo_exec", { sessionId: "s1", command: "chown", password: "pw" });

      vi.mocked(invoke).mockResolvedValueOnce({ content: "hello", size: 5, isBinary: false, lineEnding: "LF", truncated: false });
      const readRes = await sftpReadTextFile("s1", "/tmp/file.txt", undefined);
      expect(readRes).toHaveProperty("content", "hello");

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await sftpWriteTextFile("s1", "/tmp/file.txt", "new-content");
      expect(invoke).toHaveBeenCalledWith("sftp_write_text_file", { sessionId: "s1", path: "/tmp/file.txt", contents: "new-content" });

      vi.mocked(invoke).mockResolvedValueOnce({ dataUrl: "data:image/png;base64,", mimeType: "image/png", size: 10, sizeLabel: "10 B", name: "img.png" });
      const imgRes = await sftpReadImage("s1", "/tmp/img.png");
      expect(imgRes.mimeType).toBe("image/png");

      vi.mocked(invoke).mockResolvedValueOnce({ dataUrl: "data:image/png;base64,", mimeType: "image/png", size: 10, sizeLabel: "10 B", name: "img.png" });
      const fsImgRes = await fsReadImage("/tmp/img.png");
      expect(fsImgRes.mimeType).toBe("image/png");

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await fsRename("/tmp/a", "/tmp/b");
      expect(invoke).toHaveBeenCalledWith("fs_rename", { from: "/tmp/a", to: "/tmp/b" });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await fsSetPermissions("/tmp/a", 0o644);
      expect(invoke).toHaveBeenCalledWith("fs_set_permissions", { path: "/tmp/a", mode: 0o644, recursive: false });

      vi.mocked(invoke).mockResolvedValueOnce({ content: "local", size: 5, isBinary: false, lineEnding: "LF", truncated: false });
      const fsTextRes = await fsReadTextFile("/tmp/a.txt", undefined);
      expect(fsTextRes.content).toBe("local");

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await fsWriteTextFile("/tmp/a.txt", "data");
      expect(invoke).toHaveBeenCalledWith("fs_write_text_file", { path: "/tmp/a.txt", contents: "data" });
    });
  });
});
