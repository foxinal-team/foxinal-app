import {
  IconChevronRight,
  IconDeviceDesktop,
  IconFolder,
  IconFolderPlus,
  IconRefresh,
  IconServer,
  IconTrash,
  IconEye,
  IconEyeOff,
  IconFile,
  IconHome,
  IconArrowUp,
  IconX,
  IconLoader2,
  IconGripVertical,
  IconCheck,
} from "@tabler/icons-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConfirmDeleteDialog } from "../inventory/ConfirmDeleteDialog";
import { NameDialog } from "../inventory/NameDialog";
import type { HostItem, InventoryItem } from "../inventory/types";
import { hostSummary } from "../inventory/types";
import {
  formatBytes,
  formatModified,
  fsHomeDir,
  fsListDir,
  fsMkdir,
  fsRemove,
  invokeErrorMessage,
  joinLocal,
  joinRemote,
  canGoUp,
  parentPath,
  pathCrumbs,
  sftpHomeDir,
  sftpListDir,
  sftpMkdir,
  sftpRemove,
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
  connectError: string | null;
  onConnectReady: () => void;
  showHidden: boolean;
  onToggleHidden: () => void;
  refreshKey: number;
  dropActive: boolean;
  draggingPaths: string[] | null;
  onDragGrip: (entries: FsEntry[], event: ReactPointerEvent) => void;
  onStatus: (message: string | null, error?: string | null) => void;
  onBlockingDialogChange?: (open: boolean) => void;
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
  connectError,
  onConnectReady,
  showHidden,
  onToggleHidden,
  refreshKey,
  dropActive,
  draggingPaths,
  onDragGrip,
  onStatus,
  onBlockingDialogChange,
}: SftpPaneProps) {
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<FsEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const listGenRef = useRef(0);
  const connectReadyRef = useRef(onConnectReady);
  connectReadyRef.current = onConnectReady;

  useEffect(() => {
    const open = deleteTarget !== null || mkdirOpen;
    onBlockingDialogChange?.(open);
    return () => onBlockingDialogChange?.(false);
  }, [deleteTarget, mkdirOpen, onBlockingDialogChange]);

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
      setEntries((prev) => {
        if (prev.some((e) => e.path === next)) return prev;
        const merged = [...prev, optimistic];
        merged.sort((a, b) => {
          if (a.kind === "dir" && b.kind !== "dir") return -1;
          if (a.kind !== "dir" && b.kind === "dir") return 1;
          return a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
          });
        });
        return merged;
      });
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

  function requestDeleteSelected() {
    if (selected.length !== 1) return;
    const entry = entries.find((e) => e.path === selected[0]);
    if (!entry) return;
    setDeleteTarget(entry);
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

  const showParentRow = canGoUp(path, connection.kind);
  const crumbs = useMemo(
    () => pathCrumbs(path, connection.kind),
    [path, connection.kind],
  );

  return (
    <section
      className={[
        "sftp-pane",
        dropActive ? "sftp-pane--drop" : "",
        showOverlay ? "sftp-pane--busy" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-sftp-pane={side}
    >
      <header className="sftp-pane__header">
        <div className="sftp-pane__source">
          <button
            type="button"
            className="sftp-pane__source-btn"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            disabled={showOverlay}
          >
            {connection.kind === "local" && !connectStatus ? (
              <IconDeviceDesktop {...iconSm} aria-hidden />
            ) : (
              <IconServer {...iconSm} aria-hidden />
            )}
            <span className="sftp-pane__source-text">
              <strong>{title}</strong>
              <em>{subtitle}</em>
            </span>
            <IconChevronRight size={14} stroke={1.75} aria-hidden />
          </button>
          {pickerOpen ? (
            <SftpHostPicker
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

        <div className="sftp-pane__tools">
          <button
            type="button"
            className="sftp-pane__icon-btn"
            title="Home"
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
          </button>
          <button
            type="button"
            className="sftp-pane__icon-btn"
            title="Up"
            disabled={showOverlay || !showParentRow}
            onClick={() => void goUp()}
          >
            <IconArrowUp {...iconSm} aria-hidden />
          </button>
          <button
            type="button"
            className="sftp-pane__icon-btn"
            title="Refresh"
            disabled={showOverlay}
            onClick={() => void loadPath(path, { soft: true })}
          >
            <IconRefresh {...iconSm} aria-hidden />
          </button>
          <button
            type="button"
            className="sftp-pane__icon-btn"
            title={showHidden ? "Hide hidden files" : "Show hidden files"}
            disabled={showOverlay}
            onClick={onToggleHidden}
          >
            {showHidden ? (
              <IconEyeOff {...iconSm} aria-hidden />
            ) : (
              <IconEye {...iconSm} aria-hidden />
            )}
          </button>
          <button
            type="button"
            className="sftp-pane__icon-btn"
            title="New folder"
            disabled={showOverlay || !path}
            onClick={() => setMkdirOpen(true)}
          >
            <IconFolderPlus {...iconSm} aria-hidden />
          </button>
          <button
            type="button"
            className="sftp-pane__icon-btn sftp-pane__icon-btn--danger"
            title="Delete"
            disabled={showOverlay || selected.length !== 1 || deleting}
            onClick={requestDeleteSelected}
          >
            <IconTrash {...iconSm} aria-hidden />
          </button>
        </div>
      </header>

      <nav className="sftp-pane__path" aria-label="Current path" title={path}>
        {crumbs.length === 0 ? (
          <span className="sftp-pane__path-empty">—</span>
        ) : (
          crumbs.map((crumb, index) => {
            const isCurrent = index === crumbs.length - 1;
            return (
              <span key={crumb.path} className="sftp-pane__path-wrap">
                {index > 0 ? (
                  <IconChevronRight
                    className="sftp-pane__path-sep"
                    size={12}
                    stroke={1.75}
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  className={
                    isCurrent
                      ? "sftp-pane__path-crumb sftp-pane__path-crumb--current"
                      : "sftp-pane__path-crumb"
                  }
                  disabled={isCurrent || loading}
                  onClick={() => {
                    if (!isCurrent) void loadPath(crumb.path);
                  }}
                  title={crumb.path}
                >
                  {crumb.label}
                </button>
              </span>
            );
          })
        )}
      </nav>

      {connectError ? (
        <p className="sftp-pane__error" role="alert">
          {connectError}
        </p>
      ) : null}

      <div className="sftp-pane__body">
        {showOverlay && overlayHost ? (
          <div className="conn-overlay sftp-pane__overlay" role="status" aria-live="polite">
            <div className="conn-overlay__pulse" aria-hidden />
            <div className="conn-overlay__card">
              <span className="conn-overlay__spinner" aria-hidden>
                <IconLoader2 size={28} stroke={1.75} />
              </span>
              <p className="conn-overlay__title">{overlayTitle}</p>
              <p className="conn-overlay__host">
                {overlayHost.name || hostSummary(overlayHost)}
              </p>
              <p className="conn-overlay__meta">{hostSummary(overlayHost)}</p>
              <div className="conn-overlay__track" aria-hidden>
                <span className="conn-overlay__bar" />
              </div>
            </div>
          </div>
        ) : null}

        {loading && !showOverlay ? (
          <div className="sftp-pane__list-spinner" role="status" aria-live="polite">
            <span className="sftp-pane__list-spinner-chip">
              <IconLoader2 size={16} stroke={1.75} className="sftp__spin" />
              <span>Loading…</span>
            </span>
          </div>
        ) : null}

        <div
          className={
            [
              "sftp-pane__list",
              showOverlay ? "sftp-pane__list--dimmed" : "",
              loading && !showOverlay ? "sftp-pane__list--busy" : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
          role="list"
        >
          {!loading && !showParentRow && visible.length === 0 ? (
            <p className="sftp-pane__empty">
              {showOverlay ? "" : "This folder is empty."}
            </p>
          ) : (
            <>
              {showParentRow ? (
                <div
                  role="listitem"
                  className="sftp-pane__row sftp-pane__row--dir sftp-pane__row--parent"
                >
                  <span className="sftp-pane__grip sftp-pane__grip--spacer" aria-hidden />
                  <button
                    type="button"
                    className="sftp-pane__row-main"
                    disabled={loading}
                    onClick={() => void goUp()}
                    onDoubleClick={() => void goUp()}
                    title="Go to parent folder"
                  >
                    <span className="sftp-pane__row-icon" aria-hidden>
                      <IconFolder size={18} stroke={1.75} />
                    </span>
                    <span className="sftp-pane__row-name">..</span>
                    <span className="sftp-pane__row-meta">—</span>
                    <span className="sftp-pane__row-meta sftp-pane__row-meta--date">
                      —
                    </span>
                  </button>
                </div>
              ) : null}
              {visible.map((entry) => {
              const isSelected = selected.includes(entry.path);
              const isDragging = !!draggingPaths?.includes(entry.path);
              return (
                <div
                  key={entry.path}
                  role="listitem"
                  className={[
                    "sftp-pane__row",
                    isSelected ? "sftp-pane__row--selected" : "",
                    entry.kind === "dir" ? "sftp-pane__row--dir" : "",
                    isDragging ? "sftp-pane__row--dragging" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="sftp-pane__grip"
                    title="Drag to other pane to copy"
                    aria-label={`Drag ${entry.name}`}
                    disabled={loading}
                    onPointerDown={(e) => {
                      const batch =
                        selected.includes(entry.path) && selected.length > 1
                          ? visible.filter((item) => selected.includes(item.path))
                          : [entry];
                      if (!selected.includes(entry.path)) {
                        setSelected([entry.path]);
                      }
                      onDragGrip(batch, e);
                    }}
                  >
                    <IconGripVertical size={16} stroke={1.75} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="sftp-pane__row-main"
                    disabled={loading}
                    onClick={(e) =>
                      toggleSelect(entry.path, e.metaKey || e.ctrlKey)
                    }
                    onDoubleClick={() => void openEntry(entry)}
                    title={
                      entry.kind === "dir"
                        ? "Double-click to open"
                        : entry.name
                    }
                  >
                    <span className="sftp-pane__row-icon" aria-hidden>
                      {entry.kind === "dir" ? (
                        <IconFolder size={18} stroke={1.75} />
                      ) : (
                        <IconFile size={18} stroke={1.75} />
                      )}
                    </span>
                    <span className="sftp-pane__row-name">{entry.name}</span>
                    <span className="sftp-pane__row-meta">
                      {entry.sizeLabel ??
                        (entry.kind === "dir" ? "—" : formatBytes(entry.size))}
                    </span>
                    <span className="sftp-pane__row-meta sftp-pane__row-meta--date">
                      {entry.modifiedLabel ?? formatModified(entry.modified)}
                    </span>
                  </button>
                </div>
              );
            })}
            </>
          )}
        </div>
      </div>

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
