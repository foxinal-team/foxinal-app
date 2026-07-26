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
