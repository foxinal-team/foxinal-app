import {
  IconFolder,
  IconFolderShare,
  IconFile,
  IconX,
  IconRefresh,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import {
  type PointerEvent as ReactPointerEvent,
  memo,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { HostItem, InventoryItem } from "@/inventory/types";
import {
  cancelSftpTransfer,
  formatBytes,
  invokeErrorMessage,
  isTransferCancelledMessage,
  sftpConnect,
  sftpDisconnect,
  transferEntries,
} from "./api";
import {
  SftpPane,
  type PaneConnectStatus,
  type SftpPaneSide,
} from "./SftpPane";
import {
  SFTP_TRANSFER_PROGRESS_EVENT,
  type FsEntry,
  type PaneConnection,
  type TransferProgress,
  type TransferRequest,
  type TransferUiPhase,
} from "./types";

type SftpViewProps = {
  items: InventoryItem[];
  onBlockingDialogChange?: (open: boolean) => void;
};

/** UI-facing drag state — no pointer coordinates (those update the ghost via DOM). */
type DragUi = {
  side: SftpPaneSide;
  entries: FsEntry[];
  over: SftpPaneSide | null;
};

type PendingDrag = {
  side: SftpPaneSide;
  entries: FsEntry[];
  originX: number;
  originY: number;
};

type TransferUi = {
  id: string;
  phase: TransferUiPhase;
  request: TransferRequest;
  progress: TransferProgress;
  error?: string;
};

const DRAG_THRESHOLD_PX2 = 36;

function newTransferId(): string {
  return `xfer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function paneFromPoint(x: number, y: number): SftpPaneSide | null {
  const el = document
    .elementFromPoint(x, y)
    ?.closest("[data-sftp-pane]") as HTMLElement | null;
  const side = el?.dataset.sftpPane;
  return side === "left" || side === "right" ? side : null;
}

function TransferProgressCard({
  transfer,
  onCancel,
  onRetry,
  onDismiss,
}: {
  transfer: TransferUi;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const [live, setLive] = useState<TransferProgress>(transfer.progress);

  useEffect(() => {
    if (transfer.phase !== "running") return;

    setLive(transfer.progress);
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let raf = 0;
    let pending: TransferProgress | null = null;

    void listen<TransferProgress>(SFTP_TRANSFER_PROGRESS_EVENT, (event) => {
      if (cancelled) return;
      if (event.payload.transferId !== transfer.id) return;
      pending = event.payload;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!cancelled && pending) setLive(pending);
      });
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      unlisten?.();
    };
  }, [transfer.id, transfer.phase, transfer.progress]);

  const progress = live;
  const percent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.transferred / progress.total) * 100))
      : null;

  const running = transfer.phase === "running";
  const title =
    transfer.phase === "cancelled"
      ? "Transfer cancelled"
      : transfer.phase === "failed"
        ? "Transfer failed"
        : "Transferring";
  const route = `${transfer.request.sourceLabel} → ${transfer.request.destLabel}`;

  const stopped =
    transfer.phase === "failed" || transfer.phase === "cancelled";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-sm border border-line bg-surface px-3 py-2.5 shadow-(--shadow-sm)",
        stopped && "border-destructive/35 bg-destructive/8"
      )}
      role={stopped ? "alert" : "status"}
      aria-live={stopped ? "assertive" : "polite"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex min-w-0 flex-col gap-0.5 text-[0.8125rem] font-bold text-ink">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {running ? (
              <Spinner size={16} className="shrink-0 text-fox" />
            ) : (
              <IconAlertTriangle
                size={16}
                stroke={1.75}
                className="shrink-0 text-destructive"
              />
            )}
            <span className="truncate">
              {title} “{progress.name}”
            </span>
          </span>
          <span className="pl-[1.375rem] text-[0.72rem] font-semibold text-ink-muted">
            {route}
          </span>
        </span>
        <span className="text-xs font-semibold tabular-nums text-ink-muted">
          {formatBytes(progress.transferred)}
          {progress.total > 0 ? ` / ${formatBytes(progress.total)}` : ""}
          {percent !== null ? ` · ${percent}%` : ""}
        </span>
      </div>

      {transfer.phase === "failed" && transfer.error ? (
        <p className="m-0 text-xs text-destructive">{transfer.error}</p>
      ) : null}

      <Progress
        value={percent ?? 0}
        indeterminate={percent === null && running}
        aria-label={`Transferring ${progress.name} from ${transfer.request.sourceLabel} to ${transfer.request.destLabel}`}
        aria-valuetext={
          percent !== null
            ? `${percent} percent`
            : running
              ? "In progress"
              : "Waiting"
        }
      />

      <div className="flex flex-wrap justify-end gap-1.5">
        {running ? (
          <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
            <IconX size={15} stroke={1.75} aria-hidden />
            <span>Cancel</span>
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" size="xs" onClick={onDismiss}>
              <IconX size={15} stroke={1.75} aria-hidden />
              <span>Dismiss</span>
            </Button>
            <Button type="button" size="xs" onClick={onRetry}>
              <IconRefresh size={15} stroke={1.75} aria-hidden />
              <span>Retry</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function SftpView({ items, onBlockingDialogChange }: SftpViewProps) {
  const [left, setLeft] = useState<PaneConnection>({ kind: "local" });
  const [right, setRight] = useState<PaneConnection>({ kind: "local" });
  const [leftPath, setLeftPath] = useState("");
  const [rightPath, setRightPath] = useState("");
  const [leftHidden, setLeftHidden] = useState(false);
  const [rightHidden, setRightHidden] = useState(false);
  const [leftRefresh, setLeftRefresh] = useState(0);
  const [rightRefresh, setRightRefresh] = useState(0);
  const [leftConnect, setLeftConnect] = useState<PaneConnectStatus>(null);
  const [rightConnect, setRightConnect] = useState<PaneConnectStatus>(null);
  const [drag, setDrag] = useState<DragUi | null>(null);
  const [transfers, setTransfers] = useState<TransferUi[]>([]);
  const [leftDialogOpen, setLeftDialogOpen] = useState(false);
  const [rightDialogOpen, setRightDialogOpen] = useState(false);

  const sessionsRef = useRef<Set<string>>(new Set());
  const pendingDragRef = useRef<PendingDrag | null>(null);
  const dragUiRef = useRef<DragUi | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useRef<HTMLSpanElement | null>(null);
  dragUiRef.current = drag;

  useEffect(() => {
    onBlockingDialogChange?.(leftDialogOpen || rightDialogOpen);
  }, [leftDialogOpen, rightDialogOpen, onBlockingDialogChange]);

  useEffect(() => {
    const sessions = sessionsRef.current;
    return () => {
      for (const id of sessions) {
        void sftpDisconnect(id).catch(() => undefined);
      }
      sessions.clear();
    };
  }, []);

  function setFeedback(message: string | null, err?: string | null) {
    if (err) toast.error(err);
    else if (message) toast.success(message);
  }

  async function connectSide(side: SftpPaneSide, host: HostItem) {
    const setConnect = side === "left" ? setLeftConnect : setRightConnect;
    const setConn = side === "left" ? setLeft : setRight;
    const setPath = side === "left" ? setLeftPath : setRightPath;
    const current = side === "left" ? left : right;

    setConnect({ phase: "connecting", host });

    try {
      const { sessionId, home } = await sftpConnect(host);
      sessionsRef.current.add(sessionId);

      if (current.kind === "remote") {
        const other = side === "left" ? right : left;
        const stillUsed =
          other.kind === "remote" && other.sessionId === current.sessionId;
        if (!stillUsed) {
          sessionsRef.current.delete(current.sessionId);
          void sftpDisconnect(current.sessionId).catch(() => undefined);
        }
      }

      setConnect({ phase: "listing", host });
      setPath(home);
      setConn({
        kind: "remote",
        hostId: host.id,
        hostName: host.name,
        sessionId,
      });
      setFeedback(`Connected to “${host.name}”.`);
    } catch (err) {
      setConnect(null);
      toast.error(invokeErrorMessage(err, "Connection failed."));
    }
  }

  function clearConnect(side: SftpPaneSide) {
    if (side === "left") setLeftConnect(null);
    else setRightConnect(null);
  }

  function switchToLocal(side: SftpPaneSide, next: PaneConnection) {
    if (next.kind !== "local") return;
    clearConnect(side);
    const current = side === "left" ? left : right;
    if (current.kind === "remote") {
      const other = side === "left" ? right : left;
      const stillUsed =
        other.kind === "remote" && other.sessionId === current.sessionId;
      if (!stillUsed) {
        sessionsRef.current.delete(current.sessionId);
        void sftpDisconnect(current.sessionId).catch(() => undefined);
      }
    }
    if (side === "left") {
      setLeft(next);
      setLeftPath("");
      setLeftRefresh((n) => n + 1);
    } else {
      setRight(next);
      setRightPath("");
      setRightRefresh((n) => n + 1);
    }
  }

  function bumpRefresh(side: SftpPaneSide) {
    if (side === "left") setLeftRefresh((n) => n + 1);
    else setRightRefresh((n) => n + 1);
  }

  async function executeTransfer(request: TransferRequest) {
    const seed: TransferProgress = {
      transferId: request.id,
      name: request.entryName,
      transferred: 0,
      total: request.sourceIsDir ? 0 : request.entrySize,
      done: false,
    };
    const ui: TransferUi = {
      id: request.id,
      phase: "running",
      request,
      progress: seed,
    };
    setTransfers((prev) => {
      const without = prev.filter((t) => t.id !== request.id);
      return [...without, ui];
    });

    try {
      const result = await transferEntries({
        transferId: request.id,
        sourceKind: request.sourceKind,
        sourceSessionId: request.sourceSessionId,
        destKind: request.destKind,
        destSessionId: request.destSessionId,
        sourcePath: request.sourcePath,
        sourceIsDir: request.sourceIsDir,
        destDir: request.destDir,
        entryName: request.entryName,
        entrySize: request.sourceIsDir ? null : request.entrySize,
      });
      setTransfers((prev) => prev.filter((t) => t.id !== request.id));
      toast.success(result.message, `${request.sourceLabel} → ${request.destLabel}`);
      bumpRefresh(request.destSide);
    } catch (err) {
      const message = invokeErrorMessage(err, "Transfer failed.");
      const cancelled = isTransferCancelledMessage(message);
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === request.id
            ? {
                ...t,
                phase: cancelled ? "cancelled" : "failed",
                progress: seed,
                error: cancelled ? undefined : message,
              }
            : t,
        ),
      );
      if (cancelled) {
        toast.warning(
          `Cancelled “${request.entryName}”.`,
          `${request.sourceLabel} → ${request.destLabel}`,
        );
      } else {
        toast.error(message, `${request.sourceLabel} → ${request.destLabel}`);
      }
      bumpRefresh(request.destSide);
    }
  }

  function runTransfer(destSide: SftpPaneSide, payload: DragUi) {
    if (payload.side === destSide || payload.entries.length === 0) return;

    const sourceConn = payload.side === "left" ? left : right;
    const destConn = destSide === "left" ? left : right;
    const destPath = destSide === "left" ? leftPath : rightPath;
    if (!destPath) {
      toast.warning("Open a folder on the target pane first.");
      return;
    }

    const sourceLabel =
      sourceConn.kind === "local" ? "Local" : sourceConn.hostName;
    const destLabel = destConn.kind === "local" ? "Local" : destConn.hostName;
    const route = `${sourceLabel} → ${destLabel}`;
    const count = payload.entries.length;
    toast.info(
      count === 1
        ? `Transferring “${payload.entries[0].name}”…`
        : `Transferring ${count} items…`,
      route,
    );

    for (const entry of payload.entries) {
      const request: TransferRequest = {
        id: newTransferId(),
        destSide,
        sourceKind: sourceConn.kind,
        sourceSessionId:
          sourceConn.kind === "remote" ? sourceConn.sessionId : null,
        sourceLabel,
        destKind: destConn.kind,
        destSessionId: destConn.kind === "remote" ? destConn.sessionId : null,
        destLabel,
        sourcePath: entry.path,
        sourceIsDir: entry.kind === "dir",
        destDir: destPath,
        entryName: entry.name,
        entrySize: entry.size,
      };
      void executeTransfer(request);
    }
  }

  function handleCancelTransfer(id: string) {
    void cancelSftpTransfer(id);
  }

  function handleRetryTransfer(id: string) {
    const current = transfers.find((t) => t.id === id);
    if (!current || current.phase === "running") return;
    const next: TransferRequest = { ...current.request, id: newTransferId() };
    setTransfers((prev) => prev.filter((t) => t.id !== id));
    void executeTransfer(next);
  }

  function handleDismissTransfer(id: string) {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
  }

  function updateGhost(x: number, y: number, over: SftpPaneSide | null, side: SftpPaneSide) {
    const ghost = ghostRef.current;
    if (ghost) {
      ghost.style.transform = `translate3d(${x + 12}px, ${y + 12}px, 0)`;
    }
    const hint = hintRef.current;
    if (hint) {
      hint.textContent =
        over && over !== side ? "Release to copy" : "Drop on the other pane";
    }
  }

  function beginEntryDrag(
    side: SftpPaneSide,
    entries: FsEntry[],
    e: ReactPointerEvent,
  ) {
    if (e.button !== 0 || entries.length === 0) return;
    e.preventDefault();
    e.stopPropagation();

    pendingDragRef.current = {
      side,
      entries,
      originX: e.clientX,
      originY: e.clientY,
    };

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    let raf = 0;
    let latest: PointerEvent | null = null;

    const cleanup = () => {
      if (raf) cancelAnimationFrame(raf);
      document.body.style.userSelect = prevUserSelect;
      delete document.body.dataset.sftpDragging;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };

    const applyMove = (ev: PointerEvent) => {
      const pending = pendingDragRef.current;
      let ui = dragUiRef.current;

      if (!ui && pending) {
        const dx = ev.clientX - pending.originX;
        const dy = ev.clientY - pending.originY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX2) return;
        document.body.dataset.sftpDragging = "true";
        ui = { side: pending.side, entries: pending.entries, over: null };
        pendingDragRef.current = null;
        dragUiRef.current = ui;
        setDrag(ui);
        requestAnimationFrame(() => {
          updateGhost(ev.clientX, ev.clientY, null, ui!.side);
        });
        return;
      }

      if (!ui) return;
      const over = paneFromPoint(ev.clientX, ev.clientY);
      updateGhost(ev.clientX, ev.clientY, over, ui.side);
      if (over !== ui.over) {
        const next = { ...ui, over };
        dragUiRef.current = next;
        setDrag(next);
      }
    };

    const onMove = (ev: PointerEvent) => {
      latest = ev;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (latest) applyMove(latest);
      });
    };

    const finish = (ev: PointerEvent) => {
      const ui = dragUiRef.current;
      cleanup();
      pendingDragRef.current = null;
      dragUiRef.current = null;
      setDrag(null);

      if (!ui) return;
      const over = paneFromPoint(ev.clientX, ev.clientY);
      if (over && over !== ui.side) runTransfer(over, ui);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  return (
    <section className="mt-4 flex min-h-0 flex-1 flex-col gap-3 motion-safe:animate-panel-rise">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="grid size-[var(--control-h)] shrink-0 place-items-center rounded-sm bg-fox/12 text-fox"
            aria-hidden
          >
            <IconFolderShare size={20} stroke={1.75} />
          </span>
          <div>
            <h1 className="m-0 font-(family-name:--font-brand) text-[1.35rem] font-bold tracking-[-0.03em] text-ink">
              SFTP
            </h1>
            <p className="mt-0.5 mb-0 max-w-xl text-[0.85rem] text-ink-muted">
              Browse local and remote files side by side. Select multiple with
              ⌘/Ctrl-click, then drag onto the other pane to copy.
            </p>
          </div>
        </div>
      </header>

      {transfers.length > 0 ? (
        <div className="flex max-h-[40vh] shrink-0 flex-col gap-1.5 overflow-auto">
          {transfers.map((t) => (
            <TransferProgressCard
              key={t.id}
              transfer={t}
              onCancel={() => handleCancelTransfer(t.id)}
              onRetry={() => handleRetryTransfer(t.id)}
              onDismiss={() => handleDismissTransfer(t.id)}
            />
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-3 max-[900px]:grid-cols-1 max-[900px]:grid-rows-2 min-[901px]:grid-cols-2 min-[901px]:grid-rows-none",
          drag && "select-none [&_*]:!cursor-grabbing",
        )}
      >
        <MemoSftpPane
          side="left"
          items={items}
          connection={left}
          path={leftPath}
          onPathChange={setLeftPath}
          onConnectionChange={(next) => {
            if (next.kind === "local") switchToLocal("left", next);
          }}
          onConnectHost={(host) => connectSide("left", host)}
          connectStatus={leftConnect}
          onConnectReady={() => clearConnect("left")}
          showHidden={leftHidden}
          onToggleHidden={() => setLeftHidden((v) => !v)}
          refreshKey={leftRefresh}
          dropActive={!!drag && drag.over === "left" && drag.side !== "left"}
          draggingPaths={
            drag?.side === "left" ? drag.entries.map((e) => e.path) : null
          }
          onDragGrip={(entries, event) => beginEntryDrag("left", entries, event)}
          onStatus={setFeedback}
          onBlockingDialogChange={setLeftDialogOpen}
        />
        <MemoSftpPane
          side="right"
          items={items}
          connection={right}
          path={rightPath}
          onPathChange={setRightPath}
          onConnectionChange={(next) => {
            if (next.kind === "local") switchToLocal("right", next);
          }}
          onConnectHost={(host) => connectSide("right", host)}
          connectStatus={rightConnect}
          onConnectReady={() => clearConnect("right")}
          showHidden={rightHidden}
          onToggleHidden={() => setRightHidden((v) => !v)}
          refreshKey={rightRefresh}
          dropActive={!!drag && drag.over === "right" && drag.side !== "right"}
          draggingPaths={
            drag?.side === "right" ? drag.entries.map((e) => e.path) : null
          }
          onDragGrip={(entries, event) =>
            beginEntryDrag("right", entries, event)
          }
          onStatus={setFeedback}
          onBlockingDialogChange={setRightDialogOpen}
        />
      </div>

      {drag ? (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed top-0 left-0 z-40 flex max-w-64 items-center gap-1.5 rounded-sm border border-fox/40 bg-surface-solid/94 px-2.5 py-1.5 shadow-(--panel-shadow) will-change-transform"
          style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
          aria-hidden
        >
          <span className="grid shrink-0 place-items-center text-fox">
            {drag.entries[0]?.kind === "dir" ? (
              <IconFolder size={16} stroke={1.75} />
            ) : (
              <IconFile size={16} stroke={1.75} />
            )}
          </span>
          <span className="min-w-0 truncate text-[0.8rem] font-bold text-ink">
            {drag.entries.length === 1
              ? drag.entries[0].name
              : `${drag.entries.length} items`}
          </span>
          <span
            ref={hintRef}
            className="shrink-0 text-[0.68rem] font-bold whitespace-nowrap text-fox"
          >
            Drop on the other pane
          </span>
        </div>
      ) : null}
    </section>
  );
}

const MemoSftpPane = memo(SftpPane);
