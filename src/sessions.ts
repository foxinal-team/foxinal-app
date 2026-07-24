import type { HostItem } from "./inventory/types";
import { hostSummary } from "./inventory/types";

export type TerminalSession =
  | { kind: "local" }
  | { kind: "ssh"; host: HostItem };

export type SessionTab = {
  id: string;
  session: TerminalSession;
  title: string;
  subtitle: string;
};

export function createLocalTab(): SessionTab {
  return {
    id: crypto.randomUUID(),
    session: { kind: "local" },
    title: "Local Terminal",
    subtitle: "Your OS shell",
  };
}

export function createHostTab(host: HostItem): SessionTab {
  return {
    id: crypto.randomUUID(),
    session: { kind: "ssh", host },
    title: host.name || hostSummary(host),
    subtitle: hostSummary(host),
  };
}
