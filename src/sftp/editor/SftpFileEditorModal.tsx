import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { search } from "@codemirror/search";
import { FindReplaceWidget } from "./FindReplaceWidget";
import {
  IconDeviceFloppy,
  IconReload,
  IconX,
  IconAlertTriangle,
  IconCheck,
  IconServer,
  IconDeviceDesktop,
  IconFileAlert,
  IconSearch,
  IconCopy,
  IconFileCode,
  IconTerminal2,
  IconSettings,
  IconBraces,
  IconFileText,
  IconCode,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, modKey } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { FsEntry, PaneConnection } from "../types";
import {
  fsReadTextFile,
  fsWriteTextFile,
  sftpReadTextFile,
  sftpWriteTextFile,
  formatBytes,
} from "../api";
import { useTheme } from "@/hooks/useTheme";
import { loadTerminalPrefs, resolveTerminalTheme } from "@/settings/terminalPrefs";
import {
  SUPPORTED_LANGUAGES,
  SupportedLanguageId,
  detectLanguageByFileName,
  getLanguageExtension,
} from "./languages";
import { createFoxinalEditorTheme } from "./theme";

interface SftpFileEditorModalProps {
  open: boolean;
  entry: FsEntry | null;
  connection: PaneConnection;
  appTheme?: string;
  onClose: () => void;
  onSaved?: () => void;
}

function getFileIcon(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.endsWith(".sh") ||
    lower.endsWith(".bash") ||
    lower.endsWith(".zsh") ||
    lower.startsWith(".bash") ||
    lower.startsWith(".zsh")
  ) {
    return <IconTerminal2 size={15} className="text-emerald-400" />;
  }
  if (
    lower === "dockerfile" ||
    lower.startsWith("dockerfile.") ||
    lower.includes("docker-compose")
  ) {
    return <IconServer size={15} className="text-sky-400" />;
  }
  if (
    lower.startsWith(".env") ||
    lower.endsWith(".ini") ||
    lower.endsWith(".conf") ||
    lower.includes("nginx") ||
    lower.endsWith(".cfg")
  ) {
    return <IconSettings size={15} className="text-amber-400" />;
  }
  if (
    lower.endsWith(".json") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".toml")
  ) {
    return <IconBraces size={15} className="text-amber-300" />;
  }
  if (
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".py") ||
    lower.endsWith(".rs") ||
    lower.endsWith(".sql")
  ) {
    return <IconCode size={15} className="text-cyan-400" />;
  }
  if (lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".log")) {
    return <IconFileText size={15} className="text-indigo-400" />;
  }
  return <IconFileCode size={15} className="text-fox" />;
}

export function SftpFileEditorModal({
  open,
  entry,
  connection,
  appTheme,
  onClose,
  onSaved,
}: SftpFileEditorModalProps) {
  const { theme: currentAppTheme } = useTheme();
  const activeAppTheme = appTheme || currentAppTheme;

  const terminalPrefs = useMemo(() => {
    return loadTerminalPrefs();
  }, [open]);

  const activeTerminalTheme = useMemo(
    () => resolveTerminalTheme(terminalPrefs.theme, activeAppTheme),
    [terminalPrefs.theme, activeAppTheme],
  );

  const isDark = useMemo(() => {
    if (activeAppTheme === "dark") return true;
    if (activeAppTheme === "light") return false;
    return typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true;
  }, [activeAppTheme]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialContent, setInitialContent] = useState("");
  const [content, setContent] = useState("");
  const [isBinary, setIsBinary] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [fileSize, setFileSize] = useState(0);
  const [lineEnding, setLineEnding] = useState<string>("LF");
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedLanguageId>("plaintext");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [copiedPath, setCopiedPath] = useState(false);

  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const isDirty = useMemo(
    () => content !== initialContent,
    [content, initialContent],
  );

  // Load file content when opening
  const loadFile = useCallback(async () => {
    if (!entry) return;
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const result =
        connection.kind === "local"
          ? await fsReadTextFile(entry.path)
          : await sftpReadTextFile(connection.sessionId, entry.path);

      setFileSize(result.size);
      setIsBinary(result.isBinary);
      setIsTruncated(result.truncated);
      setLineEnding(result.lineEnding || "LF");

      if (result.isBinary) {
        setInitialContent("");
        setContent("");
      } else {
        setInitialContent(result.content);
        setContent(result.content);
      }

      setSelectedLanguage(detectLanguageByFileName(entry.name));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Failed to read file.",
      );
    } finally {
      setLoading(false);
    }
  }, [entry, connection]);

  useEffect(() => {
    if (open && entry) {
      void loadFile();
    }
  }, [open, entry, loadFile]);

  // Handle Save
  const handleSave = useCallback(async () => {
    if (!entry || isBinary || isTruncated || saving) return;
    setSaving(true);
    setError(null);

    try {
      if (connection.kind === "local") {
        await fsWriteTextFile(entry.path, content);
      } else {
        await sftpWriteTextFile(connection.sessionId, entry.path, content);
      }
      setInitialContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Failed to save file.",
      );
    } finally {
      setSaving(false);
    }
  }, [entry, isBinary, isTruncated, saving, connection, content, onSaved]);

  // Handle Copy Path
  const handleCopyPath = useCallback(() => {
    if (!entry) return;
    void navigator.clipboard.writeText(entry.path);
    setCopiedPath(true);
    toast.success("File path copied to clipboard.");
    setTimeout(() => setCopiedPath(false), 2000);
  }, [entry]);

  // Trigger search panel
  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  // Keyboard shortcuts: Cmd+S / Ctrl+S to save
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        void handleSave();
      }
    },
    [handleSave],
  );

  // Close attempt handler
  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setConfirmCloseOpen(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        void handleSave();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(true);
      } else if (e.key === "Escape" && !confirmCloseOpen) {
        if (isSearchOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsSearchOpen(false);
        } else {
          e.preventDefault();
          e.stopPropagation();
          handleRequestClose();
        }
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", onGlobalKeyDown, true);
  }, [open, handleSave, isSearchOpen, confirmCloseOpen, handleRequestClose]);

  // Compute language extension
  const languageExtension = useMemo(
    () => getLanguageExtension(selectedLanguage),
    [selectedLanguage],
  );

  // Editor extensions
  const editorExtensions = useMemo(() => {
    const themeExt = createFoxinalEditorTheme(activeTerminalTheme, isDark);
    return [...themeExt, ...languageExtension, search({ top: true })];
  }, [activeTerminalTheme, isDark, languageExtension]);

  // Statistics
  const totalLines = useMemo(() => {
    return content ? content.split("\n").length : 0;
  }, [content]);

  const totalChars = useMemo(() => content.length, [content]);

  if (!open || !entry) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8 lg:p-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sftp-editor-title"
        onKeyDown={handleKeyDown}
      >
        <div className="flex h-[80vh] max-h-[820px] min-h-[460px] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-line/90 bg-surface-solid shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Bar */}
          <header className="flex shrink-0 flex-col border-b border-line bg-surface/90">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-line/40">
              {/* Left: Active File Tab & Host Chip */}
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-line/80 px-2.5 py-1 shadow-xs transition-colors",
                    isDirty && "border-fox/40",
                  )}
                  style={{ backgroundColor: activeTerminalTheme.background }}
                >
                  <span className="grid place-items-center">
                    {getFileIcon(entry.name)}
                  </span>
                  <span
                    id="sftp-editor-title"
                    className="max-w-[180px] sm:max-w-[280px] truncate text-[0.8rem] font-bold text-ink"
                    title={entry.name}
                  >
                    {entry.name}
                  </span>
                  {isDirty ? (
                    <span
                      className="size-2 shrink-0 rounded-full bg-fox ring-3 ring-fox/20"
                      title="Unsaved changes"
                    />
                  ) : saveSuccess ? (
                    <IconCheck
                      size={13}
                      className="text-success animate-in fade-in"
                      stroke={2.5}
                    />
                  ) : null}
                </div>

                {/* Host badge */}
                <div className="hidden sm:flex items-center gap-1 rounded-md border border-line/60 bg-surface px-2 py-1 text-[0.7rem] text-ink-muted">
                  {connection.kind === "local" ? (
                    <IconDeviceDesktop size={12} className="text-fox" stroke={1.75} />
                  ) : (
                    <IconServer size={12} className="text-fox" stroke={1.75} />
                  )}
                  <span className="font-semibold text-ink">
                    {connection.kind === "local" ? "Local" : connection.hostName}
                  </span>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex shrink-0 items-center gap-1.5">
                {/* Search */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[0.75rem] text-ink-muted hover:text-ink hover:bg-foreground/8"
                  onClick={handleOpenSearch}
                  title={`Find & Replace (${modKey}F)`}
                  disabled={loading || isBinary}
                >
                  <IconSearch size={14} stroke={1.75} />
                  <span className="hidden md:inline font-medium">Find</span>
                  <kbd className="hidden md:inline text-[0.62rem] opacity-75 font-mono">
                    {modKey}F
                  </kbd>
                </Button>

                {/* Reload */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[0.75rem] text-ink-muted hover:text-ink hover:bg-foreground/8"
                  onClick={() => void loadFile()}
                  title="Reload from disk / server"
                  disabled={loading || saving}
                >
                  <IconReload
                    size={14}
                    stroke={1.75}
                    className={loading ? "animate-spin" : ""}
                  />
                  <span className="hidden md:inline font-medium">Reload</span>
                </Button>

                {/* Syntax Dropdown */}
                <div className="w-28 sm:w-32">
                  <Select
                    value={selectedLanguage}
                    onValueChange={(val) =>
                      setSelectedLanguage(val as SupportedLanguageId)
                    }
                    disabled={loading || isBinary}
                  >
                    <SelectTrigger className="h-7 text-[0.72rem] bg-surface-solid border-line shadow-xs">
                      <SelectValue placeholder="Syntax" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 text-xs" position="popper" sideOffset={4}>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.id} value={lang.id} className="text-xs">
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="h-4 w-px bg-line/80 mx-0.5" />

                {/* Save Button */}
                <Button
                  type="button"
                  size="sm"
                  className={cn(
                    "h-7 gap-1.5 px-3 text-[0.75rem] font-bold text-white shadow-xs transition-all",
                    isDirty
                      ? "bg-fox hover:bg-fox-deep shadow-fox/25 hover:shadow-fox/40"
                      : "bg-surface border border-line text-ink-muted hover:text-ink hover:bg-foreground/5",
                  )}
                  onClick={() => void handleSave()}
                  disabled={loading || saving || isBinary || isTruncated || !isDirty}
                  title={`Save changes (${modKey}S)`}
                >
                  {saving ? (
                    <Spinner size={12} className="text-white" />
                  ) : (
                    <IconDeviceFloppy size={13} stroke={2} />
                  )}
                  <span>Save</span>
                  <kbd className="hidden sm:inline text-[0.62rem] opacity-75 font-mono">
                    {modKey}S
                  </kbd>
                </Button>

                {/* Close Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-7 rounded-md text-ink-muted hover:bg-foreground/10 hover:text-ink transition-colors"
                  onClick={handleRequestClose}
                  title="Close (Esc)"
                >
                  <IconX size={16} stroke={2} />
                </Button>
              </div>
            </div>

            {/* Path Breadcrumb Ribbon */}
            <div className="flex items-center justify-between gap-2 px-3.5 py-1 text-[0.68rem] text-ink-muted font-mono bg-surface-solid/30">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="text-ink-muted/60">Path:</span>
                <span className="truncate max-w-lg text-ink select-all" title={entry.path}>
                  {entry.path}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-4 text-ink-muted hover:text-ink"
                  onClick={handleCopyPath}
                  title="Copy full path"
                >
                  {copiedPath ? (
                    <IconCheck size={10} className="text-success" stroke={2.5} />
                  ) : (
                    <IconCopy size={10} stroke={1.75} />
                  )}
                </Button>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span>{formatBytes(fileSize)}</span>
                <span>·</span>
                <span className="uppercase">{lineEnding}</span>
              </div>
            </div>
          </header>

          {/* Banner for errors or truncated files */}
          {error && (
            <div className="flex items-center gap-2 border-b border-error/30 bg-error/10 px-3.5 py-1.5 text-xs font-semibold text-error">
              <IconAlertTriangle size={15} stroke={2} className="shrink-0" />
              <span className="flex-1 truncate">{error}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-4.5 text-error hover:bg-error/20"
                onClick={() => setError(null)}
              >
                <IconX size={13} stroke={2} />
              </Button>
            </div>
          )}

          {isTruncated && (
            <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-500">
              <IconAlertTriangle size={15} stroke={2} className="shrink-0" />
              <span>
                Large file safeguard: Loaded first 5 MB. Editing and saving is disabled.
              </span>
            </div>
          )}

          {/* Main Code Editor View */}
          <div
            className="relative min-h-0 flex-1 overflow-hidden transition-colors duration-150"
            style={{ backgroundColor: activeTerminalTheme.background }}
          >
            {/* VS Code styled Find & Replace floating widget */}
            <FindReplaceWidget
              view={editorRef.current?.view ?? null}
              isOpen={isSearchOpen}
              onClose={() => setIsSearchOpen(false)}
            />

            {loading ? (
              <div className="grid h-full place-items-center">
                <div className="flex flex-col items-center gap-2 text-ink-muted">
                  <Spinner size={24} className="text-fox" />
                  <span className="text-xs font-medium">Reading file contents…</span>
                </div>
              </div>
            ) : isBinary ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-line bg-surface p-6 shadow-sm">
                  <span className="grid size-12 place-items-center rounded-xl bg-fox/15 text-fox">
                    <IconFileAlert size={26} stroke={1.75} />
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-ink">Binary File Detected</h3>
                    <p className="text-xs leading-relaxed text-ink-muted">
                      This file contains binary or non-UTF-8 characters. Editing binary files as plain text is disabled to prevent corruption.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 text-xs font-semibold"
                    onClick={onClose}
                  >
                    Close Editor
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="h-full overflow-hidden"
                style={{ backgroundColor: activeTerminalTheme.background }}
              >
                <CodeMirror
                  ref={editorRef}
                  value={content}
                  height="100%"
                  extensions={editorExtensions}
                  onChange={(val) => setContent(val)}
                  onUpdate={(viewUpdate) => {
                    const pos = viewUpdate.state.selection.main.head;
                    const line = viewUpdate.state.doc.lineAt(pos);
                    setCursorPos({
                      line: line.number,
                      col: pos - line.from + 1,
                    });
                  }}
                  editable={!isTruncated}
                  basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightSpecialChars: true,
                    history: true,
                    foldGutter: true,
                    drawSelection: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    syntaxHighlighting: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    rectangularSelection: true,
                    crosshairCursor: true,
                    highlightActiveLine: true,
                    highlightSelectionMatches: true,
                    closeBracketsKeymap: true,
                    searchKeymap: true,
                    foldKeymap: true,
                    completionKeymap: true,
                    lintKeymap: true,
                  }}
                  className="h-full font-mono text-[0.8125rem]"
                />
              </div>
            )}
          </div>

          {/* Bottom Status Ribbon */}
          <footer className="flex shrink-0 items-center justify-between border-t border-line bg-surface px-3.5 py-1 font-mono text-[0.7rem] text-ink-muted">
            <div className="flex items-center gap-2.5">
              <span>
                Ln <strong className="text-ink font-semibold">{cursorPos.line}</strong>, Col{" "}
                <strong className="text-ink font-semibold">{cursorPos.col}</strong>
              </span>
              <span>·</span>
              <span>
                {totalLines.toLocaleString()} {totalLines === 1 ? "line" : "lines"}
              </span>
              <span>·</span>
              <span>{totalChars.toLocaleString()} chars</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="capitalize">{selectedLanguage}</span>
              <span>·</span>
              <span className="uppercase">{lineEnding}</span>
              <span>·</span>
              <span>UTF-8</span>
              <span>·</span>
              {isDirty ? (
                <span className="inline-flex items-center gap-1 text-fox font-semibold">
                  <span className="size-1.5 rounded-full bg-fox animate-ping" />
                  Unsaved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-success font-medium">
                  <IconCheck size={11} stroke={2.5} />
                  Saved
                </span>
              )}
            </div>
          </footer>
        </div>
      </div>

      {/* Confirm Discard Dialog */}
      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ink">
              <IconAlertTriangle size={20} className="text-amber-500" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="text-ink-muted">
              You have unsaved changes in <strong className="text-ink">{entry.name}</strong>. If you close now, your edits will be discarded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmCloseOpen(false)}
            >
              Keep Editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmCloseOpen(false);
                onClose();
              }}
            >
              Discard Changes
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-fox text-white hover:bg-fox-deep"
              onClick={async () => {
                await handleSave();
                setConfirmCloseOpen(false);
                onClose();
              }}
            >
              Save & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
