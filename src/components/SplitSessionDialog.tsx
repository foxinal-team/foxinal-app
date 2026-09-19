import {
  IconCopy,
  IconKey,
  IconLayoutColumns,
  IconLayoutRows,
  IconLock,
  IconPlugConnected,
  IconSearch,
  IconTerminal2,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { DialogIcon } from "@/components/DialogIcon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HostItem } from "@/inventory/types";
import { hostSummary } from "@/inventory/types";
import type { TerminalSession } from "@/lib/sessions";

type SplitSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: "vertical" | "horizontal";
  currentSession: TerminalSession;
  hosts: HostItem[];
  onSelectSession: (session: TerminalSession) => void;
};

export function SplitSessionDialog({
  open,
  onOpenChange,
  direction,
  currentSession,
  hosts,
  onSelectSession,
}: SplitSessionDialogProps) {
  const [search, setSearch] = useState("");

  const isCurrentSsh = currentSession.kind === "ssh";
  const currentHostName = isCurrentSsh
    ? currentSession.host.name || hostSummary(currentSession.host)
    : "Local shell";

  const currentHostTarget = isCurrentSsh
    ? `${currentSession.host.username}@${currentSession.host.address}:${currentSession.host.port}`
    : "Your OS terminal";

  const filteredHosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.address.toLowerCase().includes(q) ||
        h.username.toLowerCase().includes(q),
    );
  }, [hosts, search]);

  const handleSelect = (session: TerminalSession) => {
    onSelectSession(session);
    onOpenChange(false);
    setSearch("");
  };

  const title = direction === "vertical" ? "Split right" : "Split down";
  const lede =
    direction === "vertical"
      ? "Open a session in a side-by-side pane"
      : "Open a session in a stacked pane";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default" className="sm:max-w-[490px]">
        <DialogHeader>
          <DialogIcon>
            {direction === "vertical" ? (
              <IconLayoutColumns size={22} stroke={1.75} aria-hidden />
            ) : (
              <IconLayoutRows size={22} stroke={1.75} aria-hidden />
            )}
          </DialogIcon>
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{lede}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="relative mt-3">
          <IconSearch
            size={15}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved servers..."
            className="pl-9 h-9 text-xs"
            autoFocus
          />
        </div>

        <ScrollArea className="mt-3 max-h-[350px] pr-2">
          <div className="py-1">
            {/* Quick Actions */}
            {!search && (
              <div className="mb-5">
                <span className="block px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Quick Actions
                </span>

                <div className="space-y-2">
                  {/* Clone / Duplicate Action */}
                  <button
                    type="button"
                    onClick={() => handleSelect(currentSession)}
                    className="flex w-full items-center justify-between rounded-lg border border-line/70 bg-surface-elevated/50 p-2.5 text-left transition hover:border-fox/50 hover:bg-fox/5 cursor-pointer shadow-(--shadow-xs)"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-fox/12 text-fox">
                        {isCurrentSsh ? (
                          <IconCopy size={16} />
                        ) : (
                          <IconTerminal2 size={16} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="m-0 text-xs font-semibold text-ink truncate">
                          {isCurrentSsh
                            ? `Duplicate active session (${currentHostName})`
                            : "Duplicate local shell"}
                        </p>
                        <p className="m-0 text-[11px] text-ink-muted truncate">
                          {isCurrentSsh
                            ? `Open a second SSH connection to ${currentHostTarget}`
                            : "Spawn another local OS terminal instance"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded bg-fox/10 px-2 py-0.5 text-[10px] font-medium text-fox">
                      {isCurrentSsh ? "Same Server" : "Clone"}
                    </span>
                  </button>

                  {/* Local Shell Action */}
                  <button
                    type="button"
                    onClick={() => handleSelect({ kind: "local" })}
                    className="flex w-full items-center justify-between rounded-lg border border-line/70 bg-surface-elevated/50 p-2.5 text-left transition hover:border-fox/50 hover:bg-fox/5 cursor-pointer shadow-(--shadow-xs)"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-fox/12 text-fox">
                        <IconTerminal2 size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="m-0 text-xs font-semibold text-ink truncate">
                          Local shell
                        </p>
                        <p className="m-0 text-[11px] text-ink-muted truncate">
                          Spawn a fresh local terminal instance
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded bg-surface-solid px-2 py-0.5 text-[10px] font-mono text-ink-muted border border-line/60">
                      Local OS
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Saved Hosts List */}
            <div>
              <span className="block px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Saved Servers ({filteredHosts.length})
              </span>

              {filteredHosts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line/60 p-5 text-center text-xs text-ink-muted">
                  No servers match your search query.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredHosts.map((host) => (
                    <button
                      key={host.id}
                      type="button"
                      onClick={() => handleSelect({ kind: "ssh", host })}
                      className="group flex w-full items-center justify-between rounded-lg border border-line/50 bg-surface-solid/70 p-2.5 text-left transition hover:border-fox/50 hover:bg-surface-hover cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-hover text-ink-muted group-hover:text-fox group-hover:bg-fox/10 transition-colors">
                          <IconPlugConnected size={15} />
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 text-xs font-semibold text-ink truncate">
                            {host.name || hostSummary(host)}
                          </p>
                          <p className="m-0 text-[11px] text-ink-muted truncate font-mono">
                            {host.username}@{host.address}:{host.port}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        {host.authMethod === "key" ? (
                          <span
                            title="Private key auth"
                            className="text-ink-muted/80"
                          >
                            <IconKey size={13} />
                          </span>
                        ) : (
                          <span
                            title="Password auth"
                            className="text-ink-muted/80"
                          >
                            <IconLock size={13} />
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
