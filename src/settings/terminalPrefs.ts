export type TerminalThemeId =
  | "system"
  | "dark"
  | "light"
  | "fox"
  | "dracula"
  | "nord"
  | "tokyo-night"
  | "catppuccin"
  | "gruvbox"
  | "solarized-dark"
  | "solarized-light"
  | "one-dark"
  | "monokai"
  | "rose-pine";

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

export type TerminalThemeOption = {
  id: TerminalThemeId;
  label: string;
  blurb: string;
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

/** Built-ins first, then popular terminal / zsh-adjacent color schemes. */
export const TERMINAL_THEMES: TerminalThemeOption[] = [
  { id: "system", label: "Match app", blurb: "Follows Foxinal light/dark" },
  { id: "dark", label: "Dark", blurb: "Clean foxinal dark" },
  { id: "light", label: "Light", blurb: "Soft light canvas" },
  { id: "fox", label: "Fox", blurb: "Warm fox-orange night" },
  { id: "dracula", label: "Dracula", blurb: "Purple night classic" },
  { id: "nord", label: "Nord", blurb: "Arctic north-bluish" },
  { id: "tokyo-night", label: "Tokyo Night", blurb: "Downtown neon glow" },
  { id: "catppuccin", label: "Catppuccin", blurb: "Soothing mocha pastels" },
  { id: "gruvbox", label: "Gruvbox", blurb: "Retro warm groove" },
  { id: "solarized-dark", label: "Solarized Dark", blurb: "Precision dark" },
  { id: "solarized-light", label: "Solarized Light", blurb: "Precision light" },
  { id: "one-dark", label: "One Dark", blurb: "Atom’s gray dusk" },
  { id: "monokai", label: "Monokai", blurb: "Sublime classic" },
  { id: "rose-pine", label: "Rosé Pine", blurb: "Soft pine & soho" },
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

export function isTerminalThemeId(value: unknown): value is TerminalThemeId {
  return (
    typeof value === "string" &&
    TERMINAL_THEMES.some((theme) => theme.id === value)
  );
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
    const theme = isTerminalThemeId(parsed.theme)
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

const THEME_DRACULA: XtermTheme = {
  background: "#282a36",
  foreground: "#f8f8f2",
  cursor: "#f8f8f2",
  selectionBackground: "#44475a",
  black: "#21222c",
  red: "#ff5555",
  green: "#50fa7b",
  yellow: "#f1fa8c",
  blue: "#bd93f9",
  magenta: "#ff79c6",
  cyan: "#8be9fd",
  white: "#f8f8f2",
};

const THEME_NORD: XtermTheme = {
  background: "#2e3440",
  foreground: "#d8dee9",
  cursor: "#d8dee9",
  selectionBackground: "#434c5e",
  black: "#3b4252",
  red: "#bf616a",
  green: "#a3be8c",
  yellow: "#ebcb8b",
  blue: "#81a1c1",
  magenta: "#b48ead",
  cyan: "#88c0d0",
  white: "#e5e9f0",
};

const THEME_TOKYO_NIGHT: XtermTheme = {
  background: "#1a1b26",
  foreground: "#c0caf5",
  cursor: "#c0caf5",
  selectionBackground: "#33467c",
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#a9b1d6",
};

const THEME_CATPPUCCIN: XtermTheme = {
  background: "#1e1e2e",
  foreground: "#cdd6f4",
  cursor: "#f5e0dc",
  selectionBackground: "#45475a",
  black: "#45475a",
  red: "#f38ba8",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  blue: "#89b4fa",
  magenta: "#cba6f7",
  cyan: "#94e2d5",
  white: "#bac2de",
};

const THEME_GRUVBOX: XtermTheme = {
  background: "#282828",
  foreground: "#ebdbb2",
  cursor: "#ebdbb2",
  selectionBackground: "#504945",
  black: "#282828",
  red: "#cc241d",
  green: "#98971a",
  yellow: "#d79921",
  blue: "#458588",
  magenta: "#b16286",
  cyan: "#689d6a",
  white: "#a89984",
};

const THEME_SOLARIZED_DARK: XtermTheme = {
  background: "#002b36",
  foreground: "#839496",
  cursor: "#93a1a1",
  selectionBackground: "#073642",
  black: "#073642",
  red: "#dc322f",
  green: "#859900",
  yellow: "#b58900",
  blue: "#268bd2",
  magenta: "#d33682",
  cyan: "#2aa198",
  white: "#eee8d5",
};

const THEME_SOLARIZED_LIGHT: XtermTheme = {
  background: "#fdf6e3",
  foreground: "#657b83",
  cursor: "#586e75",
  selectionBackground: "#eee8d5",
  black: "#073642",
  red: "#dc322f",
  green: "#859900",
  yellow: "#b58900",
  blue: "#268bd2",
  magenta: "#d33682",
  cyan: "#2aa198",
  white: "#eee8d5",
};

const THEME_ONE_DARK: XtermTheme = {
  background: "#282c34",
  foreground: "#abb2bf",
  cursor: "#528bff",
  selectionBackground: "#3e4451",
  black: "#282c34",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#abb2bf",
};

const THEME_MONOKAI: XtermTheme = {
  background: "#272822",
  foreground: "#f8f8f2",
  cursor: "#f8f8f0",
  selectionBackground: "#49483e",
  black: "#272822",
  red: "#f92672",
  green: "#a6e22e",
  yellow: "#f4bf75",
  blue: "#66d9ef",
  magenta: "#ae81ff",
  cyan: "#a1efe4",
  white: "#f8f8f2",
};

const THEME_ROSE_PINE: XtermTheme = {
  background: "#191724",
  foreground: "#e0def4",
  cursor: "#ebbcba",
  selectionBackground: "#26233a",
  black: "#21202e",
  red: "#eb6f92",
  green: "#31748f",
  yellow: "#f6c177",
  blue: "#9ccfd8",
  magenta: "#c4a7e7",
  cyan: "#ebbcba",
  white: "#e0def4",
};

const THEME_BY_ID: Record<Exclude<TerminalThemeId, "system">, XtermTheme> = {
  dark: THEME_DARK,
  light: THEME_LIGHT,
  fox: THEME_FOX,
  dracula: THEME_DRACULA,
  nord: THEME_NORD,
  "tokyo-night": THEME_TOKYO_NIGHT,
  catppuccin: THEME_CATPPUCCIN,
  gruvbox: THEME_GRUVBOX,
  "solarized-dark": THEME_SOLARIZED_DARK,
  "solarized-light": THEME_SOLARIZED_LIGHT,
  "one-dark": THEME_ONE_DARK,
  monokai: THEME_MONOKAI,
  "rose-pine": THEME_ROSE_PINE,
};

export function resolveTerminalTheme(
  themeId: TerminalThemeId,
  appTheme: string,
): XtermTheme {
  if (themeId === "system") {
    return isAppDark(appTheme) ? THEME_DARK : THEME_LIGHT;
  }
  return THEME_BY_ID[themeId];
}

/** ANSI accent chips used in the settings theme picker. */
export function themeAccentColors(theme: XtermTheme): string[] {
  return [
    theme.red,
    theme.green,
    theme.yellow,
    theme.blue,
    theme.magenta,
    theme.cyan,
  ];
}
