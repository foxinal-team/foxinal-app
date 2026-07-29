import {
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconDeviceDesktop,
  IconDownload,
  IconFolder,
  IconFolderPlus,
  IconFolders,
  IconGripVertical,
  IconLayoutGrid,
  IconLayoutList,
  IconLogout,
  IconPencil,
  IconPlugConnected,
  IconSearch,
  IconServer,
  IconServerSpark,
  IconSettings,
  IconSortAscendingLetters,
  IconSortDescendingLetters,
  IconTerminal2,
  IconFolderShare,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Atmosphere } from "@/components/Atmosphere";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UpdateAvailableDialog } from "@/components/UpdateAvailableDialog";
import { toast } from "@/lib/toast";
import {
  checkForUpdates,
  openReleasePage,
  skipVersion,
  type LatestRelease,
} from "@/lib/updates";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TerminalView } from "@/components/TerminalView";
import { ConfirmDeleteDialog } from "@/inventory/ConfirmDeleteDialog";
import { HostDialog } from "@/inventory/HostDialog";
import { NameDialog } from "@/inventory/NameDialog";
import { useInventory, type SaveResult } from "@/inventory/useInventory";
import type { SecurityPrefs } from "@/security/prefs";
import { useLockGuards } from "@/hooks/useLockGuards";
import { SettingsDialog } from "@/settings/SettingsDialog";
import {
  loadTerminalPrefs,
  saveTerminalPrefs,
  type TerminalPrefs,
} from "@/settings/terminalPrefs";
import {
  canMoveItem,
  hostSummary,
  isDescendantOf,
  matchesInventorySearch,
  relativeLocationLabel,
  type GroupItem,
  type HostInput,
  type HostItem,
  type InventoryItem,
} from "@/inventory/types";
import {
  buildExportPayload,
  downloadExport,
  exportFilename,
  mergeImportedItems,
  readExportFile,
} from "@/inventory/transfer";
import {
  loadInventoryLayout,
  loadInventorySort,
  saveInventoryLayout,
  saveInventorySort,
  type InventoryLayout,
  type InventorySort,
} from "@/inventory/viewPrefs";
import {
  createHostTab,
  createLocalTab,
  type SessionTab,
} from "@/lib/sessions";
import { SftpView } from "@/sftp/SftpView";

type DashboardView = "dashboard" | "session" | "sftp";

type DashboardProps = {
  vaultKey: CryptoKey | null;
  initialItems: InventoryItem[];
  securityEnabled: boolean;
  securityPrefs: SecurityPrefs;
  onLock: () => void;
  onSecurityChange: () => void;
  onVaultKeyChange: (key: CryptoKey | null) => void;
  onSecurityPrefsChange: (prefs: SecurityPrefs) => void;
  theme: string;
  themeLabel: string;
  onCycleTheme: () => void;
};

const iconProps = { size: 18, stroke: 1.75 } as const;
const actionIcon = { size: 16, stroke: 1.75 } as const;
const typeIcon = { size: 20, stroke: 1.75 } as const;

type DropTarget =
  | { kind: "group"; id: string }
  | { kind: "crumb"; id: string | null };

/** Resolve inventory drop target under the pointer (pointer DnD — not HTML5). */
function dropTargetFromPoint(x: number, y: number): DropTarget | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof Element)) continue;
    const node = el.closest("[data-fox-drop]");
    if (!(node instanceof HTMLElement)) continue;
    const raw = node.getAttribute("data-fox-drop");
    if (raw === null) continue;
    const kindAttr = node.getAttribute("data-fox-drop-kind");
    if (kindAttr === "crumb") {
      return { kind: "crumb", id: raw === "root" ? null : raw };
    }
    if (raw === "root") continue;
    return { kind: "group", id: raw };
  }
  return null;
}

function unwrapSave(
  result: SaveResult | boolean,
  fallback: string,
): { ok: true } | { ok: false; error: string } {
  if (result === true) return { ok: true };
  if (result === false) return { ok: false, error: fallback };
  return result;
}

export function Dashboard({
  vaultKey,
  initialItems,
  securityEnabled,
  securityPrefs,
  onLock,
  onSecurityChange,
  onVaultKeyChange,
  onSecurityPrefsChange,
  theme,
  themeLabel,
  onCycleTheme,
}: DashboardProps) {
  const displayName = "Local";
  const [view, setView] = useState<DashboardView>("dashboard");
  const [tabs, setTabs] = useState<SessionTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createHostOpen, setCreateHostOpen] = useState(false);
  const [duplicateHostInput, setDuplicateHostInput] = useState<HostInput | null>(
    null,
  );
  const [renameGroupTarget, setRenameGroupTarget] = useState<GroupItem | null>(
    null,
  );
  const [editHostTarget, setEditHostTarget] = useState<HostItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sftpDialogOpen, setSftpDialogOpen] = useState(false);
  const [updatePrompt, setUpdatePrompt] = useState<LatestRelease | null>(null);
  const [sftpMounted, setSftpMounted] = useState(false);
  const [terminalPrefs, setTerminalPrefs] = useState<TerminalPrefs>(() =>
    loadTerminalPrefs(),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const dragArmedRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [layout, setLayout] = useState<InventoryLayout>(() =>
    loadInventoryLayout(),
  );
  const [sortDir, setSortDir] = useState<InventorySort>(() =>
    loadInventorySort(),
  );
  const {
    items,
    currentGroupId,
    currentGroup,
    currentChildren,
    breadcrumbs,
    createGroup,
    createHost,
    renameGroup,
    updateHost,
    buildDuplicateHostInput,
    deleteGroup,
    deleteHost,
    moveItem,
    replaceItems,
    openGroup,
    goToRoot,
    goToGroup,
  } = useInventory(vaultKey, initialItems);

  const itemsRef = useRef(items);
  const moveItemRef = useRef(moveItem);
  const openGroupRef = useRef(openGroup);
  const goToRootRef = useRef(goToRoot);
  itemsRef.current = items;
  moveItemRef.current = moveItem;
  openGroupRef.current = openGroup;
  goToRootRef.current = goToRoot;

  const parentLabel = currentGroup?.name ?? "All connections";
  const searchActive = searchQuery.trim().length > 0;

  const dialogOpen =
    settingsOpen ||
    createGroupOpen ||
    createHostOpen ||
    duplicateHostInput !== null ||
    renameGroupTarget !== null ||
    editHostTarget !== null ||
    deleteTarget !== null ||
    updatePrompt !== null ||
    sftpDialogOpen;

  useLockGuards({
    enabled: securityEnabled,
    suspended: dialogOpen,
    prefs: securityPrefs,
    onLock,
  });

  useEffect(() => {
    if (view === "sftp") setSftpMounted(true);
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await checkForUpdates();
      if (cancelled) return;
      if (result.status === "available" && !result.skipped) {
        setUpdatePrompt(result.latest);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { groups, hosts } = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const byName = (a: InventoryItem, b: InventoryItem) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dir;

    const pool = searchActive
      ? items.filter((item) => isDescendantOf(items, item, currentGroupId))
      : currentChildren;

    const nextGroups = pool
      .filter((item): item is GroupItem => item.kind === "group")
      .filter((item) => matchesInventorySearch(item, searchQuery))
      .sort(byName);

    const nextHosts = pool
      .filter((item): item is HostItem => item.kind === "host")
      .filter((item) => matchesInventorySearch(item, searchQuery))
      .sort(byName);

    return { groups: nextGroups, hosts: nextHosts };
  }, [
    items,
    currentChildren,
    currentGroupId,
    searchQuery,
    searchActive,
    sortDir,
  ]);

  const hasAnyChildren = searchActive
    ? items.some((item) => isDescendantOf(items, item, currentGroupId))
    : currentChildren.length > 0;
  const hasVisibleItems = groups.length > 0 || hosts.length > 0;
  const activeTab =
    tabs.find((tab) => tab.id === activeTabId) ?? tabs[tabs.length - 1] ?? null;

  function setInventoryLayout(next: InventoryLayout) {
    setLayout(next);
    saveInventoryLayout(next);
  }

  function toggleSortDir() {
    setSortDir((prev) => {
      const next = prev === "asc" ? "desc" : "asc";
      saveInventorySort(next);
      return next;
    });
  }

  function openTab(tab: SessionTab) {
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setView("session");
  }

  function openLocalTerminal() {
    openTab(createLocalTab());
  }

  function connectToHost(host: HostItem) {
    openTab(createHostTab(host));
  }

  function selectTab(id: string) {
    setActiveTabId(id);
    setView("session");
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === id);
      if (index === -1) return prev;
      const next = prev.filter((tab) => tab.id !== id);

      setActiveTabId((current) => {
        if (current !== id) return current;
        if (next.length === 0) return null;
        const fallback = next[Math.min(index, next.length - 1)];
        return fallback.id;
      });

      if (next.length === 0) {
        setView("dashboard");
      }

      return next;
    });
  }

  function openDuplicateHost(host: HostItem) {
    setDuplicateHostInput(buildDuplicateHostInput(host));
  }

  function handleTerminalPrefsChange(prefs: TerminalPrefs) {
    setTerminalPrefs(prefs);
    saveTerminalPrefs(prefs);
  }

  function beginPointerDrag(e: ReactPointerEvent, itemId: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    draggingIdRef.current = itemId;
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    dragArmedRef.current = false;
    setDraggingId(itemId);
    setDropTarget(null);
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    document.body.dataset.foxDragging = "true";

    const cleanup = () => {
      document.body.style.userSelect = prevUserSelect;
      delete document.body.dataset.foxDragging;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };

    const onMove = (ev: PointerEvent) => {
      const activeId = draggingIdRef.current;
      if (!activeId) return;

      const origin = dragOriginRef.current;
      if (!dragArmedRef.current && origin) {
        const dx = ev.clientX - origin.x;
        const dy = ev.clientY - origin.y;
        if (dx * dx + dy * dy < 25) return;
        dragArmedRef.current = true;
      }
      if (!dragArmedRef.current) return;

      const target = dropTargetFromPoint(ev.clientX, ev.clientY);
      if (!target || (target.kind === "group" && target.id === activeId)) {
        setDropTarget(null);
        return;
      }

      const check = canMoveItem(itemsRef.current, activeId, target.id);
      setDropTarget(check.ok ? target : null);
    };

    const finish = (ev: PointerEvent) => {
      const activeId = draggingIdRef.current;
      const armed = dragArmedRef.current;
      const target = armed ? dropTargetFromPoint(ev.clientX, ev.clientY) : null;

      draggingIdRef.current = null;
      dragOriginRef.current = null;
      dragArmedRef.current = false;
      cleanup();
      setDraggingId(null);
      setDropTarget(null);

      if (!activeId || !armed || !target) return;
      if (target.kind === "group" && target.id === activeId) return;

      const newParentId = target.id;
      const moved = itemsRef.current.find((item) => item.id === activeId);
      const result = moveItemRef.current(activeId, newParentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const dest =
        newParentId === null
          ? "All"
          : (itemsRef.current.find((item) => item.id === newParentId)?.name ??
            "group");
      toast.success(
        moved ? `Moved “${moved.name}” into ${dest}.` : "Item moved.",
      );

      if (newParentId === null) goToRootRef.current();
      else openGroupRef.current(newParentId);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function handleExport() {
    const payload = buildExportPayload(items, currentGroupId);
    if (payload.items.length === 0) {
      toast.warning(
        currentGroup
          ? `“${currentGroup.name}” has nothing to export yet.`
          : "Nothing to export yet.",
      );
      return;
    }
    downloadExport(
      payload,
      exportFilename(currentGroupId, currentGroup?.name),
    );
    toast.success(
      currentGroup
        ? `Exported ${payload.items.length} item${payload.items.length === 1 ? "" : "s"} from “${currentGroup.name}”.`
        : `Exported ${payload.items.length} item${payload.items.length === 1 ? "" : "s"}.`,
    );
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;

    const parsed = await readExportFile(file);
    if (!parsed.ok || !parsed.items) {
      toast.error(!parsed.ok ? parsed.error : "Invalid export file.");
      return;
    }

    const merged = mergeImportedItems(items, parsed.items, currentGroupId);
    if (!merged.ok || !merged.items) {
      toast.error(!merged.ok ? merged.error : "Could not import items.");
      return;
    }

    replaceItems(merged.items);
    toast.success(
      currentGroup
        ? `Imported ${merged.count} item${merged.count === 1 ? "" : "s"} into “${currentGroup.name}”.`
        : `Imported ${merged.count} item${merged.count === 1 ? "" : "s"}.`,
    );
  }

  return (
    <main className="relative isolate flex h-full max-h-dvh flex-col overflow-hidden px-[clamp(1rem,3vw,2rem)] py-[clamp(1rem,2.5vw,1.75rem)]">
      <Atmosphere variant="absolute" />

      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-line pb-3 motion-safe:animate-panel-rise">
        <div className="flex min-w-0 items-center gap-5">
          <p className="m-0 inline-flex items-center gap-2 font-(family-name:--font-brand) text-xl font-bold tracking-tight text-ink">
            <BrandMark className="size-[1.65rem] shrink-0 rounded-[22%]" />
            <span>foxinal</span>
          </p>
          <nav className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 backdrop-blur-[var(--blur-sm)]" aria-label="Primary">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-auto gap-1.5 rounded-sm px-3 py-1.5 text-[0.8125rem] font-semibold shadow-none",
                view === "dashboard"
                  ? "bg-fox/12 text-ink shadow-(--shadow-sm) hover:bg-fox/12"
                  : "text-ink-muted hover:bg-foreground/5 hover:text-ink"
              )}
              aria-current={view === "dashboard" ? "page" : undefined}
              onClick={() => setView("dashboard")}
            >
              <IconFolders {...iconProps} aria-hidden />
              <span>Connections</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-auto gap-1.5 rounded-sm px-3 py-1.5 text-[0.8125rem] font-semibold shadow-none",
                view === "sftp"
                  ? "bg-fox/12 text-ink shadow-(--shadow-sm) hover:bg-fox/12"
                  : "text-ink-muted hover:bg-foreground/5 hover:text-ink"
              )}
              aria-current={view === "sftp" ? "page" : undefined}
              onClick={() => setView("sftp")}
            >
              <IconFolderShare {...iconProps} aria-hidden />
              <span>SFTP</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-auto gap-1.5 rounded-sm px-3 py-1.5 text-[0.8125rem] font-semibold shadow-none",
                view === "session" && activeTab?.session.kind === "local"
                  ? "bg-fox/12 text-ink shadow-(--shadow-sm) hover:bg-fox/12"
                  : "text-ink-muted hover:bg-foreground/5 hover:text-ink"
              )}
              aria-current={
                view === "session" && activeTab?.session.kind === "local"
                  ? "page"
                  : undefined
              }
              onClick={openLocalTerminal}
            >
              <IconTerminal2 {...iconProps} aria-hidden />
              <span>Local</span>
            </Button>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle
            theme={theme}
            label={themeLabel}
            onCycle={onCycleTheme}
            className=""
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-[var(--control-h)] bg-[var(--toggle-bg)]"
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings {...iconProps} aria-hidden />
          </Button>
          <span
            className="inline-flex h-[var(--control-h)] max-w-40 items-center gap-1.5 overflow-hidden rounded-full border border-fox/30 bg-fox/8 px-3 text-xs font-semibold text-ellipsis whitespace-nowrap text-fox"
            title="Local mode — data stays on this device"
          >
            <IconDeviceDesktop size={16} stroke={1.75} aria-hidden />
            <span>{displayName}</span>
          </span>
          {securityEnabled ? (
            <Button
              type="button"
              variant="outline"
              className="h-[var(--control-h)] gap-1.5 bg-[var(--toggle-bg)] px-3.5 text-ink-muted"
              onClick={onLock}
              aria-label="Lock Foxinal"
              title="Lock Foxinal"
            >
              <IconLogout {...iconProps} aria-hidden />
              <span>Lock</span>
            </Button>
          ) : null}
        </div>
      </header>

      {tabs.length > 0 ? (
        <div
          className={cn(
            "mt-4 flex min-h-0 flex-col gap-2",
            view === "session" ? "flex-1" : "flex-none"
          )}
          data-parked={view !== "session" ? "" : undefined}
        >
          <div
            className="flex max-h-26 shrink-0 flex-wrap content-start items-center gap-1 overflow-x-hidden overflow-y-auto [scrollbar-width:thin]"
            role="tablist"
            aria-label="Open sessions"
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              if (tabs.length === 0) return;
              e.preventDefault();
              const currentIndex = Math.max(
                0,
                tabs.findIndex((tab) => tab.id === activeTab?.id),
              );
              const delta = e.key === "ArrowRight" ? 1 : -1;
              const next =
                tabs[(currentIndex + delta + tabs.length) % tabs.length];
              if (!next) return;
              selectTab(next.id);
              window.requestAnimationFrame(() => {
                document.getElementById(`session-tab-${next.id}`)?.focus();
              });
            }}
          >            {tabs.map((tab) => {
              const selected = tab.id === activeTab?.id && view === "session";
              return (
                <div
                  key={tab.id}
                  className={
                    selected
                      ? "inline-flex max-w-52 flex-none items-center overflow-hidden rounded-sm border border-fox/45 bg-fox/10"
                      : "inline-flex max-w-52 flex-none items-center overflow-hidden rounded-sm border border-line bg-surface"
                  }
                >
                  <Button
                    type="button"
                    variant="ghost"
                    id={`session-tab-${tab.id}`}
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`session-panel-${tab.id}`}
                    tabIndex={selected ? 0 : -1}
                    className="h-auto min-w-0 flex-1 justify-start gap-1.5 rounded-none py-1.5 pr-1 pl-2.5 text-[0.78rem] font-semibold text-ink shadow-none hover:bg-transparent"
                    title={tab.subtitle}
                    onClick={() => selectTab(tab.id)}
                  >
                    <span className="grid shrink-0 place-items-center text-fox" aria-hidden>
                      {tab.session.kind === "local" ? (
                        <IconTerminal2 size={14} stroke={1.75} />
                      ) : (
                        <IconPlugConnected size={14} stroke={1.75} />
                      )}
                    </span>
                    <span className="truncate">{tab.title}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="relative mr-0.5 size-6 rounded-[0.3rem] text-ink-muted after:absolute after:inset-[-0.35rem] after:content-['']"
                    aria-label={`Close ${tab.title}`}
                    title="Close tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    <IconX size={12} stroke={2} aria-hidden />
                  </Button>
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              "relative flex min-h-0 flex-1 flex-col",
              view !== "session" &&
                "absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 [clip:rect(0,0,0,0)] whitespace-nowrap"
            )}
            aria-hidden={view !== "session"}
            inert={view !== "session" ? true : undefined}
          >
            {tabs.map((tab) => {
              const paneActive = tab.id === activeTab?.id && view === "session";
              return (
                <div
                  key={tab.id}
                  id={`session-panel-${tab.id}`}
                  className={
                    paneActive
                      ? "flex min-h-0 flex-1 flex-col"
                      : "hidden"
                  }
                  role="tabpanel"
                  aria-labelledby={`session-tab-${tab.id}`}
                  aria-hidden={!paneActive}
                  inert={!paneActive ? true : undefined}
                >
                  <TerminalView
                    session={tab.session}
                    active={paneActive}
                    onCloseSession={() => closeTab(tab.id)}
                    terminalPrefs={terminalPrefs}
                    appTheme={theme}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "dashboard" ? (
        <section className="mt-5 flex min-h-0 flex-1 flex-col gap-4 motion-safe:animate-panel-rise">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <h1 className="m-0 flex items-center gap-2 font-(family-name:--font-brand) text-[clamp(1.5rem,3.5vw,1.9rem)] leading-tight font-bold tracking-[-0.035em] text-ink">
                {currentGroup ? (
                  <>
                    <IconFolder
                      className="shrink-0 text-fox"
                      size={26}
                      stroke={1.6}
                      aria-hidden
                    />
                    <span>{currentGroup.name}</span>
                  </>
                ) : (
                  <>
                    <IconFolders
                      className="shrink-0 text-fox"
                      size={26}
                      stroke={1.6}
                      aria-hidden
                    />
                    <span>Connections</span>
                  </>
                )}
              </h1>
              <p className="mt-1.5 mb-0 max-w-xl text-[0.9rem] leading-snug text-ink-muted">
                {currentGroup
                  ? "Double-click to open or connect. Use the grip handle to drag onto a group or breadcrumb."
                  : "Local data on this device. Use the grip to move items · double-click to open or connect."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="inline-flex items-center gap-1.5 [&+&]:ml-0.5 [&+&]:border-l [&+&]:border-line [&+&]:pl-2.5" role="group" aria-label="Transfer">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-[var(--control-h)]"
                  title={
                    currentGroup
                      ? `Import into “${currentGroup.name}”`
                      : "Import into All"
                  }
                  onClick={() => importInputRef.current?.click()}
                >
                  <IconUpload {...iconProps} aria-hidden />
                  <span>Import</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-[var(--control-h)]"
                  title={
                    currentGroup
                      ? `Export “${currentGroup.name}”`
                      : "Export all connections"
                  }
                  onClick={handleExport}
                >
                  <IconDownload {...iconProps} aria-hidden />
                  <span>Export</span>
                </Button>
              </div>
              <div className="inline-flex items-center gap-1.5 [&+&]:ml-0.5 [&+&]:border-l [&+&]:border-line [&+&]:pl-2.5" role="group" aria-label="Create">
                <Button
                  type="button"
                  className="h-[var(--control-h)]"
                  onClick={() => setCreateGroupOpen(true)}
                >
                  <IconFolderPlus {...iconProps} aria-hidden />
                  <span>New group</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-[var(--control-h)] bg-surface backdrop-blur-[var(--blur-sm)]"
                  onClick={() => setCreateHostOpen(true)}
                >
                  <IconServerSpark {...iconProps} aria-hidden />
                  <span>New host</span>
                </Button>
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  void handleImportFile(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-0.5 text-[0.8125rem]" aria-label="Group path">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-auto rounded-xs px-1.5 py-1 font-semibold shadow-none",
                breadcrumbs.length === 0
                  ? "text-fox hover:bg-transparent hover:text-fox"
                  : "text-ink-muted hover:bg-foreground/5 hover:text-ink",
                dropTarget?.kind === "crumb" &&
                  dropTarget.id === null &&
                  "bg-fox/12 text-fox outline outline-dashed outline-fox/50 hover:bg-fox/12 hover:text-fox",
              )}
              data-fox-drop="root"
              data-fox-drop-kind="crumb"
              onClick={goToRoot}
              title="Drop here to move to All"
            >
              All
            </Button>
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="inline-flex items-center gap-0.5">
                <IconChevronRight
                  className="shrink-0 text-ink-muted opacity-55"
                  size={14}
                  stroke={1.75}
                  aria-hidden
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto rounded-xs px-1.5 py-1 font-semibold shadow-none",
                    index === breadcrumbs.length - 1
                      ? "text-fox hover:bg-transparent hover:text-fox"
                      : "text-ink-muted hover:bg-foreground/5 hover:text-ink",
                    dropTarget?.kind === "crumb" &&
                      dropTarget.id === crumb.id &&
                      "bg-fox/12 text-fox outline outline-dashed outline-fox/50 hover:bg-fox/12 hover:text-fox",
                  )}
                  data-fox-drop={crumb.id}
                  data-fox-drop-kind="crumb"
                  onClick={() => goToGroup(crumb.id)}
                  title={`Drop here to move into “${crumb.name}”`}
                >
                  {crumb.name}
                </Button>
              </span>
            ))}
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label
              className="flex h-10 min-w-[min(100%,16rem)] flex-1 items-center gap-2 rounded-sm border border-line bg-[var(--field-bg)] px-2.5 focus-within:border-fox/45 focus-within:ring-[3px] focus-within:ring-[var(--ring)]"
              htmlFor="inventory-search"
            >
              <IconSearch
                size={16}
                stroke={1.75}
                aria-hidden
                className="shrink-0 text-ink-muted"
              />
              <Input
                id="inventory-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="Search groups and hosts…"
                autoComplete="off"
                className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
              {searchQuery ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-7 shrink-0 text-ink-muted"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                >
                  <IconX size={14} stroke={2} aria-hidden />
                </Button>
              ) : null}
            </label>

            <div className="inline-flex items-center gap-0.5 rounded-sm border border-line bg-surface p-0.5" role="group" aria-label="Sort and layout">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2.5"
                onClick={toggleSortDir}
                title={
                  sortDir === "asc"
                    ? "Sorted A–Z. Click for Z–A"
                    : "Sorted Z–A. Click for A–Z"
                }
                aria-label={
                  sortDir === "asc" ? "Sort A to Z" : "Sort Z to A"
                }
              >
                {sortDir === "asc" ? (
                  <IconSortAscendingLetters size={16} stroke={1.75} aria-hidden />
                ) : (
                  <IconSortDescendingLetters size={16} stroke={1.75} aria-hidden />
                )}
                <span>{sortDir === "asc" ? "A–Z" : "Z–A"}</span>
              </Button>
              <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={
                  layout === "list"
                    ? "size-8 bg-fox/12 text-fox"
                    : "size-8"
                }
                aria-pressed={layout === "list"}
                title="List view"
                aria-label="List view"
                onClick={() => setInventoryLayout("list")}
              >
                <IconLayoutList size={16} stroke={1.75} aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={
                  layout === "grid"
                    ? "size-8 bg-fox/12 text-fox"
                    : "size-8"
                }
                aria-pressed={layout === "grid"}
                title="Grid view"
                aria-label="Grid view"
                onClick={() => setInventoryLayout("grid")}
              >
                <IconLayoutGrid size={16} stroke={1.75} aria-hidden />
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-auto [scrollbar-width:thin]",
              !hasAnyChildren || !hasVisibleItems
                ? "flex flex-col"
                : layout === "grid"
                  ? "grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2 content-start"
                  : "flex flex-col gap-1",
              draggingId && "select-none"
            )}
            role="list"
          >
            {!hasAnyChildren ? (
              <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-fox/10 text-fox" aria-hidden>
                  <IconFolders size={24} stroke={1.5} />
                </span>
                <p className="m-0 text-base font-bold text-ink">No connections yet</p>
                <p>Add a new group or host to get started.</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    className="h-[var(--control-h)]"
                    onClick={() => setCreateGroupOpen(true)}
                  >
                    <IconFolderPlus {...iconProps} aria-hidden />
                    <span>New group</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-[var(--control-h)] bg-surface backdrop-blur-[var(--blur-sm)]"
                    onClick={() => setCreateHostOpen(true)}
                  >
                    <IconServerSpark {...iconProps} aria-hidden />
                    <span>New host</span>
                  </Button>
                </div>
              </div>
            ) : !hasVisibleItems ? (
              <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-fox/10 text-fox" aria-hidden>
                  <IconSearch size={24} stroke={1.5} />
                </span>
                <p className="m-0 text-base font-bold text-ink">No matches</p>
                <p>Try a different search for “{searchQuery.trim()}”.</p>
              </div>
            ) : null}

            {groups.map((group) => {
              const location = searchActive
                ? relativeLocationLabel(items, group, currentGroupId)
                : null;
              const isDragging = draggingId === group.id;
              const isDropTarget =
                dropTarget?.kind === "group" && dropTarget.id === group.id;
              return (
              <div
                key={group.id}
                className={cn(
                  "flex cursor-pointer items-stretch gap-0.5 rounded-md border border-line bg-surface shadow-(--shadow-sm) backdrop-blur-[var(--blur-sm)]",
                  layout === "grid" && "flex-col",
                  isDragging && "opacity-45",
                  isDropTarget && "border-fox/50 bg-fox/8 outline outline-dashed outline-fox/40"
                )}
                role="listitem"
                data-fox-drop={group.id}
                data-fox-drop-kind="group"
                title="Double-click to open group"
                onDoubleClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-fox-card-action]")) {
                    return;
                  }
                  openGroup(group.id);
                }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 cursor-grab text-ink-muted active:cursor-grabbing"
                  title="Drag to move"
                  aria-label={`Drag ${group.name} to move`}
                  tabIndex={-1}
                  data-fox-card-action=""
                  onPointerDown={(e) => beginPointerDrag(e, group.id)}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <IconGripVertical {...actionIcon} aria-hidden />
                </Button>
                <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1 py-2 text-left text-ink">
                  <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-leaf/12 text-[var(--leaf)]" aria-hidden>
                    <IconFolder {...typeIcon} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[0.68rem] font-bold tracking-wide text-ink-muted uppercase">Group</span>
                    <span className="truncate text-[0.9rem] font-bold text-ink">{group.name}</span>
                    {location ? (
                      <span className="truncate text-[0.75rem] text-ink-muted">{location}</span>
                    ) : null}
                  </span>
                </div>
                <div
                  className="flex shrink-0 items-center gap-0.5"
                  data-fox-card-action=""
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8"
                    aria-label={`Rename ${group.name}`}
                    title="Rename"
                    onClick={() => setRenameGroupTarget(group)}
                  >
                    <IconPencil {...actionIcon} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${group.name}`}
                    title="Delete"
                    onClick={() => setDeleteTarget(group)}
                  >
                    <IconTrash {...actionIcon} aria-hidden />
                  </Button>
                </div>
              </div>
              );
            })}

            {hosts.map((host) => {
              const location = searchActive
                ? relativeLocationLabel(items, host, currentGroupId)
                : null;
              const meta = location
                ? `${location} · ${hostSummary(host)}`
                : hostSummary(host);
              const isDragging = draggingId === host.id;
              return (
              <div
                key={host.id}
                className={cn(
                  "flex cursor-pointer items-stretch gap-0.5 rounded-md border border-line bg-surface shadow-(--shadow-sm) backdrop-blur-[var(--blur-sm)]",
                  layout === "grid" && "flex-col",
                  isDragging && "opacity-45"
                )}
                role="listitem"
                title="Double-click to connect"
                onDoubleClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-fox-card-action]")) {
                    return;
                  }
                  connectToHost(host);
                }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 cursor-grab text-ink-muted active:cursor-grabbing"
                  title="Drag to move"
                  aria-label={`Drag ${host.name} to move`}
                  tabIndex={-1}
                  data-fox-card-action=""
                  onPointerDown={(e) => beginPointerDrag(e, host.id)}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <IconGripVertical {...actionIcon} aria-hidden />
                </Button>
                <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1 py-2 text-left text-ink">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-sm bg-fox/12 text-fox"
                    aria-hidden
                  >
                    <IconServer {...typeIcon} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[0.68rem] font-bold tracking-wide text-ink-muted uppercase">Host</span>
                    <span className="truncate text-[0.9rem] font-bold text-ink">{host.name}</span>
                    <span className="truncate text-[0.75rem] text-ink-muted">{meta}</span>
                  </span>
                </div>
                <div
                  className="flex shrink-0 items-center gap-0.5"
                  data-fox-card-action=""
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8"
                    aria-label={`Duplicate ${host.name}`}
                    title="Duplicate"
                    onClick={() => openDuplicateHost(host)}
                  >
                    <IconCopy {...actionIcon} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8"
                    aria-label={`Edit ${host.name}`}
                    title="Edit"
                    onClick={() => setEditHostTarget(host)}
                  >
                    <IconPencil {...actionIcon} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${host.name}`}
                    title="Delete"
                    onClick={() => setDeleteTarget(host)}
                  >
                    <IconTrash {...actionIcon} aria-hidden />
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {sftpMounted ? (
        <div
          className={cn(
            "mt-5 flex min-h-0 flex-col",
            view === "sftp" ? "flex-1" : "hidden",
          )}
          hidden={view !== "sftp"}
          aria-hidden={view !== "sftp"}
          inert={view !== "sftp" ? true : undefined}
        >
          <SftpView
            items={items}
            onBlockingDialogChange={setSftpDialogOpen}
          />
        </div>
      ) : null}

      <NameDialog
        open={createGroupOpen}
        title="New group"
        lede={`Inside ${parentLabel}`}
        submitLabel="Create"
        placeholder="e.g. Production"
        emptyError="Enter a group name."
        saveError="Could not create group."
        onClose={() => setCreateGroupOpen(false)}
        onSubmitName={(name) => unwrapSave(createGroup(name), "Could not create group.")}
        icon={<IconFolderPlus size={22} stroke={1.75} aria-hidden />}
        submitIcon={<IconCheck size={16} stroke={1.75} aria-hidden />}
        cancelIcon={<IconX size={16} stroke={1.75} aria-hidden />}
      />

      <NameDialog
        open={renameGroupTarget !== null}
        title="Rename group"
        lede={`Rename “${renameGroupTarget?.name ?? ""}”`}
        submitLabel="Save"
        placeholder="Group name"
        emptyError="Enter a group name."
        saveError="Could not save."
        initialName={renameGroupTarget?.name ?? ""}
        onClose={() => setRenameGroupTarget(null)}
        onSubmitName={(name) =>
          renameGroupTarget
            ? unwrapSave(
                renameGroup(renameGroupTarget.id, name),
                "Could not save.",
              )
            : { ok: false, error: "Could not save." }
        }
        icon={<IconFolder size={22} stroke={1.75} aria-hidden />}
        submitIcon={<IconCheck size={16} stroke={1.75} aria-hidden />}
        cancelIcon={<IconX size={16} stroke={1.75} aria-hidden />}
      />

      <HostDialog
        open={createHostOpen}
        mode="create"
        parentLabel={parentLabel}
        onClose={() => setCreateHostOpen(false)}
        onSubmit={(input) =>
          unwrapSave(createHost(input), "Could not save host.")
        }
      />

      <HostDialog
        open={duplicateHostInput !== null}
        mode="duplicate"
        parentLabel={parentLabel}
        initialValues={duplicateHostInput}
        onClose={() => setDuplicateHostInput(null)}
        onSubmit={(input) =>
          unwrapSave(createHost(input), "Could not duplicate host.")
        }
      />

      <HostDialog
        open={editHostTarget !== null}
        mode="edit"
        parentLabel={parentLabel}
        initialHost={editHostTarget}
        onClose={() => setEditHostTarget(null)}
        onSubmit={(input) =>
          editHostTarget
            ? unwrapSave(
                updateHost(editHostTarget.id, input),
                "Could not save host.",
              )
            : { ok: false, error: "Could not save host." }
        }
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === "host" ? "Delete host" : "Delete group"}
        message={
          deleteTarget?.kind === "host"
            ? `Delete “${deleteTarget.name}”? This cannot be undone.`
            : `Delete “${deleteTarget?.name ?? ""}” and everything inside it? This cannot be undone.`
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "host") deleteHost(deleteTarget.id);
          else deleteGroup(deleteTarget.id);
          setDeleteTarget(null);
        }}
        icon={<IconTrash size={22} stroke={1.75} aria-hidden />}
        confirmIcon={<IconTrash size={16} stroke={1.75} aria-hidden />}
        cancelIcon={<IconX size={16} stroke={1.75} aria-hidden />}
      />

      <SettingsDialog
        open={settingsOpen}
        appTheme={theme}
        terminalPrefs={terminalPrefs}
        inventoryItems={items}
        securityEnabled={securityEnabled}
        securityPrefs={securityPrefs}
        onChangeTerminalPrefs={handleTerminalPrefsChange}
        onSecurityChange={onSecurityChange}
        onVaultKeyChange={onVaultKeyChange}
        onSecurityPrefsChange={onSecurityPrefsChange}
        onClose={() => setSettingsOpen(false)}
      />

      <UpdateAvailableDialog
        open={updatePrompt !== null}
        currentVersion={APP_VERSION}
        latest={updatePrompt}
        onLater={() => setUpdatePrompt(null)}
        onSkip={() => {
          if (updatePrompt) skipVersion(updatePrompt.version);
          setUpdatePrompt(null);
        }}
        onOpenRelease={() => {
          if (!updatePrompt) return;
          void openReleasePage(updatePrompt.htmlUrl).catch(() => {
            toast.error("Could not open the release page.");
          });
        }}
      />
    </main>
  );
}
