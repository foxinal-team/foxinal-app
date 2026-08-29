import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";
import type { XtermTheme } from "@/settings/terminalPrefs";

export function createFoxinalEditorTheme(
  terminalTheme: XtermTheme,
  isDark: boolean,
): Extension[] {
  const baseTheme = EditorView.theme(
    {
      "&": {
        height: "100%",
        backgroundColor: terminalTheme.background,
        color: terminalTheme.foreground,
        fontFamily:
          "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "0.8125rem",
        lineHeight: "1.6",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "inherit",
        scrollbarWidth: "thin",
        backgroundColor: terminalTheme.background,
      },
      ".cm-scroller::-webkit-scrollbar": {
        width: "7px",
        height: "7px",
      },
      ".cm-scroller::-webkit-scrollbar-track": {
        backgroundColor: "transparent",
      },
      ".cm-scroller::-webkit-scrollbar-thumb": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.18)"
          : "rgba(0, 0, 0, 0.18)",
        borderRadius: "4px",
      },
      ".cm-scroller::-webkit-scrollbar-thumb:hover": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.3)"
          : "rgba(0, 0, 0, 0.3)",
      },
      ".cm-content": {
        caretColor: terminalTheme.cursor,
        padding: "8px 0",
        backgroundColor: terminalTheme.background,
      },
      "&.cm-focused .cm-cursor": {
        borderLeftColor: terminalTheme.cursor,
        borderLeftWidth: "2px",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: `${terminalTheme.selectionBackground} !important`,
        },
      // Search / Replace Panels
      ".cm-panels": {
        backgroundColor: terminalTheme.background,
        color: terminalTheme.foreground,
        borderBottom: "1px solid var(--line)",
        zIndex: "10",
      },
      ".cm-panels.cm-panels-top": {
        borderBottom: "1px solid var(--line)",
      },
      ".cm-panels.cm-panels-bottom": {
        borderTop: "1px solid var(--line)",
      },
      ".cm-panel.cm-search": {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "6px",
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.03)"
          : "rgba(0, 0, 0, 0.02)",
        padding: "8px 12px",
        fontSize: "0.75rem",
        color: terminalTheme.foreground,
        fontFamily: "inherit",
      },
      ".cm-search .cm-textfield": {
        backgroundColor: isDark
          ? "rgba(0, 0, 0, 0.35)"
          : "rgba(255, 255, 255, 0.95)",
        color: terminalTheme.foreground,
        border: "1px solid var(--line)",
        borderRadius: "5px",
        padding: "3px 8px",
        fontSize: "0.75rem",
        fontFamily: "inherit",
        outline: "none",
        minWidth: "150px",
        lineHeight: "1.4",
        transition: "border-color 0.15s, box-shadow 0.15s",
      },
      ".cm-search .cm-textfield:focus": {
        borderColor: "var(--fox)",
        boxShadow: "0 0 0 2px rgba(234, 88, 12, 0.25)",
      },
      ".cm-search label, .cm-search .cm-search-label": {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "0.72rem",
        color: isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(0, 0, 0, 0.65)",
        cursor: "pointer",
        userSelect: "none",
        padding: "2px 4px",
        borderRadius: "4px",
      },
      ".cm-search label:hover, .cm-search .cm-search-label:hover": {
        color: terminalTheme.foreground,
      },
      ".cm-search input[type=checkbox]": {
        accentColor: "var(--fox)",
        cursor: "pointer",
        width: "13px",
        height: "13px",
      },
      ".cm-search .cm-button, .cm-search button": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(0, 0, 0, 0.06)",
        backgroundImage: "none",
        color: terminalTheme.foreground,
        border: "1px solid var(--line)",
        borderRadius: "5px",
        padding: "3px 8px",
        fontSize: "0.72rem",
        fontWeight: "600",
        cursor: "pointer",
        fontFamily: "inherit",
        textTransform: "capitalize",
        transition: "all 0.15s ease",
      },
      ".cm-search .cm-button:hover, .cm-search button:hover": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.16)"
          : "rgba(0, 0, 0, 0.12)",
        borderColor: "var(--fox)",
      },
      ".cm-search .cm-button:active, .cm-search button:active": {
        transform: "scale(0.97)",
      },
      ".cm-search button[name=close]": {
        marginLeft: "auto",
        backgroundColor: "transparent",
        border: "none",
        color: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)",
        padding: "2px 6px",
        fontSize: "0.95rem",
        cursor: "pointer",
        borderRadius: "4px",
      },
      ".cm-search button[name=close]:hover": {
        color: terminalTheme.foreground,
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.08)",
      },
      // Search match highlights
      ".cm-searchMatch": {
        backgroundColor: isDark
          ? "rgba(234, 88, 12, 0.32)"
          : "rgba(234, 88, 12, 0.22)",
        outline: "1px solid rgba(234, 88, 12, 0.55)",
        borderRadius: "2px",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "rgba(234, 88, 12, 0.75) !important",
        color: "#ffffff !important",
        outline: "1px solid #ea580c",
      },
      // Gutters & Active Lines
      ".cm-gutters": {
        backgroundColor: terminalTheme.background,
        color: isDark ? "rgba(255, 255, 255, 0.38)" : "rgba(0, 0, 0, 0.38)",
        borderRight: "1px solid var(--line)",
        paddingRight: "8px",
        userSelect: "none",
      },
      ".cm-activeLineGutter": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.07)"
          : "rgba(0, 0, 0, 0.06)",
        color: terminalTheme.cursor,
        fontWeight: "bold",
      },
      ".cm-activeLine": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.04)"
          : "rgba(0, 0, 0, 0.035)",
      },
      ".cm-foldPlaceholder": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.1)"
          : "rgba(0, 0, 0, 0.08)",
        border: `1px solid ${terminalTheme.cursor}`,
        color: terminalTheme.cursor,
        borderRadius: "3px",
        padding: "0 4px",
        margin: "0 2px",
      },
      ".cm-matchingBracket, .cm-nonmatchingBracket": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.15)"
          : "rgba(0, 0, 0, 0.12)",
        outline: `1px solid ${terminalTheme.cursor}`,
        color: "inherit",
      },
    },
    { dark: isDark },
  );

  const highlightStyle = HighlightStyle.define([
    { tag: [t.keyword, t.modifier], color: terminalTheme.red, fontWeight: "600" },
    { tag: [t.name, t.deleted, t.character, t.macroName], color: terminalTheme.red },
    {
      tag: [t.propertyName, t.attributeName],
      color: terminalTheme.blue,
    },
    {
      tag: [t.function(t.variableName), t.labelName],
      color: terminalTheme.blue,
      fontWeight: "500",
    },
    {
      tag: [t.color, t.constant(t.name), t.standard(t.name)],
      color: terminalTheme.yellow,
    },
    {
      tag: [t.definition(t.name), t.separator],
      color: terminalTheme.foreground,
    },
    {
      tag: [
        t.typeName,
        t.className,
        t.number,
        t.changed,
        t.annotation,
        t.self,
        t.namespace,
      ],
      color: terminalTheme.cyan,
    },
    {
      tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link],
      color: terminalTheme.magenta,
    },
    {
      tag: [t.meta, t.comment],
      color: isDark ? "#8b949e" : "#6e7781",
      fontStyle: "italic",
    },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.link, color: terminalTheme.blue, textDecoration: "underline" },
    { tag: t.heading, fontWeight: "bold", color: terminalTheme.red },
    {
      tag: [t.atom, t.bool, t.special(t.variableName)],
      color: terminalTheme.yellow,
      fontWeight: "600",
    },
    {
      tag: [t.processingInstruction, t.string, t.inserted],
      color: terminalTheme.green,
    },
    { tag: t.invalid, color: "var(--error, #ef4444)" },
  ]);

  return [baseTheme, syntaxHighlighting(highlightStyle)];
}
