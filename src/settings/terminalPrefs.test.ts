import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TERMINAL_PREFS,
  fontFamilyForId,
  isTerminalThemeId,
  loadTerminalPrefs,
  normalizeScrollback,
  resolveScrollback,
  resolveTerminalTheme,
  saveTerminalPrefs,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_FONTS,
  TERMINAL_SCROLLBACK_MAX,
  TERMINAL_THEMES,
  themeAccentColors,
  type TerminalPrefs,
} from "./terminalPrefs";

describe("terminal preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("font and theme catalogs", () => {
    it("exports fonts and themes arrays", () => {
      expect(TERMINAL_FONTS.length).toBeGreaterThan(0);
      expect(TERMINAL_THEMES.length).toBeGreaterThan(0);
    });

    it("resolves font family by ID with fallback", () => {
      expect(fontFamilyForId("system")).toContain("monospace");
      expect(fontFamilyForId("unknown-font-id")).toBe(TERMINAL_FONTS[0].value);
    });

    it("validates terminal theme ID", () => {
      expect(isTerminalThemeId("dracula")).toBe(true);
      expect(isTerminalThemeId("catppuccin")).toBe(true);
      expect(isTerminalThemeId("non-existent-theme")).toBe(false);
    });
  });

  describe("scrollback helpers", () => {
    it("resolves scrollback limits", () => {
      expect(resolveScrollback(0)).toBe(TERMINAL_SCROLLBACK_MAX);
      expect(resolveScrollback(-100)).toBe(TERMINAL_SCROLLBACK_MAX);
      expect(resolveScrollback(5000)).toBe(5000);
      expect(resolveScrollback(2_000_000)).toBe(TERMINAL_SCROLLBACK_MAX);
    });

    it("normalizes scrollback inputs", () => {
      expect(normalizeScrollback(undefined)).toBe(DEFAULT_TERMINAL_PREFS.scrollback);
      expect(normalizeScrollback(-5)).toBe(0);
      expect(normalizeScrollback(1000.4)).toBe(1000);
    });
  });

  describe("loadTerminalPrefs & saveTerminalPrefs", () => {
    it("returns default preferences on clean storage", () => {
      expect(loadTerminalPrefs()).toEqual(DEFAULT_TERMINAL_PREFS);
    });

    it("saves and loads custom preferences clamping font size", () => {
      const prefs: TerminalPrefs = {
        fontId: "jetbrains",
        fontSize: 16,
        theme: "nord",
        scrollback: 50_000,
      };
      saveTerminalPrefs(prefs);
      expect(loadTerminalPrefs()).toEqual(prefs);

      // Test font size clamping
      saveTerminalPrefs({ ...prefs, fontSize: 999 });
      expect(loadTerminalPrefs().fontSize).toBe(TERMINAL_FONT_SIZE_MAX);

      saveTerminalPrefs({ ...prefs, fontSize: 2 });
      expect(loadTerminalPrefs().fontSize).toBe(TERMINAL_FONT_SIZE_MIN);
    });
  });

  describe("resolveTerminalTheme & themeAccentColors", () => {
    it("resolves dark and light system themes based on appTheme", () => {
      const darkTheme = resolveTerminalTheme("system", "dark");
      expect(darkTheme.background).toBeDefined();

      const lightTheme = resolveTerminalTheme("system", "light");
      expect(lightTheme.background).not.toBe(darkTheme.background);
    });

    it("resolves named theme like dracula", () => {
      const dracula = resolveTerminalTheme("dracula", "dark");
      expect(dracula).toBeDefined();
      expect(dracula.cursor).toBeDefined();
    });

    it("extracts 6 ANSI accent colors", () => {
      const dracula = resolveTerminalTheme("dracula", "dark");
      const accents = themeAccentColors(dracula);
      expect(accents.length).toBe(6);
      expect(accents).toContain(dracula.red);
      expect(accents).toContain(dracula.cyan);
    });
  });
});
