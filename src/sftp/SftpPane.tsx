import {
  IconChevronRight,
  IconDeviceDesktop,
  IconFolder,
  IconFolderPlus,
  IconFilePlus,
  IconRefresh,
  IconServer,
  IconTrash,
  IconEye,
  IconEyeOff,
  IconFile,
  IconHome,
  IconArrowUp,
  IconX,
  IconGripVertical,
  IconCheck,
  IconPencil,
  IconFolderOpen,
  IconCode,
} from "@tabler/icons-react";
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { ConnectionOverlay } from "@/components/ConnectionOverlay";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDeleteDialog } from "@/inventory/ConfirmDeleteDialog";
import { NameDialog } from "@/inventory/NameDialog";
import type { HostItem, InventoryItem } from "@/inventory/types";
import { hostSummary } from "@/inventory/types";
import { cn } from "@/lib/utils";
import {
  formatBytes,
  formatModified,
  fsCreateFile,
  fsHomeDir,
  fsListDir,
  fsMkdir,
  fsRemove,
  fsRename,
  invokeErrorMessage,
  joinLocal,
  joinRemote,
  canGoUp,
  parentPath,
  pathCrumbs,
  sftpCreateFile,
  sftpHomeDir,
  sftpListDir,
  sftpMkdir,
  sftpRemove,
  sftpRename,
} from "./api";
import { SftpHostPicker } from "./SftpHostPicker";
import type { FsEntry, PaneConnection } from "./types";

export type SftpPaneSide = "left" | "right";

export type PaneConnectStatus =
  | null
  | {
      phase: "connecting" | "listing";
      host: HostItem;
    };

type SftpPaneProps = {
  side: SftpPaneSide;
  items: InventoryItem[];
  connection: PaneConnection;
  path: string;
  onPathChange: (path: string) => void;
  onConnectionChange: (next: PaneConnection) => void;
  onConnectHost: (host: HostItem) => Promise<void>;
  connectStatus: PaneConnectStatus;
  onConnectReady: () => void;
  showHidden: boolean;
  onToggleHidden: () => void;
  refreshKey: number;
  dropActive: boolean;
  draggingPaths: string[] | null;
  onDragGrip: (entries: FsEntry[], event: ReactPointerEvent) => void;
  onStatus: (message: string | null, error?: string | null) => void;
  onBlockingDialogChange?: (open: boolean) => void;
  onOpenFile?: (entry: FsEntry, connection: PaneConnection) => void;
};

const iconSm = { size: 16, stroke: 1.75 } as const;

export function SftpPane({
  side,
  items,
  connection,
  path,
  onPathChange,
  onConnectionChange,
  onConnectHost,
  connectStatus,
  onConnectReady,
  showHidden,
  onToggleHidden,
  refreshKey,
  dropActive,
  draggingPaths,
  onDragGrip,
  onStatus,
  onBlockingDialogChange,
  onOpenFile,
}: SftpPaneProps) {
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<FsEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FsEntry | null>(null);
  const [contextTarget, setContextTarget] = useState<FsEntry | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const listGenRef = useRef(0);
  const connectReadyRef = useRef(onConnectReady);
  connectReadyRef.current = onConnectReady;

  useEffect(() => {
    const open =
      deleteTarget !== null ||
      mkdirOpen ||
      createFileOpen ||
      renameTarget !== null;
    onBlockingDialogChange?.(open);
    return () => onBlockingDialogChange?.(false);
  }, [
    deleteTarget,
    mkdirOpen,
    createFileOpen,
    renameTarget,
    onBlockingDialogChange,
  ]);

  // Clear stale files as soon as a host connect starts.
  useEffect(() => {
    if (connectStatus?.phase === "connecting") {
      listGenRef.current += 1;
      setEntries([]);
      setSelected([]);
      setLoading(true);
    }
  }, [connectStatus]);

  const visible = useMemo(
    () => (showHidden ? entries : entries.filter((e) => !e.hidden)),
    [entries, showHidden],
  );

  async function loadPath(nextPath: string, opts?: { soft?: boolean }) {
    const gen = ++listGenRef.current;
    const soft = opts?.soft === true;
    setSelected([]);
    onPathChange(nextPath);
    if (!soft) setLoading(true);
    try {
      const list =
        connection.kind === "local"
          ? await fsListDir(nextPath)
          : await sftpListDir(connection.sessionId, nextPath);
      if (gen !== listGenRef.current) return;
      setEntries(list);
    } catch (err) {
      if (gen !== listGenRef.current) return;
      onStatus(
        null,
        invokeErrorMessage(err, "Failed to list directory."),
      );
    } finally {
      if (gen === listGenRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const gen = ++listGenRef.current;
    let cancelled = false;
    // Soft when we already know the path (refresh / post-connect home).
    const soft = Boolean(path);
    async function boot() {
      if (!soft) setLoading(true);
      setSelected([]);
      try {
        let next = path;
        if (!next) {
          next =
            connection.kind === "local"
              ? await fsHomeDir()
              : await sftpHomeDir(connection.sessionId);
        }
        if (cancelled || gen !== listGenRef.current) return;
        if (next !== path) onPathChange(next);
        const list =
          connection.kind === "local"
            ? await fsListDir(next)
            : await sftpListDir(connection.sessionId, next);
        if (cancelled || gen !== listGenRef.current) return;
        setEntries(list);
        connectReadyRef.current();
      } catch (err) {
        if (!cancelled && gen === listGenRef.current) {
          onStatus(
            null,
            invokeErrorMessage(err, "Failed to open location."),
          );
          connectReadyRef.current();
        }
      } finally {
        if (!cancelled && gen === listGenRef.current) setLoading(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connection.kind,
    connection.kind === "remote" ? connection.sessionId : "local",
    refreshKey,
  ]);

  async function goUp() {
    if (!canGoUp(path, connection.kind)) return;
    await loadPath(parentPath(path, connection.kind));
  }

  async function openEntry(entry: FsEntry) {
    if (entry.kind !== "dir") {
      setSelected([entry.path]);
      onOpenFile?.(entry, connection);
      return;
    }
    await loadPath(entry.path);
  }

  async function createFolder(rawName: string) {
    const name = rawName.trim();
    if (!name) return { ok: false as const, error: "Enter a folder name." };
    if (/[\\/]/.test(name) || name === "." || name === "..") {
      return {
        ok: false as const,
        error: "Folder name can’t include path separators.",
      };
    }
    if (entries.some((e) => e.name === name)) {
      return {
        ok: false as const,
        error: `“${name}” already exists here.`,
      };
    }

    const next =
      connection.kind === "local"
        ? joinLocal(path, name)
        : joinRemote(path, name);

    const optimistic: FsEntry = {
      name,
      path: next,
      kind: "dir",
      size: 0,
      modified: null,
      hidden: name.startsWith("."),
      sizeLabel: "—",
      modifiedLabel: "—",
    };

    try {
      if (connection.kind === "local") await fsMkdir(next);
      else await sftpMkdir(connection.sessionId, next);
      insertOptimistic(optimistic);
      onStatus(`Created “${name}”.`);
      void loadPath(path, { soft: true });
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: invokeErrorMessage(err, "Create failed."),
      };
    }
  }

  async function createFile(rawName: string) {
    const name = rawName.trim();
    if (!name) return { ok: false as const, error: "Enter a file name." };
    if (/[\\/]/.test(name) || name === "." || name === "..") {
      return {
        ok: false as const,
        error: "File name can’t include path separators.",
      };
    }
    if (entries.some((e) => e.name === name)) {
      return {
        ok: false as const,
        error: `“${name}” already exists here.`,
      };
    }

    const next =
      connection.kind === "local"
        ? joinLocal(path, name)
        : joinRemote(path, name);

    const optimistic: FsEntry = {
      name,
      path: next,
      kind: "file",
      size: 0,
      modified: null,
      hidden: name.startsWith("."),
      sizeLabel: formatBytes(0),
      modifiedLabel: "—",
    };

    try {
      if (connection.kind === "local") await fsCreateFile(next);
      else await sftpCreateFile(connection.sessionId, next);
      insertOptimistic(optimistic);
      onStatus(`Created “${name}”.`);
      void loadPath(path, { soft: true });
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: invokeErrorMessage(err, "Create failed."),
      };
    }
  }

  function insertOptimistic(entry: FsEntry) {
    setEntries((prev) => {
      if (prev.some((e) => e.path === entry.path)) return prev;
      const merged = [...prev, entry];
      merged.sort((a, b) => {
        if (a.kind === "dir" && b.kind !== "dir") return -1;
        if (a.kind !== "dir" && b.kind === "dir") return 1;
        return a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
      });
      return merged;
    });
  }

  function requestDeleteSelected() {
    if (selected.length !== 1) return;
    const entry = entries.find((e) => e.path === selected[0]);
    if (!entry) return;
    setDeleteTarget(entry);
  }

  function requestRenameSelected() {
    if (selected.length !== 1) return;
    const entry = entries.find((e) => e.path === selected[0]);
    if (!entry) return;
    setRenameTarget(entry);
  }

  function onListContextMenu(e: ReactMouseEvent) {
    if (showOverlay || !path) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const target = e.target as HTMLElement | null;
    const parentRow = target?.closest<HTMLElement>("[data-sftp-parent]");
    if (parentRow) {
      flushSync(() => {
        setContextTarget(null);
        setSelected([".."]);
      });
      return;
    }
    const row = target?.closest<HTMLElement>("[data-sftp-entry]");
    // Sync so the menu content matches this right-click immediately.
    flushSync(() => {
      if (row) {
        const entryPath = row.dataset.sftpEntry;
        const entry = entries.find((item) => item.path === entryPath) ?? null;
        setContextTarget(entry);
        if (entry && !selected.includes(entry.path)) {
          setSelected([entry.path]);
        }
        return;
      }
      setContextTarget(null);
    });
  }

  async function renameEntry(rawName: string) {
    const entry = renameTarget;
    if (!entry) return { ok: false as const, error: "Nothing selected." };

    const name = rawName.trim();
    if (!name) return { ok: false as const, error: "Enter a name." };
    if (/[\\/]/.test(name) || name === "." || name === "..") {
      return {
        ok: false as const,
        error: "Name can’t include path separators.",
      };
    }
    if (name === entry.name) {
      return { ok: true as const };
    }
    if (entries.some((e) => e.name === name && e.path !== entry.path)) {
      return {
        ok: false as const,
        error: `“${name}” already exists here.`,
      };
    }

    const next =
      connection.kind === "local"
        ? joinLocal(path, name)
        : joinRemote(path, name);

    try {
      if (connection.kind === "local") await fsRename(entry.path, next);
      else await sftpRename(connection.sessionId, entry.path, next);

      setEntries((prev) => {
        const updated = prev.map((e) =>
          e.path === entry.path
            ? {
                ...e,
                name,
                path: next,
                hidden: name.startsWith("."),
              }
            : e,
        );
        updated.sort((a, b) => {
          if (a.kind === "dir" && b.kind !== "dir") return -1;
          if (a.kind !== "dir" && b.kind === "dir") return 1;
          return a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
          });
        });
        return updated;
      });
      setSelected([next]);
      onStatus(`Renamed to “${name}”.`);
      void loadPath(path, { soft: true });
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: invokeErrorMessage(err, "Rename failed."),
      };
    }
  }

  function toggleSelect(path: string, additive: boolean) {
    setSelected((prev) => {
      if (!additive) return [path];
      if (prev.includes(path)) return prev.filter((p) => p !== path);
      return [...prev, path];
    });
  }

  async function confirmDelete() {
    const entry = deleteTarget;
    if (!entry || deleting) return;
    setDeleting(true);
    // Optimistic remove — keep UI snappy while the host deletes.
    setEntries((prev) => prev.filter((e) => e.path !== entry.path));
    setSelected((prev) => prev.filter((p) => p !== entry.path));
    setDeleteTarget(null);
    try {
      if (connection.kind === "local") await fsRemove(entry.path);
      else
        await sftpRemove(
          connection.sessionId,
          entry.path,
          entry.kind === "dir",
        );
      onStatus(`Deleted “${entry.name}”.`);
      void loadPath(path, { soft: true });
    } catch (err) {
      onStatus(null, invokeErrorMessage(err, "Delete failed."));
      void loadPath(path, { soft: true });
    } finally {
      setDeleting(false);
    }
  }

  const title =
    connectStatus?.host.name ??
    (connection.kind === "local" ? "Local" : connection.hostName);
  const remoteHost =
    connection.kind === "remote"
      ? items.find(
          (item): item is HostItem =>
            item.kind === "host" && item.id === connection.hostId,
        )
      : undefined;
  const subtitle = connectStatus
    ? hostSummary(connectStatus.host)
    : connection.kind === "local"
      ? "This computer"
      : remoteHost
        ? hostSummary(remoteHost)
        : "Remote host";

  const showOverlay = connectStatus !== null;
  const overlayTitle =
    connectStatus?.phase === "listing" ? "Loading files" : "Connecting";
  const overlayHost = connectStatus?.host;

  const isParentSelected = selected.includes("..");
  const selectedEntry =
    selected.length === 1
      ? entries.find((e) => e.path === selected[0]) ?? null
      : null;

  const showParentRow = canGoUp(path, connection.kind);
  const crumbs = useMemo(
    () => pathCrumbs(path, connection.kind),
    [path, connection.kind],
  );

  return (
    <section
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-(--shadow-sm) backdrop-blur-[var(--blur-sm)] transition-[border-color,box-shadow] duration-150 ease-[var(--ease-fox)]",
        showOverlay && "border-fox/35",
        dropActive &&
          "border-fox/60 outline outline-2 outline-offset-[-2px] outline-fox/28"
      )}
      data-sftp-pane={side}
    >
      {dropActive ? (
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 z-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fox/40 bg-surface-solid/92 px-3.5 py-1.5 text-[0.78rem] font-bold text-fox shadow-(--shadow-sm)"
          aria-hidden
        >
          Drop to copy
        </div>
      ) : null}

      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-line px-2.5 pt-2.5 pb-1.5">
        <div className="relative min-w-0 flex-1" data-sftp-source>
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full max-w-64 justify-start gap-1.5 bg-[var(--field-bg)] px-2 py-1.5 text-left text-ink shadow-none"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            aria-controls={`sftp-picker-${side}`}
            disabled={showOverlay}
          >
            {connection.kind === "local" && !connectStatus ? (
              <IconDeviceDesktop {...iconSm} aria-hidden />
            ) : (
              <IconServer {...iconSm} aria-hidden />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <strong className="truncate text-[0.8rem] font-bold">{title}</strong>
              <em className="truncate text-[0.7rem] not-italic text-ink-muted">
                {subtitle}
              </em>
            </span>
            <IconChevronRight size={14} stroke={1.75} aria-hidden />
          </Button>
          {pickerOpen ? (
            <SftpHostPicker
              id={`sftp-picker-${side}`}
              items={items}
              connecting={showOverlay}
              onSelectLocal={() => {
                onConnectionChange({ kind: "local" });
                onPathChange("");
              }}
              onSelectHost={(host) => {
                void onConnectHost(host);
              }}
              onClose={() => setPickerOpen(false)}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            title="Home"
            aria-label="Go to home folder"
            disabled={showOverlay}
            onClick={() => {
              onPathChange("");
              void (async () => {
                try {
                  const home =
                    connection.kind === "local"
                      ? await fsHomeDir()
                      : await sftpHomeDir(connection.sessionId);
                  await loadPath(home);
                } catch (err) {
                  onStatus(
                    null,
                    invokeErrorMessage(err, "Home failed."),
                  );
                }
              })();
            }}
          >
            <IconHome {...iconSm} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            title="Up"
            aria-label="Go to parent folder"
            disabled={showOverlay || !showParentRow}
            onClick={() => void goUp()}
          >
            <IconArrowUp {...iconSm} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            title="Refresh"
            aria-label="Refresh folder"
            disabled={showOverlay}
            onClick={() => void loadPath(path, { soft: true })}
          >
            <IconRefresh {...iconSm} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            title={showHidden ? "Hide hidden files" : "Show hidden files"}
            aria-label={showHidden ? "Hide hidden files" : "Show hidden files"}
            aria-pressed={showHidden}
            disabled={showOverlay}
            onClick={onToggleHidden}
          >
            {showHidden ? (
              <IconEyeOff {...iconSm} aria-hidden />
            ) : (
              <IconEye {...iconSm} aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            title="New file"
            aria-label="New file"
            disabled={showOverlay || !path}
            onClick={() => setCreateFileOpen(true)}
          >
            <IconFilePlus {...iconSm} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            title="New folder"
            aria-label="New folder"
            disabled={showOverlay || !path}
            onClick={() => setMkdirOpen(true)}
          >
            <IconFolderPlus {...iconSm} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8"
            title="Rename"
            aria-label="Rename selected"
            disabled={showOverlay || !selectedEntry}
            onClick={requestRenameSelected}
          >
            <IconPencil {...iconSm} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
            aria-label="Delete selected"
            disabled={showOverlay || !selectedEntry || deleting}
            onClick={requestDeleteSelected}
          >
            <IconTrash {...iconSm} aria-hidden />
          </Button>
        </div>
      </header>

      <nav
        className="flex shrink-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] border-b border-line px-2.5 py-1.5 font-mono text-[0.72rem] text-ink-muted"
        aria-label="Current path"
        title={path}
      >
        {crumbs.length === 0 ? (
          <span className="px-1">—</span>
        ) : (
          crumbs.map((crumb, index) => {
            const isCurrent = index === crumbs.length - 1;
            return (
              <span key={crumb.path} className="inline-flex shrink-0 items-center">
                {index > 0 ? (
                  <IconChevronRight
                    className="shrink-0 text-ink-muted/70"
                    size={12}
                    stroke={1.75}
                    aria-hidden
                  />
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto max-w-44 shrink-0 overflow-hidden rounded-xs px-1.5 py-0.5 text-ellipsis whitespace-nowrap font-semibold shadow-none",
                    isCurrent
                      ? "text-ink hover:bg-transparent"
                      : "text-ink-muted hover:bg-foreground/6 hover:text-ink"
                  )}
                  disabled={isCurrent || loading}
                  onClick={() => {
                    if (!isCurrent) void loadPath(crumb.path);
                  }}
                  title={crumb.path}
                >
                  {crumb.label}
                </Button>
              </span>
            );
          })
        )}
      </nav>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {showOverlay && overlayHost ? (
          <ConnectionOverlay
            embedded
            variant="connecting"
            title={overlayTitle}
            hostLabel={overlayHost.name || hostSummary(overlayHost)}
            meta={hostSummary(overlayHost)}
          />
        ) : null}

        {loading && !showOverlay ? (
          <div
            className="pointer-events-none absolute inset-0 z-2 grid place-items-center bg-surface/18"
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-solid/94 px-3 py-1.5 text-xs font-bold text-ink-muted shadow-(--shadow-sm)">
              <Spinner size={16} className="text-fox" />
              <span>Loading…</span>
            </span>
          </div>
        ) : null}

        {!loading && (showParentRow || visible.length > 0) ? (
          <div
            className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-0.5 border-b border-line/60 bg-surface-muted/30 px-1.5 py-1 text-[0.68rem] font-semibold tracking-wider text-ink-muted/70 uppercase select-none"
            aria-hidden
          >
            <span />
            <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2 px-1.5">
              <span />
              <span>Name</span>
              <span className="text-right">Size</span>
              <span className="text-right">Modified</span>
            </div>
          </div>
        ) : null}

        <ContextMenu
          onOpenChange={(open) => {
            if (!open) setContextTarget(null);
          }}
        >
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                "min-h-0 flex-1 overflow-auto p-1.5 [scrollbar-width:thin]",
                showOverlay && "invisible",
                loading && !showOverlay && "pointer-events-none"
              )}
              role="list"
              onContextMenu={onListContextMenu}
            >
              {!loading && !showParentRow && visible.length === 0 ? (
                showOverlay ? null : (
                  <p className="mx-3 my-6 text-center text-[0.85rem] text-ink-muted">
                    This folder is empty.
                  </p>
                )
              ) : (
                <>
                  {showParentRow ? (
                    <div
                      role="listitem"
                      data-sftp-parent=""
                      className={cn(
                        "grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-0.5 rounded-sm",
                        isParentSelected && "bg-fox/10"
                      )}
                    >
                      <span className="size-6" aria-hidden />
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto min-w-0 grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-ink shadow-none hover:bg-foreground/5"
                        disabled={loading}
                        aria-label="Parent folder. Select with click, open with Enter"
                        aria-pressed={isParentSelected}
                        onClick={(e) =>
                          toggleSelect("..", e.metaKey || e.ctrlKey)
                        }
                        onDoubleClick={() => void goUp()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void goUp();
                          }
                        }}
                        title="Click to select · Enter or double-click to open"
                      >
                        <span
                          className="grid place-items-center text-fox"
                          aria-hidden
                        >
                          <IconFolder size={18} stroke={1.75} />
                        </span>
                        <span className="truncate text-[0.8125rem] font-semibold">
                          ..
                        </span>
                        <span className="truncate text-right text-[0.7rem] text-ink-muted">
                          —
                        </span>
                        <span className="truncate text-right text-[0.7rem] text-ink-muted">
                          —
                        </span>
                      </Button>
                    </div>
                  ) : null}
                  {visible.map((entry) => {
                    const isSelected = selected.includes(entry.path);
                    const isDragging = !!draggingPaths?.includes(entry.path);
                    return (
                      <div
                        key={entry.path}
                        role="listitem"
                        data-sftp-entry={entry.path}
                        className={cn(
                          "grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-0.5 rounded-sm",
                          isSelected && "bg-fox/10",
                          isDragging && "opacity-45"
                        )}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-6 cursor-grab text-ink-muted active:cursor-grabbing"
                          title="Drag to other pane to copy"
                          aria-label={`Drag ${entry.name} to copy`}
                          tabIndex={-1}
                          disabled={loading}
                          onPointerDown={(e) => {
                            const batch =
                              selected.includes(entry.path) &&
                              selected.length > 1
                                ? visible.filter((item) =>
                                    selected.includes(item.path),
                                  )
                                : [entry];
                            if (!selected.includes(entry.path)) {
                              setSelected([entry.path]);
                            }
                            onDragGrip(batch, e);
                          }}
                        >
                          <IconGripVertical
                            size={16}
                            stroke={1.75}
                            aria-hidden
                          />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto min-w-0 grid grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-ink shadow-none hover:bg-foreground/5"
                          disabled={loading}
                          aria-label={
                            entry.kind === "dir"
                              ? `${entry.name}, folder. Select with click, open with Enter`
                              : `${entry.name}, file`
                          }
                          aria-pressed={isSelected}
                          onClick={(e) =>
                            toggleSelect(entry.path, e.metaKey || e.ctrlKey)
                          }
                          onDoubleClick={() => void openEntry(entry)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void openEntry(entry);
                            }
                          }}
                          title={
                            entry.kind === "dir"
                              ? "Click to select · Enter or double-click to open"
                              : entry.name
                          }
                        >
                          <span
                            className={cn(
                              "grid place-items-center",
                              entry.kind === "dir"
                                ? "text-fox"
                                : "text-ink-muted"
                            )}
                            aria-hidden
                          >
                            {entry.kind === "dir" ? (
                              <IconFolder size={18} stroke={1.75} />
                            ) : (
                              <IconFile size={18} stroke={1.75} />
                            )}
                          </span>
                          <span className="truncate text-[0.8125rem] font-semibold">
                            {entry.name}
                          </span>
                          <span className="truncate text-right text-[0.7rem] tabular-nums text-ink-muted">
                            {entry.sizeLabel ??
                              (entry.kind === "dir"
                                ? "—"
                                : formatBytes(entry.size))}
                          </span>
                          <span className="truncate text-right text-[0.7rem] text-ink-muted">
                            {entry.modifiedLabel ??
                              formatModified(entry.modified)}
                          </span>
                        </Button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {contextTarget ? (
              <>
                {contextTarget.kind === "dir" ? (
                  <ContextMenuItem
                    onSelect={() => void openEntry(contextTarget)}
                  >
                    <IconFolderOpen size={16} stroke={1.75} aria-hidden />
                    Open
                  </ContextMenuItem>
                ) : (
                  <ContextMenuItem
                    onSelect={() => onOpenFile?.(contextTarget, connection)}
                  >
                    <IconCode size={16} stroke={1.75} aria-hidden />
                    Edit file
                  </ContextMenuItem>
                )}
                <ContextMenuItem
                  onSelect={() => setRenameTarget(contextTarget)}
                >
                  <IconPencil size={16} stroke={1.75} aria-hidden />
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => setDeleteTarget(contextTarget)}
                >
                  <IconTrash size={16} stroke={1.75} aria-hidden />
                  Delete
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            ) : null}
            <ContextMenuItem
              disabled={!path}
              onSelect={() => setCreateFileOpen(true)}
            >
              <IconFilePlus size={16} stroke={1.75} aria-hidden />
              New file
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!path}
              onSelect={() => setMkdirOpen(true)}
            >
              <IconFolderPlus size={16} stroke={1.75} aria-hidden />
              New folder
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <NameDialog
        open={createFileOpen}
        title="New file"
        lede={path ? `Inside ${path}` : "Choose a folder first."}
        submitLabel="Create"
        placeholder="e.g. notes.txt"
        emptyError="Enter a file name."
        saveError="Could not create file."
        onClose={() => setCreateFileOpen(false)}
        onSubmitName={(name) => createFile(name)}
        icon={<IconFilePlus size={22} stroke={1.75} aria-hidden />}
        submitIcon={<IconCheck size={16} stroke={1.75} aria-hidden />}
        cancelIcon={<IconX size={16} stroke={1.75} aria-hidden />}
      />

      <NameDialog
        open={mkdirOpen}
        title="New folder"
        lede={path ? `Inside ${path}` : "Choose a folder first."}
        submitLabel="Create"
        placeholder="e.g. backups"
        emptyError="Enter a folder name."
        saveError="Could not create folder."
        onClose={() => setMkdirOpen(false)}
        onSubmitName={(name) => createFolder(name)}
        icon={<IconFolderPlus size={22} stroke={1.75} aria-hidden />}
        submitIcon={<IconCheck size={16} stroke={1.75} aria-hidden />}
        cancelIcon={<IconX size={16} stroke={1.75} aria-hidden />}
      />

      <NameDialog
        open={renameTarget !== null}
        title={renameTarget?.kind === "dir" ? "Rename folder" : "Rename file"}
        lede={
          renameTarget
            ? `Rename “${renameTarget.name}”`
            : "Select a file or folder first."
        }
        submitLabel="Rename"
        placeholder="New name"
        initialName={renameTarget?.name ?? ""}
        emptyError="Enter a name."
        saveError="Could not rename."
        onClose={() => setRenameTarget(null)}
        onSubmitName={(name) => renameEntry(name)}
        icon={<IconPencil size={22} stroke={1.75} aria-hidden />}
        submitIcon={<IconCheck size={16} stroke={1.75} aria-hidden />}
        cancelIcon={<IconX size={16} stroke={1.75} aria-hidden />}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === "dir" ? "Delete folder" : "Delete file"}
        message={
          deleteTarget?.kind === "dir"
            ? `Delete “${deleteTarget.name}” and everything inside it? This cannot be undone.`
            : `Delete “${deleteTarget?.name ?? ""}”? This cannot be undone.`
        }
        busy={deleting}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
        icon={<IconTrash size={22} stroke={1.75} aria-hidden />}
        confirmIcon={<IconTrash size={16} stroke={1.75} aria-hidden />}
        cancelIcon={<IconX size={16} stroke={1.75} aria-hidden />}
      />
    </section>
  );
}
