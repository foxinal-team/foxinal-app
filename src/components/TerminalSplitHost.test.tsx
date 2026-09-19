import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TerminalSplitHost } from "./TerminalSplitHost";
import { createLeaf, type SessionTab } from "@/lib/sessions";
import { DEFAULT_TERMINAL_PREFS } from "@/settings/terminalPrefs";

// Mock TerminalView to isolate split tree behavior
vi.mock("@/components/TerminalView", () => ({
  TerminalView: ({
    sessionId,
    onSplitVertical,
    onSplitHorizontal,
    onCloseSession,
    onToggleMaximize,
  }: {
    sessionId: string;
    onSplitVertical: () => void;
    onSplitHorizontal: () => void;
    onCloseSession: () => void;
    onToggleMaximize?: () => void;
  }) => (
    <div data-testid={`pane-${sessionId}`}>
      <span>{sessionId}</span>
      <button onClick={onSplitVertical}>Split V</button>
      <button onClick={onSplitHorizontal}>Split H</button>
      <button onClick={onCloseSession}>Close Pane</button>
      {onToggleMaximize && <button onClick={onToggleMaximize}>Maximize</button>}
    </div>
  ),
}));

describe("TerminalSplitHost component", () => {
  const leaf1 = createLeaf({ kind: "local" });
  const leaf2 = createLeaf({ kind: "local" });

  const mockTab: SessionTab = {
    id: "tab-1",
    session: leaf1.session,
    title: "Terminal Tab",
    subtitle: "Local shell",
    layout: leaf1,
    activePaneId: leaf1.id,
  };

  it("renders a single leaf layout", () => {
    render(
      <TerminalSplitHost
        tab={mockTab}
        active={true}
        onCloseTab={vi.fn()}
        onSplitPane={vi.fn()}
        onClosePane={vi.fn()}
        onSetActivePane={vi.fn()}
        onUpdateRatio={vi.fn()}
        terminalPrefs={DEFAULT_TERMINAL_PREFS}
        appTheme="dark"
      />,
    );

    expect(screen.getByTestId(`pane-${leaf1.id}`)).toBeInTheDocument();
    expect(screen.getByText(leaf1.id)).toBeInTheDocument();
  });

  it("renders a split layout with two children and divider", () => {
    const splitTab: SessionTab = {
      ...mockTab,
      layout: {
        type: "split",
        id: "split-root",
        direction: "vertical",
        ratio: 50,
        children: [leaf1, leaf2],
      },
    };

    render(
      <TerminalSplitHost
        tab={splitTab}
        active={true}
        onCloseTab={vi.fn()}
        onSplitPane={vi.fn()}
        onClosePane={vi.fn()}
        onSetActivePane={vi.fn()}
        onUpdateRatio={vi.fn()}
        terminalPrefs={DEFAULT_TERMINAL_PREFS}
        appTheme="dark"
      />,
    );

    expect(screen.getByTestId(`pane-${leaf1.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`pane-${leaf2.id}`)).toBeInTheDocument();
  });

  it("opens split session dialog when onSplit is triggered", async () => {
    const user = userEvent.setup();
    render(
      <TerminalSplitHost
        tab={mockTab}
        active={true}
        onCloseTab={vi.fn()}
        onSplitPane={vi.fn()}
        onClosePane={vi.fn()}
        onSetActivePane={vi.fn()}
        onUpdateRatio={vi.fn()}
        terminalPrefs={DEFAULT_TERMINAL_PREFS}
        appTheme="dark"
      />,
    );

    const splitBtn = screen.getByText("Split V");
    await user.click(splitBtn);

    // Dialog title should show up
    expect(screen.getByText("Split right")).toBeInTheDocument();
  });
});
