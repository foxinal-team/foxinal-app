import { invoke } from "@tauri-apps/api/core";
import type { HostItem } from "@/inventory/types";
import type {
  FileContentResult,
  FilePermissionsInfo,
  FsEntry,
  ImageContentResult,
  PermissionMatrix,
  TransferResult,
} from "./types";
import { TRANSFER_CANCELLED_MESSAGE } from "./types";

function asEntries(raw: FsEntry[]): FsEntry[] {
  return raw.map((entry) => {
    const kind: FsEntry["kind"] =
      entry.kind === "dir" || entry.kind === "file" || entry.kind === "other"
        ? entry.kind
        : "other";
    return {
      name: entry.name,
      path: entry.path,
      kind,
      size: entry.size,
      modified: entry.modified,
      hidden: entry.hidden,
      sizeLabel:
        entry.sizeLabel ?? (kind === "dir" ? "—" : formatBytes(entry.size)),
      modifiedLabel:
        entry.modifiedLabel ?? formatModified(entry.modified),
    };
  });
}

export type SftpConnectResult = {
  sessionId: string;
  home: string;
};

export async function fsHomeDir(): Promise<string> {
  return invoke<string>("fs_home_dir");
}

export async function fsListDir(path: string): Promise<FsEntry[]> {
  return asEntries(await invoke<FsEntry[]>("fs_list_dir", { path }));
}

export async function fsParentDir(path: string): Promise<string> {
  return invoke<string>("fs_parent_dir", { path });
}

export async function fsMkdir(path: string): Promise<void> {
  await invoke("fs_mkdir", { path });
}

export async function fsCreateFile(path: string): Promise<void> {
  await invoke("fs_create_file", { path });
}

export async function fsRemove(path: string): Promise<void> {
  await invoke("fs_remove", { path });
}

export async function fsRename(from: string, to: string): Promise<void> {
  await invoke("fs_rename", { from, to });
}

export async function fsReadTextFile(
  path: string,
  maxBytes?: number,
): Promise<FileContentResult> {
  return invoke<FileContentResult>("fs_read_text_file", { path, maxBytes });
}

export async function fsReadImage(
  path: string,
  maxBytes?: number,
): Promise<ImageContentResult> {
  return invoke<ImageContentResult>("fs_read_image", { path, maxBytes });
}

export async function fsWriteTextFile(
  path: string,
  contents: string,
): Promise<void> {
  await invoke("fs_write_text_file", { path, contents });
}

export async function sftpConnect(host: HostItem): Promise<SftpConnectResult> {
  return invoke<SftpConnectResult>("sftp_connect", {
    address: host.address,
    port: host.port,
    username: host.username,
    authMethod: host.authMethod,
    password: host.password,
    privateKey: host.privateKey,
  });
}

export async function sftpDisconnect(sessionId: string): Promise<void> {
  await invoke("sftp_disconnect", { sessionId });
}

export async function sftpHomeDir(sessionId: string): Promise<string> {
  return invoke<string>("sftp_home_dir", { sessionId });
}

export async function sftpListDir(
  sessionId: string,
  path: string,
): Promise<FsEntry[]> {
  return asEntries(
    await invoke<FsEntry[]>("sftp_list_dir", { sessionId, path }),
  );
}

export async function sftpParentDir(path: string): Promise<string> {
  return invoke<string>("sftp_parent_dir", { path });
}

export async function sftpMkdir(
  sessionId: string,
  path: string,
): Promise<void> {
  await invoke("sftp_mkdir", { sessionId, path });
}

export async function sftpCreateFile(
  sessionId: string,
  path: string,
): Promise<void> {
  await invoke("sftp_create_file", { sessionId, path });
}

export async function sftpRemove(
  sessionId: string,
  path: string,
  isDir: boolean,
): Promise<void> {
  await invoke("sftp_remove", { sessionId, path, isDir });
}

export async function sftpRename(
  sessionId: string,
  from: string,
  to: string,
): Promise<void> {
  await invoke("sftp_rename", { sessionId, from, to });
}

export async function sftpReadTextFile(
  sessionId: string,
  path: string,
  maxBytes?: number,
): Promise<FileContentResult> {
  return invoke<FileContentResult>("sftp_read_text_file", {
    sessionId,
    path,
    maxBytes,
  });
}

export async function sftpReadImage(
  sessionId: string,
  path: string,
  maxBytes?: number,
): Promise<ImageContentResult> {
  return invoke<ImageContentResult>("sftp_read_image", {
    sessionId,
    path,
    maxBytes,
  });
}

export async function sftpWriteTextFile(
  sessionId: string,
  path: string,
  contents: string,
): Promise<void> {
  await invoke("sftp_write_text_file", { sessionId, path, contents });
}

export async function fsGetProperties(
  path: string,
): Promise<FilePermissionsInfo> {
  return invoke<FilePermissionsInfo>("fs_get_properties", { path });
}

export async function fsSetPermissions(
  path: string,
  mode: number,
  recursive: boolean = false,
): Promise<void> {
  await invoke("fs_set_permissions", { path, mode, recursive });
}

export async function sftpGetProperties(
  sessionId: string,
  path: string,
): Promise<FilePermissionsInfo> {
  return invoke<FilePermissionsInfo>("sftp_get_properties", { sessionId, path });
}

export async function sftpSetPermissions(
  sessionId: string,
  path: string,
  mode: number,
  recursive: boolean = false,
): Promise<void> {
  await invoke("sftp_set_permissions", {
    sessionId,
    path,
    mode,
    recursive,
  });
}

export async function sftpSetOwnership(
  sessionId: string,
  path: string,
  user?: string,
  group?: string,
  recursive: boolean = false,
): Promise<void> {
  await invoke("sftp_set_ownership", {
    sessionId,
    path,
    user: user || null,
    group: group || null,
    recursive,
  });
}

export async function sftpSudoExec(
  sessionId: string,
  command: string,
  password?: string,
): Promise<void> {
  await invoke("sftp_sudo_exec", {
    sessionId,
    command,
    password: password || null,
  });
}

export function modeToMatrix(mode: number): PermissionMatrix {
  return {
    owner: {
      read: Boolean(mode & 0o400),
      write: Boolean(mode & 0o200),
      exec: Boolean(mode & 0o100),
    },
    group: {
      read: Boolean(mode & 0o040),
      write: Boolean(mode & 0o020),
      exec: Boolean(mode & 0o010),
    },
    others: {
      read: Boolean(mode & 0o004),
      write: Boolean(mode & 0o002),
      exec: Boolean(mode & 0o001),
    },
  };
}

export function matrixToMode(matrix: PermissionMatrix, specialBits: number = 0): number {
  let mode = specialBits & 0o7000;
  if (matrix.owner.read) mode |= 0o400;
  if (matrix.owner.write) mode |= 0o200;
  if (matrix.owner.exec) mode |= 0o100;
  if (matrix.group.read) mode |= 0o040;
  if (matrix.group.write) mode |= 0o020;
  if (matrix.group.exec) mode |= 0o010;
  if (matrix.others.read) mode |= 0o004;
  if (matrix.others.write) mode |= 0o002;
  if (matrix.others.exec) mode |= 0o001;
  return mode;
}

export function modeToOctal(mode: number): string {
  const clean = mode & 0o7777;
  return clean.toString(8).padStart(4, "0");
}

export function parseOctalInput(input: string, currentMode: number): number | null {
  const trimmed = input.trim();
  if (!/^[0-7]{3,4}$/.test(trimmed)) return null;
  const parsed = parseInt(trimmed, 8);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 0o7777) return null;
  // If user entered 3 digits (e.g. "755"), preserve any existing special bits if present
  if (trimmed.length === 3) {
    const special = currentMode & 0o7000;
    return special | (parsed & 0o777);
  }
  return parsed;
}

export function modeToSymbolic(mode: number, isDir?: boolean, isSymlink?: boolean): string {
  const typeChar = isSymlink ? "l" : isDir ? "d" : "-";
  const rwx: [number, string][] = [
    [0o400, "r"],
    [0o200, "w"],
    [0o100, "x"],
    [0o040, "r"],
    [0o020, "w"],
    [0o010, "x"],
    [0o004, "r"],
    [0o002, "w"],
    [0o001, "x"],
  ];
  let res = typeChar;
  for (const [bit, ch] of rwx) {
    res += (mode & bit) !== 0 ? ch : "-";
  }
  return res;
}


export async function transferEntries(input: {
  transferId: string;
  sourceKind: "local" | "remote";
  sourceSessionId?: string | null;
  destKind: "local" | "remote";
  destSessionId?: string | null;
  sourcePath: string;
  sourceIsDir: boolean;
  destDir: string;
  entryName: string;
  entrySize?: number | null;
}): Promise<TransferResult> {
  return invoke<TransferResult>("transfer_entries", {
    transferId: input.transferId,
    sourceKind: input.sourceKind,
    sourceSessionId: input.sourceSessionId ?? null,
    destKind: input.destKind,
    destSessionId: input.destSessionId ?? null,
    sourcePath: input.sourcePath,
    sourceIsDir: input.sourceIsDir,
    destDir: input.destDir,
    entryName: input.entryName,
    entrySize: input.entrySize ?? null,
  });
}

export async function cancelSftpTransfer(transferId: string): Promise<void> {
  await invoke("cancel_sftp_transfer", { transferId });
}

export function invokeErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string" && err.trim()) return err;
  if (err instanceof Error && err.message.trim()) return err.message;
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
  }
  return fallback;
}

export function isTransferCancelledMessage(message: string): boolean {
  return (
    message === TRANSFER_CANCELLED_MESSAGE ||
    message.includes(TRANSFER_CANCELLED_MESSAGE)
  );
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatModified(epochSecs: number | null): string {
  if (!epochSecs) return "—";
  try {
    return new Date(epochSecs * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function joinLocal(parent: string, name: string): string {
  if (!parent) return name;
  const sep = parent.includes("\\") ? "\\" : "/";
  return `${parent.replace(/[\\/]+$/, "")}${sep}${name}`;
}

export function joinRemote(parent: string, name: string): string {
  if (!parent || parent === "/") return `/${name}`;
  return `${parent.replace(/\/+$/, "")}/${name}`;
}

/** Parent of a remote absolute path (`/` stays `/`). */
export function parentRemote(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  if (!trimmed || trimmed === "/") return "/";
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  return trimmed.slice(0, idx) || "/";
}

/** Parent of a local absolute path (root stays itself). */
export function parentLocal(path: string): string {
  if (!path) return path;
  if (/^[A-Za-z]:[\\/]?$/.test(path)) {
    return path.endsWith("\\") || path.endsWith("/")
      ? path
      : `${path}\\`;
  }
  if (path === "/") return "/";
  const normalized = path.replace(/[\\/]+$/, "");
  const sep = path.includes("\\") ? "\\" : "/";
  const idx = Math.max(
    normalized.lastIndexOf("/"),
    normalized.lastIndexOf("\\"),
  );
  if (idx <= 0) {
    if (/^[A-Za-z]:/.test(normalized)) return `${normalized.slice(0, 2)}${sep}`;
    return "/";
  }
  const parent = normalized.slice(0, idx);
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}${sep}`;
  return parent || (sep === "\\" ? normalized.slice(0, 3) : "/");
}

export function parentPath(
  path: string,
  kind: "local" | "remote",
): string {
  return kind === "local" ? parentLocal(path) : parentRemote(path);
}

export function canGoUp(path: string, kind: "local" | "remote"): boolean {
  if (!path) return false;
  return parentPath(path, kind) !== path;
}

export type PathCrumb = {
  label: string;
  path: string;
};

/** Split a local or remote absolute path into clickable breadcrumb segments. */
export function pathCrumbs(
  path: string,
  kind: "local" | "remote",
): PathCrumb[] {
  if (!path) return [];

  const isWindows =
    kind === "local" && /^[A-Za-z]:[\\/]/.test(path);

  if (isWindows) {
    const drive = path.slice(0, 2);
    const root = `${drive}\\`;
    const rest = path.slice(2).replace(/^[\\/]+/, "");
    const crumbs: PathCrumb[] = [{ label: root, path: root }];
    if (!rest) return crumbs;
    let acc = drive;
    for (const part of rest.split(/[\\/]+/).filter(Boolean)) {
      acc += `\\${part}`;
      crumbs.push({ label: part, path: acc });
    }
    return crumbs;
  }

  if (path === "/") return [{ label: "/", path: "/" }];

  const normalized = path.replace(/\/+$/, "") || "/";
  if (normalized === "/") return [{ label: "/", path: "/" }];

  const parts = normalized.split("/").filter(Boolean);
  const crumbs: PathCrumb[] = [{ label: "/", path: "/" }];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}
