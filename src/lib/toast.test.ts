import { describe, expect, it, vi } from "vitest";
import { toast as sonner } from "sonner";
import { toast } from "./toast";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  },
}));

describe("toast helper", () => {
  it("calls sonner.success with string message and description string", () => {
    toast.success("Success!", "Details here");
    expect(sonner.success).toHaveBeenCalledWith("Success!", {
      description: "Details here",
    });
  });

  it("calls sonner.error with options object", () => {
    toast.error("Failed!", { duration: 5000 });
    expect(sonner.error).toHaveBeenCalledWith("Failed!", { duration: 5000 });
  });

  it("handles undefined options gracefully", () => {
    toast.info("Info message");
    expect(sonner.info).toHaveBeenCalledWith("Info message", undefined);
  });

  it("calls warning and message variants", () => {
    toast.warning("Warning text");
    expect(sonner.warning).toHaveBeenCalledWith("Warning text", undefined);

    toast.message("Plain message");
    expect(sonner.message).toHaveBeenCalledWith("Plain message", undefined);
  });
});
