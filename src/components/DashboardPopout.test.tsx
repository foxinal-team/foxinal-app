import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Dashboard } from "./Dashboard";
import { REATTACH_EVENT, type ReattachPayload } from "@/lib/popout";
import { DEFAULT_SECURITY_PREFS } from "@/security/prefs";

// Mock TerminalView to isolate JSDOM tests from native terminal bindings
vi.mock("@/components/TerminalView", () => ({
  TerminalView: ({ sessionId }: { sessionId: string }) => (
    <div data-testid={`pane-${sessionId}`}>Terminal Mock: {sessionId}</div>
  ),
}));

describe("Dashboard Detach and Reattach Subsystem", () => {
  let capturedReattachHandler:
    | ((event: { payload: ReattachPayload }) => void)
    | null = null;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    capturedReattachHandler = null;

    vi.mocked(listen).mockImplementation(((event: string, handler: any) => {
      if (event === REATTACH_EVENT) {
        capturedReattachHandler = handler;
      }
      return Promise.resolve(() => {});
    }) as any);
  });

  const defaultProps = {
    vaultKey: null,
    initialItems: [],
    securityEnabled: false,
    securityPrefs: DEFAULT_SECURITY_PREFS,
    onLock: vi.fn(),
    onSecurityChange: vi.fn(),
    onVaultKeyChange: vi.fn(),
    onSecurityPrefsChange: vi.fn(),
    theme: "dark",
    themeLabel: "Dark",
    onCycleTheme: vi.fn(),
  };

  it("allows popping out a session tab into an independent window and re-attaching it", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);

    // 1. Open a local terminal session
    const localBtn = screen.getByRole("button", { name: "Local" });
    await user.click(localBtn);

    // 2. Tab should appear in session bar
    expect(screen.getByRole("tab", { name: /Local/i })).toBeInTheDocument();

    // 3. Detach button should be visible
    const detachBtn = screen.getByTitle("Detach tab to new independent window");
    expect(detachBtn).toBeInTheDocument();

    // 4. Click detach button
    await user.click(detachBtn);

    // Verify invoke was called for open_detached_window
    expect(invoke).toHaveBeenCalledWith("open_detached_window", {
      label: expect.stringMatching(/^popout-/),
      title: expect.stringContaining("Local"),
      url: expect.stringContaining("popout=true"),
    });

    // 5. Verify the tab shows the "Detached" badge
    expect(screen.getByText("Detached")).toBeInTheDocument();

    // 6. Verify the placeholder appears in the main window
    expect(
      screen.getByText("Session Running in Detached Window"),
    ).toBeInTheDocument();

    // 7. Clicking "Bring Window to Front" focuses the popout
    const bringFrontBtn = screen.getByRole("button", {
      name: "Bring Window to Front",
    });
    await user.click(bringFrontBtn);
    expect(invoke).toHaveBeenCalledWith("focus_window", {
      label: expect.stringMatching(/^popout-/),
    });

    // 8. Click "Re-attach to Main Window" button
    const reattachBtn = screen.getByRole("button", {
      name: "Re-attach to Main Window",
    });
    await user.click(reattachBtn);

    // Verify window is re-attached
    expect(screen.queryByText("Detached")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Session Running in Detached Window"),
    ).not.toBeInTheDocument();
  });

  it("handles incoming re-attach event from the popout window", async () => {
    const user = userEvent.setup();
    render(<Dashboard {...defaultProps} />);

    // Open terminal tab and detach
    await user.click(screen.getByRole("button", { name: "Local" }));
    await user.click(screen.getByTitle("Detach tab to new independent window"));

    expect(screen.getByText("Detached")).toBeInTheDocument();
    expect(capturedReattachHandler).toBeTypeOf("function");

    // Simulate event sent from popout window
    const tabElement = screen.getByRole("tab", { name: /Local/i });
    const tabId = tabElement.id.replace("session-tab-", "");

    act(() => {
      capturedReattachHandler!({
        payload: {
          tabId,
        },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("Detached")).not.toBeInTheDocument();
    });
  });
});
