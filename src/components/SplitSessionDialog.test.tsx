import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SplitSessionDialog } from "./SplitSessionDialog";
import type { HostItem } from "@/inventory/types";

const mockHosts: HostItem[] = [
  {
    id: "h-staging",
    kind: "host",
    name: "Staging API",
    address: "staging.example.com",
    port: 22,
    username: "dev",
    authMethod: "password",
    password: "",
    privateKey: "",
    parentId: null,
    createdAt: 1000,
  },
];

describe("SplitSessionDialog component", () => {
  it("renders when open is true", () => {
    render(
      <SplitSessionDialog
        open={true}
        onOpenChange={vi.fn()}
        direction="vertical"
        currentSession={{ kind: "local" }}
        hosts={mockHosts}
        onSelectSession={vi.fn()}
      />,
    );

    expect(screen.getByText("Split right")).toBeInTheDocument();
    expect(screen.getByText("Duplicate local shell")).toBeInTheDocument();
    expect(screen.getByText("Staging API")).toBeInTheDocument();
  });

  it("filters saved servers on search input", async () => {
    const user = userEvent.setup();
    render(
      <SplitSessionDialog
        open={true}
        onOpenChange={vi.fn()}
        direction="horizontal"
        currentSession={{ kind: "local" }}
        hosts={mockHosts}
        onSelectSession={vi.fn()}
      />,
    );

    expect(screen.getByText("Split down")).toBeInTheDocument();
    const searchInput = screen.getByPlaceholderText("Search saved servers...");
    await user.type(searchInput, "non-matching-server");

    expect(screen.queryByText("Staging API")).not.toBeInTheDocument();
  });

  it("triggers onSelectSession when clicking duplicate action", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <SplitSessionDialog
        open={true}
        onOpenChange={handleOpenChange}
        direction="vertical"
        currentSession={{ kind: "local" }}
        hosts={mockHosts}
        onSelectSession={handleSelect}
      />,
    );

    const dupBtn = screen.getByText("Duplicate local shell");
    await user.click(dupBtn);

    expect(handleSelect).toHaveBeenCalledWith({ kind: "local" });
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("triggers onSelectSession when clicking a saved server", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <SplitSessionDialog
        open={true}
        onOpenChange={handleOpenChange}
        direction="vertical"
        currentSession={{ kind: "local" }}
        hosts={mockHosts}
        onSelectSession={handleSelect}
      />,
    );

    const hostBtn = screen.getByText("Staging API");
    await user.click(hostBtn);

    expect(handleSelect).toHaveBeenCalledWith({
      kind: "ssh",
      host: mockHosts[0],
    });
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
