import {
  IconChevronRight,
  IconDeviceDesktop,
  IconFolder,
  IconSearch,
  IconServer,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "@/inventory/types";
import { cn } from "@/lib/utils";

type SftpHostPickerProps = {
  id?: string;
  items: InventoryItem[];
  connecting: boolean;
  onSelectLocal: () => void;
  onSelectHost: (host: HostItem) => void;
  onClose: () => void;
};

const iconSm = { size: 16, stroke: 1.75 } as const;

const itemClass =
  "h-auto w-full justify-start gap-1.5 rounded-xs px-2 py-1.5 text-left text-ink shadow-none hover:bg-foreground/6 disabled:opacity-55";

const crumbClass =
  "h-auto max-w-28 overflow-hidden rounded-xs px-1.5 py-0.5 text-[0.72rem] font-semibold text-ellipsis whitespace-nowrap text-ink-muted shadow-none hover:bg-foreground/6 hover:text-ink";

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
      const source = root.closest("[data-sftp-source]");
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
      className="absolute top-[calc(100%+0.3rem)] left-0 z-5 flex max-h-[min(24rem,70vh)] w-[min(100%,20.5rem)] flex-col gap-0.5 overflow-hidden rounded-sm border border-line bg-surface-solid p-1.5 shadow-(--panel-shadow)"
      role="dialog"
      aria-label="Choose connection source"
    >
      <Button
        type="button"
        variant="ghost"
        className={itemClass}
        onClick={() => {
          onSelectLocal();
          onClose();
        }}
      >
        <IconDeviceDesktop {...iconSm} aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <strong className="truncate text-[0.8rem] font-bold">Local files</strong>
          <em className="truncate text-[0.7rem] not-italic text-ink-muted">
            This computer
          </em>
        </span>
      </Button>

      <p className="mx-1.5 mt-1.5 mb-0.5 text-[0.68rem] font-bold tracking-wider text-ink-muted uppercase">
        Connections
      </p>

      <label
        className="mx-0.5 mb-1.5 flex items-center gap-1.5 rounded-xs border border-line bg-foreground/[0.03] px-1.5 py-1 focus-within:border-fox/45"
        htmlFor="sftp-host-search"
      >
        <IconSearch size={14} stroke={1.75} aria-hidden className="text-ink-muted" />
        <Input
          ref={searchRef}
          id="sftp-host-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          placeholder="Search groups and hosts…"
          autoComplete="off"
          className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[0.78rem] shadow-none focus-visible:ring-0"
        />
        {searchQuery ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-5 text-ink-muted"
            aria-label="Clear search"
            onClick={() => setSearchQuery("")}
          >
            <IconX size={14} stroke={1.75} aria-hidden />
          </Button>
        ) : null}
      </label>

      <nav
        className="mx-0.5 mb-1.5 flex min-w-0 flex-wrap items-center gap-0.5"
        aria-label="Group path"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            crumbClass,
            breadcrumbs.length === 0 && "text-ink",
          )}
          onClick={() => setFolderId(null)}
        >
          All
        </Button>
        {breadcrumbs.map((crumb, index) => (
          <span
            key={crumb.id}
            className="inline-flex min-w-0 items-center gap-0.5 text-ink-muted"
          >
            <IconChevronRight size={12} stroke={1.75} aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                crumbClass,
                index === breadcrumbs.length - 1 && "text-ink",
              )}
              onClick={() => setFolderId(crumb.id)}
            >
              {crumb.name}
            </Button>
          </span>
        ))}
      </nav>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5">
          {!hasAnyInScope ? (
            <p className="mx-1.5 my-1 text-[0.78rem] text-ink-muted">
              No connections yet.
            </p>
          ) : !hasVisible ? (
            <p className="mx-1.5 my-1 text-[0.78rem] text-ink-muted">
              No matches for “{searchQuery.trim()}”.
            </p>
          ) : (
            <>
              {groups.map((group) => {
                const location = searchActive
                  ? relativeLocationLabel(items, group, folderId)
                  : null;
                return (
                  <Button
                    key={group.id}
                    type="button"
                    variant="ghost"
                    className={cn(itemClass, "group/item")}
                    title="Open group"
                    aria-label={`Open group ${group.name}`}
                    onClick={() => {
                      setFolderId(group.id);
                      setSearchQuery("");
                    }}
                  >
                    <IconFolder {...iconSm} aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <strong className="truncate text-[0.8rem] font-bold">
                        {group.name}
                      </strong>
                      <em className="truncate text-[0.7rem] not-italic text-ink-muted">
                        {location ? location : "Group · open to browse"}
                      </em>
                    </span>
                    <IconChevronRight
                      className="shrink-0 text-ink-muted group-hover/item:text-fox"
                      size={14}
                      stroke={1.75}
                      aria-hidden
                    />
                  </Button>
                );
              })}
              {hosts.map((host) => {
                const location = searchActive
                  ? relativeLocationLabel(items, host, folderId)
                  : null;
                return (
                  <Button
                    key={host.id}
                    type="button"
                    variant="ghost"
                    className={itemClass}
                    disabled={connecting}
                    onClick={() => {
                      onSelectHost(host);
                      onClose();
                    }}
                  >
                    <IconServer {...iconSm} aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <strong className="truncate text-[0.8rem] font-bold">
                        {host.name}
                      </strong>
                      <em className="truncate text-[0.7rem] not-italic text-ink-muted">
                        {hostSummary(host)}
                        {location ? ` · ${location}` : ""}
                      </em>
                    </span>
                  </Button>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
