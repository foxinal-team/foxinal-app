import {
  IconChevronRight,
  IconDeviceDesktop,
  IconFolder,
  IconSearch,
  IconServer,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  breadcrumbPath,
  childrenOf,
  hostSummary,
  isDescendantOf,
  matchesInventorySearch,
  relativeLocationLabel,
  type GroupItem,
  type HostItem,
  type InventoryItem,
} from "../inventory/types";

type SftpHostPickerProps = {
  id?: string;
  items: InventoryItem[];
  connecting: boolean;
  onSelectLocal: () => void;
  onSelectHost: (host: HostItem) => void;
  onClose: () => void;
};

const iconSm = { size: 16, stroke: 1.75 } as const;

export function SftpHostPicker({
  id,
  items,
  connecting,
  onSelectLocal,
  onSelectHost,
  onClose,
}: SftpHostPickerProps) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const root = rootRef.current;
      if (!root || !(e.target instanceof Node)) return;
      const source = root.closest(".sftp-pane__source");
      if (source?.contains(e.target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onDocPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDocPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const searchActive = searchQuery.trim().length > 0;
  const breadcrumbs = useMemo(
    () => breadcrumbPath(items, folderId).filter((c): c is GroupItem => c.kind === "group"),
    [items, folderId],
  );

  const { groups, hosts } = useMemo(() => {
    const dir = 1;
    const byName = (a: InventoryItem, b: InventoryItem) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) * dir;

    const pool = searchActive
      ? items.filter((item) => isDescendantOf(items, item, folderId))
      : childrenOf(items, folderId);

    return {
      groups: pool
        .filter((item): item is GroupItem => item.kind === "group")
        .filter((item) => matchesInventorySearch(item, searchQuery))
        .sort(byName),
      hosts: pool
        .filter((item): item is HostItem => item.kind === "host")
        .filter((item) => matchesInventorySearch(item, searchQuery))
        .sort(byName),
    };
  }, [items, folderId, searchActive, searchQuery]);

  const hasVisible = groups.length > 0 || hosts.length > 0;
  const hasAnyInScope = searchActive
    ? items.some((item) => isDescendantOf(items, item, folderId))
    : childrenOf(items, folderId).length > 0;

  return (
    <div
      id={id}
      ref={rootRef}
      className="sftp-pane__picker"
      role="dialog"
      aria-label="Choose connection source"
    >
      <button
        type="button"
        className="sftp-pane__picker-item"
        onClick={() => {
          onSelectLocal();
          onClose();
        }}
      >
        <IconDeviceDesktop {...iconSm} aria-hidden />
        <span>
          <strong>Local files</strong>
          <em>This computer</em>
        </span>
      </button>

      <p className="sftp-pane__picker-label">Connections</p>

      <label className="sftp-pane__picker-search" htmlFor="sftp-host-search">
        <IconSearch size={14} stroke={1.75} aria-hidden />
        <input
          ref={searchRef}
          id="sftp-host-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          placeholder="Search groups and hosts…"
          autoComplete="off"
        />
        {searchQuery ? (
          <button
            type="button"
            className="sftp-pane__picker-search-clear"
            aria-label="Clear search"
            onClick={() => setSearchQuery("")}
          >
            <IconX size={14} stroke={1.75} aria-hidden />
          </button>
        ) : null}
      </label>

      <nav className="sftp-pane__picker-crumbs" aria-label="Group path">
        <button
          type="button"
          className={
            breadcrumbs.length === 0
              ? "sftp-pane__picker-crumb sftp-pane__picker-crumb--current"
              : "sftp-pane__picker-crumb"
          }
          onClick={() => setFolderId(null)}
        >
          All
        </button>
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.id} className="sftp-pane__picker-crumb-wrap">
            <IconChevronRight size={12} stroke={1.75} aria-hidden />
            <button
              type="button"
              className={
                index === breadcrumbs.length - 1
                  ? "sftp-pane__picker-crumb sftp-pane__picker-crumb--current"
                  : "sftp-pane__picker-crumb"
              }
              onClick={() => setFolderId(crumb.id)}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="sftp-pane__picker-list">
        {!hasAnyInScope ? (
          <p className="sftp-pane__picker-empty">No connections yet.</p>
        ) : !hasVisible ? (
          <p className="sftp-pane__picker-empty">
            No matches for “{searchQuery.trim()}”.
          </p>
        ) : (
          <>
            {groups.map((group) => {
              const location = searchActive
                ? relativeLocationLabel(items, group, folderId)
                : null;
              return (
                <button
                  key={group.id}
                  type="button"
                  className="sftp-pane__picker-item sftp-pane__picker-item--group"
                  title="Open group"
                  aria-label={`Open group ${group.name}`}
                  onClick={() => {
                    setFolderId(group.id);
                    setSearchQuery("");
                  }}
                >
                  <IconFolder {...iconSm} aria-hidden />
                  <span>
                    <strong>{group.name}</strong>
                    <em>{location ? location : "Group · open to browse"}</em>
                  </span>
                  <IconChevronRight
                    className="sftp-pane__picker-chevron"
                    size={14}
                    stroke={1.75}
                    aria-hidden
                  />
                </button>
              );
            })}
            {hosts.map((host) => {
              const location = searchActive
                ? relativeLocationLabel(items, host, folderId)
                : null;
              return (
                <button
                  key={host.id}
                  type="button"
                  className="sftp-pane__picker-item"
                  disabled={connecting}
                  onClick={() => {
                    onSelectHost(host);
                    onClose();
                  }}
                >
                  <IconServer {...iconSm} aria-hidden />
                  <span>
                    <strong>{host.name}</strong>
                    <em>
                      {hostSummary(host)}
                      {location ? ` · ${location}` : ""}
                    </em>
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
