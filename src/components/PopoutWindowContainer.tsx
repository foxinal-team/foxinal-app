import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  IconArrowBackUp,
  IconLayoutColumns,
  IconLayoutRows,
  IconTerminal2,
  IconX,
} from "@tabler/icons-react";
import { BrandMark } from "@/components/BrandMark";
import { TerminalSplitHost } from "@/components/TerminalSplitHost";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { loadInventory } from "@/inventory/store";
import type { HostItem } from "@/inventory/types";
import {
  clearPopoutTabData,
  loadPopoutTabData,
  REATTACH_EVENT,
  savePopoutTabData,
  type ReattachPayload,
} from "@/lib/popout";
import {
  removeLeafFromTree,
  splitLeafInTree,
  updateSplitNodeRatio,
  type SessionTab,
  type SplitDirection,
  type TerminalSession,
} from "@/lib/sessions";
import {
  loadTerminalPrefs,
  type TerminalPrefs,
} from "@/settings/terminalPrefs";

export type PopoutWindowContainerProps = {
  tabId: string;
  kind?: "terminal" | "sftp";
};

export function PopoutWindowContainer({
  tabId,
}: PopoutWindowContainerProps) {
  const { theme, cycleTheme, label: themeLabel } = useTheme();
  const [terminalPrefs] = useState<TerminalPrefs>(() => loadTerminalPrefs());
  const [tab, setTab] = useState<SessionTab | null>(() =>
    loadPopoutTabData(tabId),
  );
  const [hosts] = useState<HostItem[]>(() => {
    const inv = loadInventory();
    return inv.items.filter((item): item is HostItem => item.kind === "host");
  });

  // Re-attach back to main window
  async function handleReattach() {
    if (tab) {
      savePopoutTabData(tab.id, tab);
      const payload: ReattachPayload = { tabId: tab.id, tab };
      try {
        await emit(REATTACH_EVENT, payload);
      } catch (err) {
        console.error("Failed to emit reattach event:", err);
      }
    }
    clearPopoutTabData(tabId);
    try {
      const win = getCurrentWebviewWindow();
      await win.close();
    } catch {
      window.close();
    }
  }

  // Handle closing the entire session
  async function handleCloseWindow() {
    clearPopoutTabData(tabId);
    try {
      const win = getCurrentWebviewWindow();
      await win.close();
    } catch {
      window.close();
    }
  }

  // Split pane handlers
  function handleSplitPane(
    _tId: string,
    targetLeafId: string,
    direction: SplitDirection,
    newSession: TerminalSession,
  ) {
    if (!tab) return;
    const { root, newLeafId } = splitLeafInTree(
      tab.layout,
      targetLeafId,
      direction,
      newSession,
    );
    const updated: SessionTab = {
      ...tab,
      layout: root,
      activePaneId: newLeafId || tab.activePaneId,
    };
    setTab(updated);
    savePopoutTabData(tab.id, updated);
  }

  function handleClosePane(_tId: string, leafId: string) {
    if (!tab) return;
    const nextTree = removeLeafFromTree(tab.layout, leafId);
    if (!nextTree) {
      handleCloseWindow();
      return;
    }
    const updated: SessionTab = {
      ...tab,
      layout: nextTree,
      activePaneId:
        tab.activePaneId === leafId ? nextTree.id : tab.activePaneId,
    };
    setTab(updated);
    savePopoutTabData(tab.id, updated);
  }

  function handleSetActivePane(_tId: string, paneId: string) {
    if (!tab) return;
    const updated: SessionTab = {
      ...tab,
      activePaneId: paneId,
    };
    setTab(updated);
    savePopoutTabData(tab.id, updated);
  }

  function handleUpdateSplitRatio(
    _tId: string,
    splitId: string,
    ratio: number,
  ) {
    if (!tab) return;
    const nextTree = updateSplitNodeRatio(tab.layout, splitId, ratio);
    const updated: SessionTab = {
      ...tab,
      layout: nextTree,
    };
    setTab(updated);
    savePopoutTabData(tab.id, updated);
  }

  // Automatically signal re-attachment on window unload so session isn't lost
  useEffect(() => {
    const onBeforeUnload = () => {
      if (tab) {
        savePopoutTabData(tab.id, tab);
        emit(REATTACH_EVENT, { tabId: tab.id, tab }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [tab]);

  if (!tab) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-canvas p-6 text-ink">
        <BrandMark />
        <p className="text-sm text-ink-muted">
          Session data not found or has been closed.
        </p>
        <Button variant="outline" size="sm" onClick={handleCloseWindow}>
          Close Window
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas text-ink select-none">
      {/* Popout Header Bar */}
      <header
        className="flex h-11 shrink-0 items-center justify-between border-b border-edge/60 bg-surface/80 px-3 backdrop-blur-md"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2.5 min-w-0" data-tauri-drag-region>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-fox/10 text-fox">
            <IconTerminal2 size={16} stroke={1.8} />
          </div>
          <div className="min-w-0 flex items-baseline gap-2">
            <span className="truncate text-xs font-semibold text-ink">
              {tab.title}
            </span>
            {tab.subtitle ? (
              <span className="hidden truncate text-[11px] text-ink-muted sm:inline">
                {tab.subtitle}
              </span>
            ) : null}
            <span className="rounded-full bg-fox/15 px-2 py-0.5 text-[10px] font-medium text-fox">
              Detached Window
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-ink-muted hover:text-ink"
            title="Split Horizontal (Stacked)"
            onClick={() =>
              handleSplitPane(
                tab.id,
                tab.activePaneId,
                "horizontal",
                tab.session,
              )
            }
          >
            <IconLayoutRows size={15} stroke={1.75} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-ink-muted hover:text-ink"
            title="Split Vertical (Side-by-side)"
            onClick={() =>
              handleSplitPane(
                tab.id,
                tab.activePaneId,
                "vertical",
                tab.session,
              )
            }
          >
            <IconLayoutColumns size={15} stroke={1.75} />
          </Button>

          <ThemeToggle
            theme={theme}
            label={themeLabel}
            onCycle={cycleTheme}
          />

          <div className="h-4 w-px bg-edge/60 mx-1" />

          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs font-medium bg-fox hover:bg-fox-bright text-white shadow-xs"
            onClick={handleReattach}
            title="Re-attach this terminal tab back to main Foxinal window"
          >
            <IconArrowBackUp size={14} stroke={2} />
            <span>Attach Back</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-ink-muted hover:text-destructive hover:bg-destructive/10"
            title="Close Terminal Session"
            onClick={handleCloseWindow}
          >
            <IconX size={15} stroke={1.75} />
          </Button>
        </div>
      </header>

      {/* Main Full-Window Terminal Host */}
      <main className="flex min-h-0 flex-1 flex-col">
        <TerminalSplitHost
          tab={tab}
          active={true}
          hosts={hosts}
          onCloseTab={handleCloseWindow}
          onSplitPane={handleSplitPane}
          onClosePane={handleClosePane}
          onSetActivePane={handleSetActivePane}
          onUpdateRatio={handleUpdateSplitRatio}
          terminalPrefs={terminalPrefs}
          appTheme={theme}
        />
      </main>
    </div>
  );
}
