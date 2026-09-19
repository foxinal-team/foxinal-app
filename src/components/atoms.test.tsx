import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrandMark } from "./BrandMark";
import { DialogIcon } from "./DialogIcon";
import { ThemeToggle } from "./ThemeToggle";

describe("atomic components", () => {
  describe("BrandMark", () => {
    it("renders image with alt title", () => {
      render(<BrandMark title="Foxinal App" className="my-brand" />);
      const img = screen.getByAltText("Foxinal App");
      expect(img).toBeInTheDocument();
      expect(img).toHaveClass("my-brand");
      expect(img).toHaveAttribute("src", "/foxinal-icon.png");
    });
  });

  describe("DialogIcon", () => {
    it("renders children with fox tone by default", () => {
      const { container } = render(
        <DialogIcon>
          <span>icon</span>
        </DialogIcon>,
      );
      expect(container.firstChild).toHaveClass("text-fox");
      expect(screen.getByText("icon")).toBeInTheDocument();
    });

    it("renders with danger tone", () => {
      const { container } = render(
        <DialogIcon tone="danger">
          <span>alert</span>
        </DialogIcon>,
      );
      expect(container.firstChild).toHaveClass("text-destructive");
    });
  });

  describe("ThemeToggle", () => {
    it("cycles theme on button click", async () => {
      const user = userEvent.setup();
      const onCycle = vi.fn();
      render(<ThemeToggle theme="dark" onCycle={onCycle} />);

      const btn = screen.getByRole("button", { name: "Theme: dark" });
      expect(btn).toBeInTheDocument();
      await user.click(btn);
      expect(onCycle).toHaveBeenCalledTimes(1);
    });

    it("renders system and light icons accurately", () => {
      const { rerender } = render(<ThemeToggle theme="system" onCycle={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Theme: system" })).toBeInTheDocument();

      rerender(<ThemeToggle theme="light" onCycle={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Theme: light" })).toBeInTheDocument();
    });
  });
});
