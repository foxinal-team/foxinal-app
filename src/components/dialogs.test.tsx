import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDeleteDialog } from "@/inventory/ConfirmDeleteDialog";
import { NameDialog } from "@/inventory/NameDialog";
import { UpdateAvailableDialog } from "./UpdateAvailableDialog";
import { Atmosphere } from "./Atmosphere";
import { ConnectionOverlay } from "./ConnectionOverlay";

describe("dialogs and overlays", () => {
  describe("ConfirmDeleteDialog", () => {
    it("renders title, message, and triggers confirm/cancel", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <ConfirmDeleteDialog
          open={true}
          title="Delete Server"
          message="Are you sure you want to delete this host?"
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      expect(screen.getByText("Delete Server")).toBeInTheDocument();
      expect(screen.getByText("Are you sure you want to delete this host?")).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelBtn);
      expect(onClose).toHaveBeenCalled();

      const deleteBtn = screen.getByRole("button", { name: "Delete" });
      await user.click(deleteBtn);
      expect(onConfirm).toHaveBeenCalled();
    });

    it("renders busy state with deleting label and disabled buttons", () => {
      render(
        <ConfirmDeleteDialog
          open={true}
          title="Delete Server"
          message="Deleting..."
          busy={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      );
      expect(screen.getByText("Deleting…")).toBeInTheDocument();
    });
  });

  describe("NameDialog", () => {
    it("renders name input and submits valid value", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockReturnValue({ ok: true });
      const onClose = vi.fn();

      render(
        <NameDialog
          open={true}
          title="New Group"
          lede="Create a folder"
          submitLabel="Create"
          onClose={onClose}
          onSubmitName={onSubmit}
        />,
      );

      const input = screen.getByPlaceholderText("Name");
      await user.type(input, "Production Servers");

      const submitBtn = screen.getByRole("button", { name: "Create" });
      await user.click(submitBtn);

      expect(onSubmit).toHaveBeenCalledWith("Production Servers");
    });

    it("shows error when empty name submitted", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(
        <NameDialog
          open={true}
          title="New Group"
          lede="Create a folder"
          submitLabel="Create"
          onClose={vi.fn()}
          onSubmitName={onSubmit}
        />,
      );

      const submitBtn = screen.getByRole("button", { name: "Create" });
      await user.click(submitBtn);
      const input = screen.getByPlaceholderText("Name");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("UpdateAvailableDialog", () => {
    it("renders version badge and release options", async () => {
      const user = userEvent.setup();
      const onOpen = vi.fn();
      const onLater = vi.fn();
      const onSkip = vi.fn();

      render(
        <UpdateAvailableDialog
          open={true}
          currentVersion="1.3.0"
          latest={{
            version: "1.4.0",
            tagName: "v1.4.0",
            htmlUrl: "https://github.com",
            name: "Foxinal 1.4.0",
          }}
          onOpenRelease={onOpen}
          onLater={onLater}
          onSkip={onSkip}
        />,
      );

      expect(screen.getByText("v1.3.0")).toBeInTheDocument();
      expect(screen.getByText("v1.4.0")).toBeInTheDocument();

      const openBtn = screen.getByRole("button", { name: /Open release page/i });
      await user.click(openBtn);
      expect(onOpen).toHaveBeenCalled();

      const laterBtn = screen.getByRole("button", { name: "Later" });
      await user.click(laterBtn);
      expect(onLater).toHaveBeenCalled();

      const skipBtn = screen.getByRole("button", { name: "Skip this version" });
      await user.click(skipBtn);
      expect(onSkip).toHaveBeenCalled();
    });
  });

  describe("Atmosphere", () => {
    it("renders atmosphere background elements", () => {
      const { container } = render(<Atmosphere variant="fixed" className="test-atm" />);
      expect(container.firstChild).toHaveClass("test-atm");
    });
  });

  describe("ConnectionOverlay", () => {
    it("renders connecting variant with spinner", () => {
      render(
        <ConnectionOverlay
          variant="connecting"
          title="Connecting to Server"
          hostLabel="prod.example.com"
        />,
      );

      expect(screen.getByText("Connecting to Server")).toBeInTheDocument();
      expect(screen.getByText("prod.example.com")).toBeInTheDocument();
    });

    it("renders error variant with logs and trust host button", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const onDismiss = vi.fn();
      const onTrustHost = vi.fn();

      render(
        <ConnectionOverlay
          variant="error"
          title="Connection Failed"
          message="Host key mismatch detected"
          logs="Host key verification failed for 1.2.3.4"
          onRetry={onRetry}
          onDismiss={onDismiss}
          onTrustHost={onTrustHost}
        />,
      );

      expect(screen.getByText("Connection Failed")).toBeInTheDocument();

      const trustBtn = screen.getByRole("button", { name: "Trust host & retry" });
      await user.click(trustBtn);
      expect(onTrustHost).toHaveBeenCalled();

      const viewLogsBtn = screen.getByRole("button", { name: "Show logs" });
      await user.click(viewLogsBtn);
      expect(screen.getByText("Connection logs")).toBeInTheDocument();
      expect(screen.getByText(/Host key verification failed/)).toBeInTheDocument();
    });
  });
});
