import { useEffect, useRef, useState, useCallback } from "react";
import type { EditorView } from "@codemirror/view";
import {
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
  selectMatches,
} from "@codemirror/search";
import {
  IconChevronRight,
  IconChevronDown,
  IconArrowUp,
  IconArrowDown,
  IconX,
  IconReplace,
  IconRegex,
  IconLetterCase,
  IconSelect,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn, modKey, altKey } from "@/lib/utils";

interface FindReplaceWidgetProps {
  view: EditorView | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FindReplaceWidget({
  view,
  isOpen,
  onClose,
}: FindReplaceWidgetProps) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  const [matchStats, setMatchStats] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Focus Find input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  // Sync SearchQuery with CodeMirror
  const updateSearchQuery = useCallback(() => {
    if (!view) return;

    if (!isOpen || !findText) {
      view.dispatch({
        effects: setSearchQuery.of(
          new SearchQuery({
            search: "",
          }),
        ),
      });
      setMatchStats({ current: 0, total: 0 });
      return;
    }

    try {
      const query = new SearchQuery({
        search: findText,
        caseSensitive: matchCase,
        wholeWord,
        regexp: isRegex,
        replace: replaceText,
      });

      view.dispatch({
        effects: setSearchQuery.of(query),
      });

      // Calculate matches count
      let count = 0;
      let currentIndex = 0;
      const selectionHead = view.state.selection.main.head;
      const cursor = query.getCursor(view.state);

      let nextResult = cursor.next();
      while (!nextResult.done) {
        count++;
        const match = nextResult.value;
        if (match && selectionHead >= match.from && selectionHead <= match.to) {
          currentIndex = count;
        }
        nextResult = cursor.next();
      }

      setMatchStats({
        current: count === 0 ? 0 : currentIndex || 1,
        total: count,
      });
    } catch {
      // Invalid RegExp or search error
      setMatchStats({ current: 0, total: 0 });
    }
  }, [view, isOpen, findText, matchCase, wholeWord, isRegex, replaceText]);

  useEffect(() => {
    updateSearchQuery();
  }, [updateSearchQuery]);

  // Navigation handlers
  const handleFindNext = useCallback(() => {
    if (!view) return;
    findNext(view);
    updateSearchQuery();
  }, [view, updateSearchQuery]);

  const handleFindPrevious = useCallback(() => {
    if (!view) return;
    findPrevious(view);
    updateSearchQuery();
  }, [view, updateSearchQuery]);

  const handleReplaceNext = useCallback(() => {
    if (!view) return;
    replaceNext(view);
    updateSearchQuery();
  }, [view, updateSearchQuery]);

  const handleReplaceAll = useCallback(() => {
    if (!view) return;
    replaceAll(view);
    updateSearchQuery();
  }, [view, updateSearchQuery]);

  const handleSelectAll = useCallback(() => {
    if (!view) return;
    selectMatches(view);
  }, [view]);

  const handleClose = useCallback(() => {
    onClose();
    if (view) {
      view.dispatch({
        effects: setSearchQuery.of(new SearchQuery({ search: "" })),
      });
      view.focus();
    }
  }, [onClose, view]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute top-2 right-4 z-30 flex flex-col gap-1.5 rounded-lg border border-line/90 bg-surface-solid/95 p-2 shadow-2xl backdrop-blur-md ring-1 ring-white/10 animate-in fade-in slide-in-from-top-2 duration-150"
      style={{ minWidth: "380px", maxWidth: "480px" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          handleClose();
        }
      }}
    >
      {/* Row 1: Find */}
      <div className="flex items-center gap-1.5">
        {/* Toggle Replace row */}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 shrink-0 text-ink-muted hover:text-ink"
          onClick={() => {
            const next = !showReplace;
            setShowReplace(next);
            if (next) {
              setTimeout(() => replaceInputRef.current?.focus(), 50);
            }
          }}
          title={showReplace ? `Hide Replace (${altKey}R)` : "Toggle Replace"}
        >
          {showReplace ? (
            <IconChevronDown size={15} stroke={2} />
          ) : (
            <IconChevronRight size={15} stroke={2} />
          )}
        </Button>

        {/* Find Input container with embedded option toggles */}
        <div className="relative flex min-w-0 flex-1 items-center rounded-md border border-line bg-surface px-2 py-0.5 focus-within:border-fox focus-within:ring-1 focus-within:ring-fox">
          <input
            ref={findInputRef}
            type="text"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) {
                  handleFindPrevious();
                } else {
                  handleFindNext();
                }
              }
            }}
            placeholder="Find"
            className="h-6 min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted/50 outline-none font-mono"
          />

          {/* Matches Counter */}
          {findText && (
            <span className="mr-1.5 shrink-0 text-[0.68rem] text-ink-muted font-mono select-none">
              {matchStats.total === 0
                ? "No results"
                : `${matchStats.current} of ${matchStats.total}`}
            </span>
          )}

          {/* Options: Case, Whole Word, Regex */}
          <div className="flex shrink-0 items-center gap-0.5 border-l border-line/60 pl-1.5">
            <button
              type="button"
              className={cn(
                "size-5 rounded p-0.5 text-[0.68rem] font-bold transition-colors select-none flex items-center justify-center",
                matchCase
                  ? "bg-fox text-white"
                  : "text-ink-muted hover:text-ink hover:bg-foreground/10",
              )}
              onClick={() => setMatchCase((v) => !v)}
              title={`Match Case (${altKey}C)`}
            >
              <IconLetterCase size={12} stroke={2.5} />
            </button>

            <button
              type="button"
              className={cn(
                "size-5 rounded p-0.5 text-[0.65rem] font-mono font-bold transition-colors select-none flex items-center justify-center leading-none",
                wholeWord
                  ? "bg-fox text-white"
                  : "text-ink-muted hover:text-ink hover:bg-foreground/10",
              )}
              onClick={() => setWholeWord((v) => !v)}
              title={`Match Whole Word (${altKey}W)`}
            >
              \b
            </button>

            <button
              type="button"
              className={cn(
                "size-5 rounded p-0.5 text-[0.68rem] font-bold transition-colors select-none flex items-center justify-center",
                isRegex
                  ? "bg-fox text-white"
                  : "text-ink-muted hover:text-ink hover:bg-foreground/10",
              )}
              onClick={() => setIsRegex((v) => !v)}
              title={`Use Regular Expression (${altKey}R)`}
            >
              <IconRegex size={12} stroke={2.5} />
            </button>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 text-ink-muted hover:text-ink disabled:opacity-40"
            onClick={handleFindPrevious}
            disabled={!findText || matchStats.total === 0}
            title="Previous Match (Shift+Enter)"
          >
            <IconArrowUp size={14} stroke={2} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 text-ink-muted hover:text-ink disabled:opacity-40"
            onClick={handleFindNext}
            disabled={!findText || matchStats.total === 0}
            title="Next Match (Enter)"
          >
            <IconArrowDown size={14} stroke={2} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 text-ink-muted hover:text-ink disabled:opacity-40"
            onClick={handleSelectAll}
            disabled={!findText || matchStats.total === 0}
            title={`Select All Matches (${altKey}Enter)`}
          >
            <IconSelect size={14} stroke={1.75} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 text-ink-muted hover:text-ink"
            onClick={handleClose}
            title="Close (Esc)"
          >
            <IconX size={14} stroke={2} />
          </Button>
        </div>
      </div>

      {/* Row 2: Replace (Visible when showReplace is true) */}
      {showReplace && (
        <div className="flex items-center gap-1.5 pl-[30px] animate-in fade-in slide-in-from-top-1 duration-100">
          <div className="flex min-w-0 flex-1 items-center rounded-md border border-line bg-surface px-2 py-0.5 focus-within:border-fox focus-within:ring-1 focus-within:ring-fox">
            <input
              ref={replaceInputRef}
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.metaKey || e.ctrlKey || e.altKey) {
                    handleReplaceAll();
                  } else {
                    handleReplaceNext();
                  }
                }
              }}
              placeholder="Replace"
              className="h-6 min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted/50 outline-none font-mono"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[0.7rem] font-semibold text-ink hover:border-fox hover:text-fox"
              onClick={handleReplaceNext}
              disabled={!findText || matchStats.total === 0}
              title="Replace (Enter)"
            >
              <IconReplace size={12} stroke={2} className="mr-1" />
              Replace
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[0.7rem] font-semibold text-ink hover:border-fox hover:text-fox"
              onClick={handleReplaceAll}
              disabled={!findText || matchStats.total === 0}
              title={`Replace All (${modKey}${altKey}Enter)`}
            >
              All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
