import { useEffect, useMemo, useRef, useState } from "react";
import { TerminalView } from "@/components/TerminalView";
import { SplitSessionDialog } from "@/components/SplitSessionDialog";
import type { HostItem } from "@/inventory/types";
import {
  collectLeaves,
  type SessionTab,
  type SplitDirection,
  type TerminalLayoutNode,
  type TerminalPaneLeaf,
  type TerminalSession,
} from "@/lib/sessions";
import { cn } from "@/lib/utils";
import type { TerminalPrefs } from "@/settings/terminalPrefs";

type TerminalSplitHostProps = {
  tab: SessionTab;
  active: boolean;
  hosts?: HostItem[];
  onCloseTab: () => void;
  onSplitPane: (
    tabId: string,
    targetPaneId: string,
    direction: SplitDirection,
    session: TerminalSession,
  ) => void;
  onClosePane: (tabId: string, paneId: string) => void;
  onSetActivePane: (tabId: string, paneId: string) => void;
  onUpdateRatio: (tabId: string, splitNodeId: string, ratio: number) => void;
  terminalPrefs: TerminalPrefs;
  appTheme: string;
};

type TreeNodeProps = {
  node: TerminalLayoutNode;
  tabId: string;
  active: boolean;
  activePaneId: string;
  totalLeavesCount: number;
  leaves: TerminalPaneLeaf[];
  onSetActivePane: (tabId: string, paneId: string) => void;
  onOpenSplit: (
    targetPaneId: string,
    direction: SplitDirection,
    session: TerminalSession,
  ) => void;
  onClosePane: (tabId: string, paneId: string) => void;
  onCloseTab: () => void;
  onUpdateRatio: (tabId: string, splitNodeId: string, ratio: number) => void;
  onToggleMaximize: (paneId: string) => void;
  terminalPrefs: TerminalPrefs;
  appTheme: string;
};

function SplitDivider({
  direction,
  onDragRatio,
}: {
  direction: SplitDirection;
  onDragRatio: (ratio: number) => void;
}) {
  const isDraggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const parentContainer = (e.currentTarget as HTMLElement).parentElement;
    if (!parentContainer) return;
    const rect = parentContainer.getBoundingClientRect();

    let moveRaf: number | null = null;
    const onPointerMove = (moveEv: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (moveRaf !== null) cancelAnimationFrame(moveRaf);
      moveRaf = requestAnimationFrame(() => {
        if (!isDraggingRef.current) return;
        if (direction === "vertical") {
          const deltaX = moveEv.clientX - rect.left;
          const newPct = Math.min(80, Math.max(20, (deltaX / rect.width) * 100));
          onDragRatio(newPct);
        } else {
          const deltaY = moveEv.clientY - rect.top;
          const newPct = Math.min(80, Math.max(20, (deltaY / rect.height) * 100));
          onDragRatio(newPct);
        }
      });
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      if (moveRaf !== null) cancelAnimationFrame(moveRaf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className={cn(
        "group z-20 flex items-center justify-center transition-colors select-none shrink-0",
        direction === "vertical"
          ? "w-2.5 cursor-col-resize -mx-1"
          : "h-2.5 cursor-row-resize -my-1",
      )}
      title="Drag to resize split panes"
    >
      <div
        className={cn(
          "rounded-full bg-line/80 group-hover:bg-fox transition-colors",
          direction === "vertical" ? "h-8 w-1" : "h-1 w-8",
        )}
      />
    </div>
  );
}

function TerminalTreeNode({
  node,
  tabId,
  active,
  activePaneId,
  totalLeavesCount,
  leaves,
  onSetActivePane,
  onOpenSplit,
  onClosePane,
  onCloseTab,
  onUpdateRatio,
  onToggleMaximize,
  terminalPrefs,
  appTheme,
}: TreeNodeProps) {
  if (node.type === "leaf") {
    const isFocused = node.id === activePaneId;
    const leafIndex = leaves.findIndex((l) => l.id === node.id) + 1;

    return (
      <div
        key={node.id}
        onClick={() => onSetActivePane(tabId, node.id)}
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col rounded-md transition-[box-shadow,opacity] duration-100 overflow-hidden",
          totalLeavesCount > 1 &&
            (isFocused
              ? "ring-1 ring-fox/60 shadow-(--shadow-sm)"
              : "opacity-95 hover:opacity-100 ring-1 ring-line/50"),
        )}
      >
        <TerminalView
          key={node.id}
          session={node.session}
          sessionId={node.id}
          active={active}
          isFocusedPane={isFocused}
          onFocusPane={() => onSetActivePane(tabId, node.id)}
          isSplitView={totalLeavesCount > 1}
          canMaximize={totalLeavesCount > 1}
          isMaximized={false}
          onToggleMaximize={() => onToggleMaximize(node.id)}
          paneIndex={leafIndex}
          paneCount={totalLeavesCount}
          onSplitVertical={() => onOpenSplit(node.id, "vertical", node.session)}
          onSplitHorizontal={() =>
            onOpenSplit(node.id, "horizontal", node.session)
          }
          onCloseSession={
            totalLeavesCount > 1
              ? () => onClosePane(tabId, node.id)
              : onCloseTab
          }
          terminalPrefs={terminalPrefs}
          appTheme={appTheme}
        />
      </div>
    );
  }

  // Split Node
  const [child0, child1] = node.children;
  const isVertical = node.direction === "vertical";

  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1",
        isVertical ? "flex-row gap-1.5" : "flex-col gap-1.5",
      )}
    >
      <div
        style={{
          flex: `0 0 calc(${node.ratio}% - 5px)`,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
        }}
      >
        <TerminalTreeNode
          node={child0}
          tabId={tabId}
          active={active}
          activePaneId={activePaneId}
          totalLeavesCount={totalLeavesCount}
          leaves={leaves}
          onSetActivePane={onSetActivePane}
          onOpenSplit={onOpenSplit}
          onClosePane={onClosePane}
          onCloseTab={onCloseTab}
          onUpdateRatio={onUpdateRatio}
          onToggleMaximize={onToggleMaximize}
          terminalPrefs={terminalPrefs}
          appTheme={appTheme}
        />
      </div>

      <SplitDivider
        direction={node.direction}
        onDragRatio={(ratio) => onUpdateRatio(tabId, node.id, ratio)}
      />

      <div
        style={{
          flex: `0 0 calc(${100 - node.ratio}% - 5px)`,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
        }}
      >
        <TerminalTreeNode
          node={child1}
          tabId={tabId}
          active={active}
          activePaneId={activePaneId}
          totalLeavesCount={totalLeavesCount}
          leaves={leaves}
          onSetActivePane={onSetActivePane}
          onOpenSplit={onOpenSplit}
          onClosePane={onClosePane}
          onCloseTab={onCloseTab}
          onUpdateRatio={onUpdateRatio}
          onToggleMaximize={onToggleMaximize}
          terminalPrefs={terminalPrefs}
          appTheme={appTheme}
        />
      </div>
    </div>
  );
}

export function TerminalSplitHost({
  tab,
  active,
  hosts = [],
  onCloseTab,
  onSplitPane,
  onClosePane,
  onSetActivePane,
  onUpdateRatio,
  terminalPrefs,
  appTheme,
}: TerminalSplitHostProps) {
  // Split Session Dialog state
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [targetPaneId, setTargetPaneId] = useState<string>("");
  const [pendingDirection, setPendingDirection] = useState<SplitDirection>(
    "vertical",
  );
  const [pendingSession, setPendingSession] = useState<TerminalSession>(
    tab.session,
  );

  // Maximize Pane state
  const [maximizedPaneId, setMaximizedPaneId] = useState<string | null>(null);

  // Fallback if tab.layout is missing (legacy)
  const layoutRoot: TerminalLayoutNode =
    tab.layout || {
      type: "leaf",
      id: tab.id,
      session: tab.session,
      title: tab.title,
      subtitle: tab.subtitle,
    };

  const leaves = useMemo(() => collectLeaves(layoutRoot), [layoutRoot]);
  const activePaneId = tab.activePaneId || leaves[0]?.id;

  // Whenever leaves count drops to 1, reset maximize state
  useEffect(() => {
    if (leaves.length <= 1) {
      setMaximizedPaneId(null);
    }
  }, [leaves.length]);

  const handleOpenSplit = (
    paneId: string,
    direction: SplitDirection,
    session: TerminalSession,
  ) => {
    setTargetPaneId(paneId);
    setPendingDirection(direction);
    setPendingSession(session);
    setSplitDialogOpen(true);
  };

  const handleSelectSession = (session: TerminalSession) => {
    setMaximizedPaneId(null);
    onSplitPane(tab.id, targetPaneId, pendingDirection, session);
  };

  const handleNavigateNext = () => {
    if (!maximizedPaneId) return;
    const currentIndex = leaves.findIndex((p) => p.id === maximizedPaneId);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % leaves.length;
    const nextPane = leaves[nextIndex];
    setMaximizedPaneId(nextPane.id);
    onSetActivePane(tab.id, nextPane.id);
  };

  const handleNavigatePrev = () => {
    if (!maximizedPaneId) return;
    const currentIndex = leaves.findIndex((p) => p.id === maximizedPaneId);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + leaves.length) % leaves.length;
    const prevPane = leaves[prevIndex];
    setMaximizedPaneId(prevPane.id);
    onSetActivePane(tab.id, prevPane.id);
  };

  const maximizedLeaf = maximizedPaneId
    ? leaves.find((l) => l.id === maximizedPaneId) || leaves[0]
    : null;

  return (
    <div className="relative flex h-full min-h-0 flex-1">
      {maximizedLeaf ? (
        <div className="relative flex min-h-0 flex-1 flex-col rounded-md overflow-hidden">
          <TerminalView
            key={maximizedLeaf.id}
            session={maximizedLeaf.session}
            sessionId={maximizedLeaf.id}
            active={active}
            isFocusedPane={true}
            onFocusPane={() => onSetActivePane(tab.id, maximizedLeaf.id)}
            isSplitView={leaves.length > 1}
            canMaximize={true}
            isMaximized={true}
            onToggleMaximize={() => setMaximizedPaneId(null)}
            paneIndex={
              leaves.findIndex((l) => l.id === maximizedLeaf.id) + 1
            }
            paneCount={leaves.length}
            onNavigateNextPane={handleNavigateNext}
            onNavigatePrevPane={handleNavigatePrev}
            onSplitVertical={() =>
              handleOpenSplit(maximizedLeaf.id, "vertical", maximizedLeaf.session)
            }
            onSplitHorizontal={() =>
              handleOpenSplit(
                maximizedLeaf.id,
                "horizontal",
                maximizedLeaf.session,
              )
            }
            onCloseSession={
              leaves.length > 1
                ? () => {
                    setMaximizedPaneId(null);
                    onClosePane(tab.id, maximizedLeaf.id);
                  }
                : onCloseTab
            }
            terminalPrefs={terminalPrefs}
            appTheme={appTheme}
          />
        </div>
      ) : (
        <TerminalTreeNode
          node={layoutRoot}
          tabId={tab.id}
          active={active}
          activePaneId={activePaneId}
          totalLeavesCount={leaves.length}
          leaves={leaves}
          onSetActivePane={onSetActivePane}
          onOpenSplit={handleOpenSplit}
          onClosePane={onClosePane}
          onCloseTab={onCloseTab}
          onUpdateRatio={onUpdateRatio}
          onToggleMaximize={(paneId) => setMaximizedPaneId(paneId)}
          terminalPrefs={terminalPrefs}
          appTheme={appTheme}
        />
      )}

      <SplitSessionDialog
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        direction={pendingDirection}
        currentSession={pendingSession}
        hosts={hosts}
        onSelectSession={handleSelectSession}
      />
    </div>
  );
}
