import { describe, expect, it } from "vitest";
import {
  IMAGE_EXTENSIONS,
  isImageFileName,
  SFTP_TRANSFER_PROGRESS_EVENT,
  TRANSFER_CANCELLED_MESSAGE,
} from "./types";

describe("sftp types and constants", () => {
  it("exports expected event constants", () => {
    expect(SFTP_TRANSFER_PROGRESS_EVENT).toBe("sftp-transfer-progress");
    expect(TRANSFER_CANCELLED_MESSAGE).toBe("Transfer cancelled.");
  });

  describe("isImageFileName", () => {
    it("recognizes standard image file formats", () => {
      expect(isImageFileName("avatar.png")).toBe(true);
      expect(isImageFileName("photo.JPG")).toBe(true);
      expect(isImageFileName("banner.jpeg")).toBe(true);
      expect(isImageFileName("icon.svg")).toBe(true);
      expect(isImageFileName("clip.webp")).toBe(true);
      expect(isImageFileName("anim.gif")).toBe(true);
      expect(isImageFileName("favicon.ico")).toBe(true);
      expect(isImageFileName("modern.avif")).toBe(true);
    });

    it("rejects non-image files and extension-less paths", () => {
      expect(isImageFileName("document.pdf")).toBe(false);
      expect(isImageFileName("archive.tar.gz")).toBe(false);
      expect(isImageFileName("Makefile")).toBe(false);
      expect(isImageFileName(".bashrc")).toBe(false);
    });

    it("checks completeness of image extensions set", () => {
      expect(IMAGE_EXTENSIONS.size).toBeGreaterThanOrEqual(8);
      expect(IMAGE_EXTENSIONS.has("png")).toBe(true);
    });
  });
});
