import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TerminalSearchBar } from "./TerminalSearchBar";

describe("TerminalSearchBar component", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <TerminalSearchBar
        isOpen={false}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onFindNext={vi.fn()}
        onFindPrevious={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when isOpen is true and focuses input", () => {
    render(
      <TerminalSearchBar
        isOpen={true}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onFindNext={vi.fn()}
        onFindPrevious={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Find in terminal...");
    expect(input).toBeInTheDocument();
  });

  it("calls onSearch on input typing", async () => {
    const user = userEvent.setup();
    const handleSearch = vi.fn();
    render(
      <TerminalSearchBar
        isOpen={true}
        onClose={vi.fn()}
        onSearch={handleSearch}
        onFindNext={vi.fn()}
        onFindPrevious={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Find in terminal...");
    await user.type(input, "nginx");

    expect(handleSearch).toHaveBeenCalledWith("nginx", {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    });
  });

  it("toggles case, whole-word, and regex options", async () => {
    const user = userEvent.setup();
    const handleSearch = vi.fn();
    render(
      <TerminalSearchBar
        isOpen={true}
        initialQuery="test"
        onClose={vi.fn()}
        onSearch={handleSearch}
        onFindNext={vi.fn()}
        onFindPrevious={vi.fn()}
      />,
    );

    const caseBtn = screen.getByTitle("Match Case");
    await user.click(caseBtn);
    expect(handleSearch).toHaveBeenLastCalledWith("test", {
      caseSensitive: true,
      wholeWord: false,
      regex: false,
    });

    const wordBtn = screen.getByTitle("Match Whole Word");
    await user.click(wordBtn);
    expect(handleSearch).toHaveBeenLastCalledWith("test", {
      caseSensitive: true,
      wholeWord: true,
      regex: false,
    });

    const regexBtn = screen.getByTitle("Use Regular Expression");
    await user.click(regexBtn);
    expect(handleSearch).toHaveBeenLastCalledWith("test", {
      caseSensitive: true,
      wholeWord: true,
      regex: true,
    });
  });

  it("navigates on Enter and Shift+Enter", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(
      <TerminalSearchBar
        isOpen={true}
        initialQuery="error"
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onFindNext={onNext}
        onFindPrevious={onPrev}
      />,
    );

    const input = screen.getByPlaceholderText("Find in terminal...");
    await user.type(input, "{enter}");
    expect(onNext).toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onPrev).toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed or close button clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <TerminalSearchBar
        isOpen={true}
        onClose={onClose}
        onSearch={vi.fn()}
        onFindNext={vi.fn()}
        onFindPrevious={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Find in terminal...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();

    const closeBtn = screen.getByTitle("Close (Escape)");
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("displays match count accurately", () => {
    render(
      <TerminalSearchBar
        isOpen={true}
        initialQuery="query"
        matchCount={{ current: 2, total: 5 }}
        onClose={vi.fn()}
        onSearch={vi.fn()}
        onFindNext={vi.fn()}
        onFindPrevious={vi.fn()}
      />,
    );
    expect(screen.getByText("2/5")).toBeInTheDocument();
  });
});
