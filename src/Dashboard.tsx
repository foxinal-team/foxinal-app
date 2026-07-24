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
  IconTrash,
  IconUpload,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { BrandMark } from "./BrandMark";
import {
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppSession } from "./App";
import { ConfirmDeleteDialog } from "./inventory/ConfirmDeleteDialog";
import { HostDialog } from "./inventory/HostDialog";
import { NameDialog } from "./inventory/NameDialog";
import { useInventory, type SaveResult } from "./inventory/useInventory";
import { SettingsDialog } from "./settings/SettingsDialog";
import {
  loadTerminalPrefs,
  saveTerminalPrefs,
  type TerminalPrefs,
} from "./settings/terminalPrefs";
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
} from "./inventory/types";
import {
  buildExportPayload,
  downloadExport,
  exportFilename,
  mergeImportedItems,
  readExportFile,
} from "./inventory/transfer";
import {
  loadInventoryLayout,
  loadInventorySort,
  saveInventoryLayout,
  saveInventorySort,
  type InventoryLayout,
  type InventorySort,
} from "./inventory/viewPrefs";
import {
  createHostTab,
  createLocalTab,
  type SessionTab,
} from "./sessions";
import { TerminalView } from "./TerminalView";
import { ThemeToggle } from "./ThemeToggle";

type DashboardView = "dashboard" | "session";

type DashboardProps = {
  session: AppSession;
  onSignOut: () => void;
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
  session,
  onSignOut,
  theme,
  themeLabel,
  onCycleTheme,
}: DashboardProps) {
  const displayName =
    session.kind === "account" ? session.username : "Local";
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
  const [terminalPrefs, setTerminalPrefs] = useState<TerminalPrefs>(() =>
    loadTerminalPrefs(),
  );
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
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
  } = useInventory();

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

  function clearTransferFeedback() {
    setTransferMessage(null);
    setTransferError(null);
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
    clearTransferFeedback();

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
        setTransferError(result.error);
        return;
      }

      const dest =
        newParentId === null
          ? "All"
          : (itemsRef.current.find((item) => item.id === newParentId)?.name ??
            "group");
      setTransferMessage(
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
    clearTransferFeedback();
    const payload = buildExportPayload(items, currentGroupId);
    if (payload.items.length === 0) {
      setTransferError(
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
    setTransferMessage(
      currentGroup
        ? `Exported ${payload.items.length} item${payload.items.length === 1 ? "" : "s"} from “${currentGroup.name}”.`
        : `Exported ${payload.items.length} item${payload.items.length === 1 ? "" : "s"}.`,
    );
  }

  async function handleImportFile(file: File | undefined) {
    clearTransferFeedback();
    if (!file) return;

    const parsed = await readExportFile(file);
    if (!parsed.ok || !parsed.items) {
      setTransferError(!parsed.ok ? parsed.error : "Invalid export file.");
      return;
    }

    const merged = mergeImportedItems(items, parsed.items, currentGroupId);
    if (!merged.ok || !merged.items) {
      setTransferError(!merged.ok ? merged.error : "Could not import items.");
      return;
    }

    replaceItems(merged.items);
    setTransferMessage(
      currentGroup
        ? `Imported ${merged.count} item${merged.count === 1 ? "" : "s"} into “${currentGroup.name}”.`
        : `Imported ${merged.count} item${merged.count === 1 ? "" : "s"}.`,
    );
  }

  return (
    <main className="dashboard">
      <div className="dashboard__atmosphere" aria-hidden="true" />

      <header className="dashboard__header">
        <div className="dashboard__nav">
          <p className="dashboard__brand">
            <BrandMark className="dashboard__brand-mark" />
            <span>foxinal</span>
          </p>
          <nav className="dashboard__links" aria-label="Primary">
            <button
              type="button"
              className={
                view === "dashboard"
                  ? "dashboard__link dashboard__link--active"
                  : "dashboard__link"
              }
              onClick={() => setView("dashboard")}
            >
              <IconFolders {...iconProps} aria-hidden />
              <span>Connections</span>
            </button>
            <button
              type="button"
              className={
                view === "session" && activeTab?.session.kind === "local"
                  ? "dashboard__link dashboard__link--active"
                  : "dashboard__link"
              }
              onClick={openLocalTerminal}
            >
              <IconTerminal2 {...iconProps} aria-hidden />
              <span>Terminal</span>
            </button>
          </nav>
        </div>

        <div className="dashboard__actions">
          <ThemeToggle
            theme={theme}
            label={themeLabel}
            onCycle={onCycleTheme}
            className="theme-toggle--inline"
          />
          <button
            type="button"
            className="dashboard__icon-btn"
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings {...iconProps} aria-hidden />
          </button>
          <span
            className={
              session.kind === "local"
                ? "dashboard__badge dashboard__badge--local"
                : "dashboard__badge"
            }
            title={
              session.kind === "local"
                ? "Local mode — data stays on this device"
                : `Signed in as ${displayName}`
            }
          >
            {session.kind === "local" ? (
              <IconDeviceDesktop size={16} stroke={1.75} aria-hidden />
            ) : (
              <IconUser size={16} stroke={1.75} aria-hidden />
            )}
            <span>{displayName}</span>
          </span>
          <button type="button" className="dashboard__signout" onClick={onSignOut}>
            <IconLogout {...iconProps} aria-hidden />
            <span>{session.kind === "local" ? "Leave" : "Sign out"}</span>
          </button>
        </div>
      </header>

      {tabs.length > 0 ? (
        <div
          className={
            view === "session"
              ? "session-workspace"
              : "session-workspace session-workspace--parked"
          }
        >
          <div className="session-tabs" role="tablist" aria-label="Open sessions">
            {tabs.map((tab) => {
              const selected = tab.id === activeTab?.id && view === "session";
              return (
                <div
                  key={tab.id}
                  className={
                    selected
                      ? "session-tabs__item session-tabs__item--active"
                      : "session-tabs__item"
                  }
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className="session-tabs__button"
                    title={tab.subtitle}
                    onClick={() => selectTab(tab.id)}
                  >
                    <span className="session-tabs__icon" aria-hidden>
                      {tab.session.kind === "local" ? (
                        <IconTerminal2 size={14} stroke={1.75} />
                      ) : (
                        <IconPlugConnected size={14} stroke={1.75} />
                      )}
                    </span>
                    <span className="session-tabs__label">{tab.title}</span>
                  </button>
                  <button
                    type="button"
                    className="session-tabs__close"
                    aria-label={`Close ${tab.title}`}
                    title="Close tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    <IconX size={12} stroke={2} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="session-panes" aria-hidden={view !== "session"}>
            {tabs.map((tab) => {
              const paneActive = tab.id === activeTab?.id && view === "session";
              return (
                <div
                  key={tab.id}
                  className={
                    paneActive
                      ? "session-pane session-pane--active"
                      : "session-pane"
                  }
                  role="tabpanel"
                  aria-hidden={!paneActive}
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
        <section className="inventory">
          <div className="inventory__top">
            <div className="inventory__intro">
              <h1 className="inventory__headline">
                {currentGroup ? (
                  <>
                    <IconFolder
                      className="inventory__headline-icon"
                      size={26}
                      stroke={1.6}
                      aria-hidden
                    />
                    <span>{currentGroup.name}</span>
                  </>
                ) : (
                  <>
                    <IconFolders
                      className="inventory__headline-icon"
                      size={26}
                      stroke={1.6}
                      aria-hidden
                    />
                    <span>Connections</span>
                  </>
                )}
              </h1>
              <p className="inventory__lede">
                {currentGroup
                  ? "Double-click to open or connect. Use the grip handle to drag onto a group or breadcrumb."
                  : session.kind === "local"
                    ? "Local data on this device. Use the grip to move items · double-click to open or connect."
                    : `Welcome, ${displayName}. Use the grip to move items · double-click to open or connect.`}
              </p>
            </div>

            <div className="inventory__toolbar">
              <div className="inventory__toolbar-group" role="group" aria-label="Transfer">
                <button
                  type="button"
                  className="inventory__btn inventory__btn--ghost"
                  title={
                    currentGroup
                      ? `Import into “${currentGroup.name}”`
                      : "Import into All"
                  }
                  onClick={() => importInputRef.current?.click()}
                >
                  <IconUpload {...iconProps} aria-hidden />
                  <span>Import</span>
                </button>
                <button
                  type="button"
                  className="inventory__btn inventory__btn--ghost"
                  title={
                    currentGroup
                      ? `Export “${currentGroup.name}”`
                      : "Export all connections"
                  }
                  onClick={handleExport}
                >
                  <IconDownload {...iconProps} aria-hidden />
                  <span>Export</span>
                </button>
              </div>
              <div className="inventory__toolbar-group" role="group" aria-label="Create">
                <button
                  type="button"
                  className="inventory__btn inventory__btn--primary"
                  onClick={() => setCreateGroupOpen(true)}
                >
                  <IconFolderPlus {...iconProps} aria-hidden />
                  <span>New group</span>
                </button>
                <button
                  type="button"
                  className="inventory__btn"
                  onClick={() => setCreateHostOpen(true)}
                >
                  <IconServerSpark {...iconProps} aria-hidden />
                  <span>New host</span>
                </button>
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="inventory__file-input"
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

          {transferError ? (
            <p className="inventory__transfer inventory__transfer--error" role="alert">
              {transferError}
            </p>
          ) : null}
          {transferMessage ? (
            <p className="inventory__transfer" role="status">
              {transferMessage}
            </p>
          ) : null}

          <nav className="inventory__crumbs" aria-label="Group path">
            <button
              type="button"
              className={[
                breadcrumbs.length === 0
                  ? "inventory__crumb inventory__crumb--current"
                  : "inventory__crumb",
                dropTarget?.kind === "crumb" && dropTarget.id === null
                  ? "inventory__crumb--drop-target"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-fox-drop="root"
              data-fox-drop-kind="crumb"
              onClick={goToRoot}
              title="Drop here to move to All"
            >
              All
            </button>
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="inventory__crumb-wrap">
                <IconChevronRight
                  className="inventory__crumb-sep"
                  size={14}
                  stroke={1.75}
                  aria-hidden
                />
                <button
                  type="button"
                  className={[
                    index === breadcrumbs.length - 1
                      ? "inventory__crumb inventory__crumb--current"
                      : "inventory__crumb",
                    dropTarget?.kind === "crumb" && dropTarget.id === crumb.id
                      ? "inventory__crumb--drop-target"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-fox-drop={crumb.id}
                  data-fox-drop-kind="crumb"
                  onClick={() => goToGroup(crumb.id)}
                  title={`Drop here to move into “${crumb.name}”`}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>

          <div className="inventory__controls">
            <label className="inventory__search" htmlFor="inventory-search">
              <IconSearch size={16} stroke={1.75} aria-hidden />
              <input
                id="inventory-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="Search groups and hosts…"
                autoComplete="off"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="inventory__search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                >
                  <IconX size={14} stroke={2} aria-hidden />
                </button>
              ) : null}
            </label>

            <div className="inventory__view-bar" role="group" aria-label="Sort and layout">
              <button
                type="button"
                className="inventory__tool inventory__tool--sort"
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
              </button>
              <span className="inventory__view-sep" aria-hidden />
              <button
                type="button"
                className={
                  layout === "list"
                    ? "inventory__tool inventory__tool--active"
                    : "inventory__tool"
                }
                aria-pressed={layout === "list"}
                title="List view"
                aria-label="List view"
                onClick={() => setInventoryLayout("list")}
              >
                <IconLayoutList size={16} stroke={1.75} aria-hidden />
              </button>
              <button
                type="button"
                className={
                  layout === "grid"
                    ? "inventory__tool inventory__tool--active"
                    : "inventory__tool"
                }
                aria-pressed={layout === "grid"}
                title="Grid view"
                aria-label="Grid view"
                onClick={() => setInventoryLayout("grid")}
              >
                <IconLayoutGrid size={16} stroke={1.75} aria-hidden />
              </button>
            </div>
          </div>

          <div
            className={[
              "inventory__list",
              layout === "grid" ? "inventory__list--grid" : "",
              draggingId ? "inventory__list--dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="list"
          >
            {!hasAnyChildren ? (
              <div className="inventory__empty">
                <span className="inventory__empty-icon" aria-hidden>
                  <IconFolders size={24} stroke={1.5} />
                </span>
                <p className="inventory__empty-title">No connections yet</p>
                <p>Add a new group or host to get started.</p>
                <div className="inventory__empty-actions">
                  <button
                    type="button"
                    className="inventory__btn inventory__btn--primary"
                    onClick={() => setCreateGroupOpen(true)}
                  >
                    <IconFolderPlus {...iconProps} aria-hidden />
                    <span>New group</span>
                  </button>
                  <button
                    type="button"
                    className="inventory__btn"
                    onClick={() => setCreateHostOpen(true)}
                  >
                    <IconServerSpark {...iconProps} aria-hidden />
                    <span>New host</span>
                  </button>
                </div>
              </div>
            ) : !hasVisibleItems ? (
              <div className="inventory__empty">
                <span className="inventory__empty-icon" aria-hidden>
                  <IconSearch size={24} stroke={1.5} />
                </span>
                <p className="inventory__empty-title">No matches</p>
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
                className={[
                  "inventory__item inventory__item--group",
                  isDragging ? "inventory__item--dragging" : "",
                  isDropTarget ? "inventory__item--drop-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="listitem"
                data-fox-drop={group.id}
                data-fox-drop-kind="group"
              >
                <button
                  type="button"
                  className="inventory__item-grip"
                  title="Drag to move"
                  aria-label={`Drag ${group.name}`}
                  onPointerDown={(e) => beginPointerDrag(e, group.id)}
                >
                  <IconGripVertical {...actionIcon} aria-hidden />
                </button>
                <button
                  type="button"
                  className="inventory__item-main"
                  title="Double-click to open"
                  onDoubleClick={() => openGroup(group.id)}
                >
                  <span className="inventory__item-icon" aria-hidden>
                    <IconFolder {...typeIcon} />
                  </span>
                  <span className="inventory__item-text">
                    <span className="inventory__item-kind">Group</span>
                    <span className="inventory__item-name">{group.name}</span>
                    {location ? (
                      <span className="inventory__item-meta">{location}</span>
                    ) : null}
                  </span>
                </button>
                <div className="inventory__item-actions">
                  <button
                    type="button"
                    className="inventory__item-action"
                    aria-label={`Rename ${group.name}`}
                    title="Rename"
                    onClick={() => setRenameGroupTarget(group)}
                  >
                    <IconPencil {...actionIcon} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inventory__item-action inventory__item-action--danger"
                    aria-label={`Delete ${group.name}`}
                    title="Delete"
                    onClick={() => setDeleteTarget(group)}
                  >
                    <IconTrash {...actionIcon} aria-hidden />
                  </button>
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
                className={[
                  "inventory__item inventory__item--host",
                  isDragging ? "inventory__item--dragging" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="listitem"
              >
                <button
                  type="button"
                  className="inventory__item-grip"
                  title="Drag to move"
                  aria-label={`Drag ${host.name}`}
                  onPointerDown={(e) => beginPointerDrag(e, host.id)}
                >
                  <IconGripVertical {...actionIcon} aria-hidden />
                </button>
                <button
                  type="button"
                  className="inventory__item-main"
                  title="Double-click to connect"
                  onDoubleClick={() => connectToHost(host)}
                >
                  <span
                    className="inventory__item-icon inventory__item-icon--host"
                    aria-hidden
                  >
                    <IconServer {...typeIcon} />
                  </span>
                  <span className="inventory__item-text">
                    <span className="inventory__item-kind">Host</span>
                    <span className="inventory__item-name">{host.name}</span>
                    <span className="inventory__item-meta">{meta}</span>
                  </span>
                </button>
                <div className="inventory__item-actions">
                  <button
                    type="button"
                    className="inventory__item-action"
                    aria-label={`Duplicate ${host.name}`}
                    title="Duplicate"
                    onClick={() => openDuplicateHost(host)}
                  >
                    <IconCopy {...actionIcon} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inventory__item-action"
                    aria-label={`Edit ${host.name}`}
                    title="Edit"
                    onClick={() => setEditHostTarget(host)}
                  >
                    <IconPencil {...actionIcon} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inventory__item-action inventory__item-action--danger"
                    aria-label={`Delete ${host.name}`}
                    title="Delete"
                    onClick={() => setDeleteTarget(host)}
                  >
                    <IconTrash {...actionIcon} aria-hidden />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </section>
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
        placeholder="e.g. Production"
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
        }}
        icon={<IconTrash size={22} stroke={1.75} aria-hidden />}
        confirmIcon={<IconTrash size={16} stroke={1.75} aria-hidden />}
        cancelIcon={<IconX size={16} stroke={1.75} aria-hidden />}
      />

      <SettingsDialog
        open={settingsOpen}
        session={session}
        appTheme={theme}
        terminalPrefs={terminalPrefs}
        onChangeTerminalPrefs={handleTerminalPrefsChange}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
