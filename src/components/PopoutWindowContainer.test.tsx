import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emit } from "@tauri-apps/api/event";
import { PopoutWindowContainer } from "./PopoutWindowContainer";
import { savePopoutTabData } from "@/lib/popout";
import { createHostTab, createLocalTab } from "@/lib/sessions";
import type { HostItem } from "@/inventory/types";

// Mock TerminalView to isolate popout container behavior in JSDOM
vi.mock("@/components/TerminalView", () => ({
  TerminalView: ({
    sessionId,
    onSplitVertical,
    onSplitHorizontal,
    onCloseSession,
  }: {
    sessionId: string;
    onSplitVertical: () => void;
    onSplitHorizontal: () => void;
    onCloseSession: () => void;
  }) => (
    <div data-testid={`pane-${sessionId}`}>
      <span>Terminal Mock: {sessionId}</span>
      <button onClick={onSplitVertical}>Split V</button>
      <button onClick={onSplitHorizontal}>Split H</button>
      <button onClick={onCloseSession}>Close Pane</button>
    </div>
  ),
}));

const mockHost: HostItem = {
  id: "host-1",
  kind: "host",
  name: "DB Primary",
  address: "10.0.0.1",
  port: 22,
  username: "postgres",
  authMethod: "password",
  password: "",
  privateKey: "",
  parentId: null,
  createdAt: 1000,
};

describe("PopoutWindowContainer component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders fallback message when tab data is not in storage", () => {
    render(<PopoutWindowContainer tabId="missing-id" />);
    expect(screen.getByText("Session data not found or has been closed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Window" })).toBeInTheDocument();
  });

  it("renders detached header bar and terminal host when tab data exists", () => {
    const tab = createHostTab(mockHost);
    savePopoutTabData(tab.id, tab);

    render(<PopoutWindowContainer tabId={tab.id} />);

    expect(screen.getByText("DB Primary")).toBeInTheDocument();
    expect(screen.getByText("postgres@10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("Detached Window")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach Back" })).toBeInTheDocument();
  });

  it("emits reattach event and closes window on clicking Attach Back", async () => {
    const user = userEvent.setup();
    const tab = createLocalTab();
    savePopoutTabData(tab.id, tab);

    render(<PopoutWindowContainer tabId={tab.id} />);

    const attachBtn = screen.getByRole("button", { name: "Attach Back" });
    await user.click(attachBtn);

    expect(emit).toHaveBeenCalledWith("foxinal:reattach-session", expect.objectContaining({
      tabId: tab.id,
      tab: expect.objectContaining({ id: tab.id }),
    }));
  });

  it("handles splitting pane in detached window", async () => {
    const user = userEvent.setup();
    const tab = createLocalTab();
    savePopoutTabData(tab.id, tab);

    render(<PopoutWindowContainer tabId={tab.id} />);

    const splitHorizBtn = screen.getByTitle("Split Horizontal (Stacked)");
    await user.click(splitHorizBtn);

    const splitVertBtn = screen.getByTitle("Split Vertical (Side-by-side)");
    await user.click(splitVertBtn);
  });
});
