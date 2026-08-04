export type TerminalThemeId = "system" | "dark" | "light" | "fox";

export type TerminalPrefs = {
  fontId: string;
  fontSize: number;
  theme: TerminalThemeId;
  /** Kept buffer lines above the viewport. `0` means maximum. */
  scrollback: number;
};

export type TerminalFontOption = {
  id: string;
  label: string;
  value: string;
};

export const TERMINAL_FONTS: TerminalFontOption[] = [
  {
    id: "system",
    label: "System Mono",
    value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  {
    id: "menlo",
    label: "Menlo",
    value: "Menlo, Monaco, 'Courier New', monospace",
  },
  {
    id: "sf-mono",
    label: "SF Mono",
    value: "'SF Mono', ui-monospace, Menlo, monospace",
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    value: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  },
  {
    id: "fira",
    label: "Fira Code",
    value: "'Fira Code', ui-monospace, Menlo, monospace",
  },
  {
    id: "cascadia",
    label: "Cascadia Code",
    value: "'Cascadia Code', 'Segoe UI Mono', Consolas, monospace",
  },
  {
    id: "courier",
    label: "Courier New",
    value: "'Courier New', Courier, monospace",
  },
];

export const TERMINAL_THEMES: Array<{ id: TerminalThemeId; label: string }> = [
  { id: "system", label: "Match app" },
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "fox", label: "Fox" },
];

export const DEFAULT_TERMINAL_PREFS: TerminalPrefs = {
  fontId: "system",
  fontSize: 14,
  theme: "system",
  scrollback: 40_000,
};

export const TERMINAL_PREFS_KEY = "foxinal-terminal-prefs";
export const TERMINAL_FONT_SIZE_MIN = 11;
export const TERMINAL_FONT_SIZE_MAX = 22;
/** Applied when prefs.scrollback is `0` (unlimited in the UI). */
export const TERMINAL_SCROLLBACK_MAX = 1_000_000;
export const TERMINAL_SCROLLBACK_INPUT_MAX = 1_000_000;

export function fontFamilyForId(fontId: string): string {
  return (
    TERMINAL_FONTS.find((font) => font.id === fontId)?.value ??
    TERMINAL_FONTS[0].value
  );
}

/** Map stored preference to the xterm `scrollback` option. */
export function resolveScrollback(lines: number): number {
  if (!Number.isFinite(lines) || lines <= 0) return TERMINAL_SCROLLBACK_MAX;
  return Math.min(TERMINAL_SCROLLBACK_MAX, Math.round(lines));
}

export function normalizeScrollback(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_TERMINAL_PREFS.scrollback;
  }
  const rounded = Math.round(raw);
  if (rounded <= 0) return 0;
  return Math.min(TERMINAL_SCROLLBACK_INPUT_MAX, rounded);
}

export function loadTerminalPrefs(): TerminalPrefs {
  try {
    const raw = localStorage.getItem(TERMINAL_PREFS_KEY);
    if (!raw) return { ...DEFAULT_TERMINAL_PREFS };
    const parsed = JSON.parse(raw) as Partial<TerminalPrefs>;
    const fontId =
      typeof parsed.fontId === "string" &&
      TERMINAL_FONTS.some((font) => font.id === parsed.fontId)
        ? parsed.fontId
        : DEFAULT_TERMINAL_PREFS.fontId;
    const fontSize =
      typeof parsed.fontSize === "number" &&
      Number.isFinite(parsed.fontSize)
        ? Math.min(
            TERMINAL_FONT_SIZE_MAX,
            Math.max(TERMINAL_FONT_SIZE_MIN, Math.round(parsed.fontSize)),
          )
        : DEFAULT_TERMINAL_PREFS.fontSize;
    const theme =
      parsed.theme === "system" ||
      parsed.theme === "dark" ||
      parsed.theme === "light" ||
      parsed.theme === "fox"
        ? parsed.theme
        : DEFAULT_TERMINAL_PREFS.theme;
    const scrollback = normalizeScrollback(parsed.scrollback);
    return { fontId, fontSize, theme, scrollback };
  } catch {
    return { ...DEFAULT_TERMINAL_PREFS };
  }
}

export function saveTerminalPrefs(prefs: TerminalPrefs) {
  try {
    localStorage.setItem(TERMINAL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function isAppDark(appTheme: string): boolean {
  if (appTheme === "dark") return true;
  if (appTheme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export type XtermTheme = {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
};

const THEME_DARK: XtermTheme = {
  background: "#0f0e14",
  foreground: "#fafafa",
  cursor: "#ea580c",
  selectionBackground: "#3f3c4a",
  black: "#0f0e14",
  red: "#ea580c",
  green: "#34d399",
  yellow: "#fbbf24",
  blue: "#818cf8",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#fafafa",
};

const THEME_LIGHT: XtermTheme = {
  background: "#f7f6fa",
  foreground: "#1c1917",
  cursor: "#ea580c",
  selectionBackground: "#e4e2eb",
  black: "#1c1917",
  red: "#ea580c",
  green: "#059669",
  yellow: "#d97706",
  blue: "#4f46e5",
  magenta: "#9333ea",
  cyan: "#0891b2",
  white: "#f7f6fa",
};

const THEME_FOX: XtermTheme = {
  background: "#1a100c",
  foreground: "#fff7ed",
  cursor: "#fb923c",
  selectionBackground: "#431407",
  black: "#1a100c",
  red: "#f97316",
  green: "#86efac",
  yellow: "#fde68a",
  blue: "#fdba74",
  magenta: "#fb7185",
  cyan: "#5eead4",
  white: "#fff7ed",
};

export function resolveTerminalTheme(
  themeId: TerminalThemeId,
  appTheme: string,
): XtermTheme {
  if (themeId === "fox") return THEME_FOX;
  if (themeId === "dark") return THEME_DARK;
  if (themeId === "light") return THEME_LIGHT;
  return isAppDark(appTheme) ? THEME_DARK : THEME_LIGHT;
}
