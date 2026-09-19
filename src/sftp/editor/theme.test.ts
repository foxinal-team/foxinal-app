import { describe, expect, it } from "vitest";
import { createFoxinalEditorTheme } from "./theme";
import { resolveTerminalTheme } from "@/settings/terminalPrefs";

describe("editor theme creator", () => {
  it("creates editor theme extensions from terminal theme", () => {
    const theme = resolveTerminalTheme("dracula", "dark");
    const extensions = createFoxinalEditorTheme(theme, true);
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBe(2);
  });

  it("handles light theme mode", () => {
    const theme = resolveTerminalTheme("solarized-light", "light");
    const extensions = createFoxinalEditorTheme(theme, false);
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBe(2);
  });
});
