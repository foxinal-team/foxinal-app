export type FsEntryKind = "file" | "dir" | "other";

export type FsEntry = {
  name: string;
  path: string;
  kind: FsEntryKind;
  size: number;
  modified: number | null;
  hidden: boolean;
  /** Preformatted for list rendering (optional). */
  sizeLabel?: string;
  modifiedLabel?: string;
};

export type TransferResult = {
  transferred: number;
  message: string;
};

export type TransferProgress = {
  transferId: string;
  name: string;
  transferred: number;
  total: number;
  done: boolean;
};

export const SFTP_TRANSFER_PROGRESS_EVENT = "sftp-transfer-progress";
export const TRANSFER_CANCELLED_MESSAGE = "Transfer cancelled.";

export type TransferRequest = {
  id: string;
  destSide: "left" | "right";
  sourceKind: "local" | "remote";
  sourceSessionId: string | null;
  /** Display name: "Local" or host label. */
  sourceLabel: string;
  destKind: "local" | "remote";
  destSessionId: string | null;
  /** Display name: "Local" or host label. */
  destLabel: string;
  sourcePath: string;
  sourceIsDir: boolean;
  destDir: string;
  entryName: string;
  entrySize: number;
};

export type TransferUiPhase = "running" | "cancelled" | "failed";

export type PaneKind = "local" | "remote";

export type PaneConnection =
  | { kind: "local" }
  | {
      kind: "remote";
      hostId: string;
      hostName: string;
      sessionId: string;
    };

export type DragPayload = {
  pane: "left" | "right";
  entry: FsEntry;
};

export type FileContentResult = {
  content: string;
  size: number;
  isBinary: boolean;
  lineEnding: "LF" | "CRLF" | string;
  truncated: boolean;
};

export type FilePermissionsInfo = {
  path: string;
  name: string;
  isDir: boolean;
  isSymlink: boolean;
  size: number;
  sizeLabel: string;
  modified: number | null;
  modifiedLabel: string;
  accessed: number | null;
  accessedLabel: string;
  mode: number;
  modeOctal: string;
  modeSymbolic: string;
  uid?: number;
  gid?: number;
  user?: string;
  group?: string;
  readOnly: boolean;
};

export type PermissionTriplet = {
  read: boolean;
  write: boolean;
  exec: boolean;
};

export type PermissionMatrix = {
  owner: PermissionTriplet;
  group: PermissionTriplet;
  others: PermissionTriplet;
};

export type ImageContentResult = {
  dataUrl: string;
  mimeType: string;
  size: number;
  sizeLabel: string;
  name: string;
};

export const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "bmp",
  "avif",
]);

export function isImageFileName(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = filename.slice(dot + 1).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}



