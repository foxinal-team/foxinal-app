import {
  IconDeviceDesktop,
  IconDownload,
  IconFolderPlus,
  IconFolderShare,
  IconFolders,
  IconLogout,
  IconMoon,
  IconPlugConnected,
  IconSearch,
  IconServer,
  IconServerSpark,
  IconSettings,
  IconSun,
  IconTerminal2,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { HostItem, InventoryItem } from "@/inventory/types";
import { hostSummary } from "@/inventory/types";
import type { SessionTab } from "@/lib/sessions";
import { cn } from "@/lib/utils";

type PaletteCategory = "Sessions" | "Hosts" | "Navigation" | "Actions" | "Appearance";

type PaletteItem = {
  id: string;
  category: PaletteCategory;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  badge?: string;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  tabs: SessionTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onConnectHost: (host: HostItem) => void;
  onOpenLocalTerminal: () => void;
  onOpenView: (view: "dashboard" | "sftp") => void;
  onOpenNewHost: () => void;
  onOpenNewGroup: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  onLock?: () => void;
  securityEnabled: boolean;
  theme: string;
  onCycleTheme: () => void;
};

const itemIconProps = { size: 16, stroke: 1.75 } as const;

export function CommandPalette({
  open,
  onOpenChange,
  items,
  tabs,
  activeTabId,
  onSelectTab,
  onConnectHost,
  onOpenLocalTerminal,
  onOpenView,
  onOpenNewHost,
  onOpenNewGroup,
  onOpenImport,
  onOpenExport,
  onOpenSettings,
  onLock,
  securityEnabled,
  theme,
  onCycleTheme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Extract all hosts from inventory items recursively
  const allHosts = useMemo(() => {
    return items.filter((item): item is HostItem => item.kind === "host");
  }, [items]);

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];

    // 1. Active Sessions
    if (tabs.length > 0) {
      for (const tab of tabs) {
        const isActive = tab.id === activeTabId;
        list.push({
          id: `tab-${tab.id}`,
          category: "Sessions",
          title: tab.title,
          subtitle: tab.subtitle || (tab.session.kind === "local" ? "Local shell" : "SSH Session"),
          icon:
            tab.session.kind === "local" ? (
              <IconTerminal2 {...itemIconProps} className="text-fox" />
            ) : (
              <IconPlugConnected {...itemIconProps} className="text-fox" />
            ),
          badge: isActive ? "Active" : undefined,
          keywords: ["tab", "session", tab.title, tab.subtitle],
          onSelect: () => onSelectTab(tab.id),
        });
      }
    }

    // 2. Navigation Actions
    list.push({
      id: "nav-connections",
      category: "Navigation",
      title: "Go to Connections",
      subtitle: "Dashboard & host groups",
      icon: <IconFolders {...itemIconProps} className="text-fox" />,
      keywords: ["dashboard", "hosts", "connections", "groups"],
      onSelect: () => onOpenView("dashboard"),
    });

    list.push({
      id: "nav-sftp",
      category: "Navigation",
      title: "Go to SFTP Explorer",
      subtitle: "Dual-pane remote file manager",
      icon: <IconFolderShare {...itemIconProps} className="text-fox" />,
      keywords: ["sftp", "files", "transfer", "explorer", "upload", "download"],
      onSelect: () => onOpenView("sftp"),
    });

    list.push({
      id: "nav-local-term",
      category: "Navigation",
      title: "Open Local Terminal",
      subtitle: "New local shell session",
      icon: <IconTerminal2 {...itemIconProps} className="text-fox" />,
      keywords: ["local", "shell", "bash", "zsh", "terminal", "pty"],
      onSelect: onOpenLocalTerminal,
    });

    list.push({
      id: "nav-settings",
      category: "Navigation",
      title: "Open Settings",
      subtitle: "Preferences, appearance & terminal options",
      icon: <IconSettings {...itemIconProps} className="text-ink-muted" />,
      shortcut: "⌘,",
      keywords: ["settings", "preferences", "config", "theme", "font", "security"],
      onSelect: onOpenSettings,
    });

    // 3. Hosts (Direct Connect)
    for (const host of allHosts) {
      list.push({
        id: `host-${host.id}`,
        category: "Hosts",
        title: host.name || hostSummary(host),
        subtitle: hostSummary(host),
        icon: <IconServer {...itemIconProps} className="text-fox" />,
        keywords: [
          host.name,
          host.address,
          host.username,
          String(host.port),
          "ssh",
          "connect",
        ],
        onSelect: () => onConnectHost(host),
      });
    }

    // 4. Inventory Actions
    list.push({
      id: "action-new-host",
      category: "Actions",
      title: "New Host",
      subtitle: "Create a new SSH host connection",
      icon: <IconServerSpark {...itemIconProps} className="text-fox" />,
      keywords: ["add", "new", "create", "host", "ssh", "server"],
      onSelect: onOpenNewHost,
    });

    list.push({
      id: "action-new-group",
      category: "Actions",
      title: "New Group",
      subtitle: "Create a new folder for connections",
      icon: <IconFolderPlus {...itemIconProps} className="text-[var(--leaf)]" />,
      keywords: ["add", "new", "create", "group", "folder"],
      onSelect: onOpenNewGroup,
    });

    list.push({
      id: "action-import",
      category: "Actions",
      title: "Import Connections",
      subtitle: "Import from Foxinal JSON export file",
      icon: <IconUpload {...itemIconProps} className="text-ink-muted" />,
      keywords: ["import", "restore", "json", "load"],
      onSelect: onOpenImport,
    });

    list.push({
      id: "action-export",
      category: "Actions",
      title: "Export Connections",
      subtitle: "Export inventory as backup file",
      icon: <IconDownload {...itemIconProps} className="text-ink-muted" />,
      keywords: ["export", "backup", "save", "json"],
      onSelect: onOpenExport,
    });

    if (securityEnabled && onLock) {
      list.push({
        id: "action-lock",
        category: "Actions",
        title: "Lock Foxinal",
        subtitle: "Encrypt vault and require master password",
        icon: <IconLogout {...itemIconProps} className="text-destructive" />,
        shortcut: "⌘L",
        keywords: ["lock", "encrypt", "logout", "secure", "vault"],
        onSelect: onLock,
      });
    }

    // 5. Appearance
    list.push({
      id: "theme-cycle",
      category: "Appearance",
      title: "Cycle Theme",
      subtitle: `Current theme: ${theme}`,
      icon:
        theme === "dark" ? (
          <IconMoon {...itemIconProps} className="text-fox" />
        ) : theme === "light" ? (
          <IconSun {...itemIconProps} className="text-fox" />
        ) : (
          <IconDeviceDesktop {...itemIconProps} className="text-fox" />
        ),
      keywords: ["theme", "dark", "light", "system", "mode", "color", "appearance"],
      onSelect: onCycleTheme,
    });

    return list;
  }, [
    tabs,
    activeTabId,
    allHosts,
    securityEnabled,
    theme,
    onSelectTab,
    onOpenView,
    onOpenLocalTerminal,
    onOpenSettings,
    onConnectHost,
    onOpenNewHost,
    onOpenNewGroup,
    onOpenImport,
    onOpenExport,
    onLock,
    onCycleTheme,
  ]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return paletteItems;
    return paletteItems.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.subtitle?.toLowerCase().includes(q)) return true;
      if (item.category.toLowerCase().includes(q)) return true;
      if (item.keywords?.some((k) => k?.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [paletteItems, query]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    const groups: Array<{ category: PaletteCategory; items: PaletteItem[] }> = [];
    const categories: PaletteCategory[] = [
      "Sessions",
      "Hosts",
      "Navigation",
      "Actions",
      "Appearance",
    ];

    for (const cat of categories) {
      const itemsInCat = filteredItems.filter((item) => item.category === cat);
      if (itemsInCat.length > 0) {
        groups.push({ category: cat, items: itemsInCat });
      }
    }
    return groups;
  }, [filteredItems]);

  // Reset selection index when query changes or dialog opens
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open]);

  // Focus search input on open
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(
      `[data-palette-index="${selectedIndex}"]`,
    );
    if (selectedEl instanceof HTMLElement) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  function executeItem(item: PaletteItem) {
    onOpenChange(false);
    // Execute after modal dismiss transition
    window.setTimeout(() => {
      item.onSelect();
    }, 30);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredItems.length) % filteredItems.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) executeItem(item);
    }
  }

  let flatIndexCounter = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[18%] max-w-[min(100%-2rem,36rem)] -translate-y-0 gap-0 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--line-strong)] bg-[var(--surface-solid)] p-0 shadow-[var(--panel-shadow)] backdrop-blur-[var(--blur-md)]"
        aria-label="Command Palette"
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Search Bar */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <IconSearch
            size={20}
            stroke={1.75}
            className="shrink-0 text-fox"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, host name, or search…"
            className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-medium text-ink placeholder:text-[var(--placeholder)] focus:outline-none md:text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="grid size-6 place-items-center rounded-full text-ink-muted transition-colors hover:bg-foreground/10 hover:text-ink"
              aria-label="Clear query"
            >
              <IconX size={14} stroke={2} />
            </button>
          ) : (
            <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-ink-muted sm:inline-flex">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[min(65vh,24rem)] overflow-y-auto p-2 [scrollbar-width:thin]"
          role="listbox"
          aria-label="Commands"
        >
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center">
              <span className="grid size-10 place-items-center rounded-full bg-fox/10 text-fox mx-auto mb-2" aria-hidden>
                <IconSearch size={20} stroke={1.75} />
              </span>
              <p className="m-0 text-sm font-semibold text-ink">No matching commands or hosts</p>
              <p className="mt-1 mb-0 text-xs text-ink-muted">
                Try searching for a different host address, tab, or action.
              </p>
            </div>
          ) : (
            groupedItems.map((group) => (
              <div key={group.category} className="mb-2 last:mb-0">
                <div className="px-2.5 py-1 text-[0.68rem] font-bold tracking-wider text-ink-muted uppercase">
                  {group.category}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const currentIndex = flatIndexCounter++;
                    const isSelected = currentIndex === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-palette-index={currentIndex}
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          "group/item flex w-full cursor-pointer items-center justify-between gap-3 rounded-[calc(var(--radius-sm)-0.1rem)] px-2.5 py-2 text-left transition-colors",
                          isSelected
                            ? "bg-fox/12 text-ink"
                            : "text-ink hover:bg-foreground/5",
                        )}
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span
                            className={cn(
                              "grid size-7 shrink-0 place-items-center rounded-sm",
                              isSelected ? "bg-fox/15" : "bg-[var(--field-bg)]",
                            )}
                            aria-hidden
                          >
                            {item.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[0.84rem] font-semibold text-ink">
                              {item.title}
                            </p>
                            {item.subtitle ? (
                              <p className="m-0 truncate text-[0.72rem] text-ink-muted">
                                {item.subtitle}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {item.badge ? (
                            <span className="rounded-full border border-fox/30 bg-fox/10 px-2 py-0.5 text-[0.68rem] font-semibold text-fox">
                              {item.badge}
                            </span>
                          ) : null}
                          {item.shortcut ? (
                            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-ink-muted">
                              {item.shortcut}
                            </kbd>
                          ) : null}
                          {isSelected ? (
                            <span className="text-xs font-semibold text-fox" aria-hidden>
                              ↵
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[0.72rem] text-ink-muted">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 font-mono text-[0.62rem]">↑</kbd>
              <kbd className="rounded border border-line bg-surface px-1 font-mono text-[0.62rem]">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 font-mono text-[0.62rem]">↵</kbd>
              <span>select</span>
            </span>
          </div>
          <span className="text-[0.68rem] font-medium opacity-75">
            Foxinal Quick Palette
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
