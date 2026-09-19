import {
  IconArrowDown,
  IconArrowUp,
  IconLetterCase,
  IconRegex,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SearchOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
};

type TerminalSearchBarProps = {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, options: SearchOptions) => void;
  onFindNext: (query: string, options: SearchOptions) => void;
  onFindPrevious: (query: string, options: SearchOptions) => void;
  matchCount?: { current: number; total: number } | null;
  initialQuery?: string;
  initialOptions?: Partial<SearchOptions>;
  onStateChange?: (query: string, options: SearchOptions) => void;
};

export function TerminalSearchBar({
  isOpen,
  onClose,
  onSearch,
  onFindNext,
  onFindPrevious,
  matchCount,
  initialQuery = "",
  initialOptions,
  onStateChange,
}: TerminalSearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [caseSensitive, setCaseSensitive] = useState(
    initialOptions?.caseSensitive ?? false,
  );
  const [wholeWord, setWholeWord] = useState(
    initialOptions?.wholeWord ?? false,
  );
  const [regex, setRegex] = useState(initialOptions?.regex ?? false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const options: SearchOptions = {
    caseSensitive,
    wholeWord,
    regex,
  };

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
      if (query) {
        onSearch(query, options);
      }
    }
  }, [isOpen]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    onSearch(val, options);
    onStateChange?.(val, options);
  };

  const toggleCase = () => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    onSearch(query, { ...options, caseSensitive: next });
  };

  const toggleWholeWord = () => {
    const next = !wholeWord;
    setWholeWord(next);
    onSearch(query, { ...options, wholeWord: next });
  };

  const toggleRegex = () => {
    const next = !regex;
    setRegex(next);
    onSearch(query, { ...options, regex: next });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        onFindPrevious(query, options);
      } else {
        onFindNext(query, options);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute top-2 right-3 z-30 flex items-center gap-1 rounded-(--radius-md) border border-line bg-surface-elevated/95 p-1 text-ink shadow-(--shadow-md) backdrop-blur-md transition-all duration-150 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2",
      )}
      role="search"
      aria-label="Terminal search"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in terminal..."
        className="h-7 w-44 rounded-(--radius-sm) bg-surface-solid/80 px-2 text-xs font-mono text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-1 focus:ring-fox/60"
        aria-label="Search buffer"
      />

      {query.length > 0 && matchCount && (
        <span className="px-1 text-[11px] font-mono text-ink-muted tabular-nums">
          {matchCount.total > 0
            ? `${matchCount.current}/${matchCount.total}`
            : "No matches"}
        </span>
      )}

      <div className="flex items-center gap-0.5 border-l border-line/60 pl-1">
        <button
          type="button"
          onClick={() => onFindPrevious(query, options)}
          disabled={!query}
          title="Previous match (Shift+Enter)"
          aria-label="Previous match"
          className="flex size-6 items-center justify-center rounded-(--radius-sm) text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-30"
        >
          <IconArrowUp size={14} stroke={2} />
        </button>

        <button
          type="button"
          onClick={() => onFindNext(query, options)}
          disabled={!query}
          title="Next match (Enter)"
          aria-label="Next match"
          className="flex size-6 items-center justify-center rounded-(--radius-sm) text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-30"
        >
          <IconArrowDown size={14} stroke={2} />
        </button>
      </div>

      <div className="flex items-center gap-0.5 border-l border-line/60 pl-1">
        <button
          type="button"
          onClick={toggleCase}
          title="Match Case"
          aria-label="Match case"
          className={cn(
            "flex size-6 items-center justify-center rounded-(--radius-sm) text-xs font-semibold transition",
            caseSensitive
              ? "bg-fox/20 text-fox"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink",
          )}
        >
          <IconLetterCase size={14} stroke={2} />
        </button>

        <button
          type="button"
          onClick={toggleWholeWord}
          title="Match Whole Word"
          aria-label="Match whole word"
          className={cn(
            "flex size-6 items-center justify-center rounded-(--radius-sm) text-[11px] font-mono font-bold transition",
            wholeWord
              ? "bg-fox/20 text-fox"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink",
          )}
        >
          \b
        </button>

        <button
          type="button"
          onClick={toggleRegex}
          title="Use Regular Expression"
          aria-label="Use regular expression"
          className={cn(
            "flex size-6 items-center justify-center rounded-(--radius-sm) text-xs transition",
            regex
              ? "bg-fox/20 text-fox"
              : "text-ink-muted hover:bg-surface-hover hover:text-ink",
          )}
        >
          <IconRegex size={14} stroke={2} />
        </button>
      </div>

      <button
        type="button"
        onClick={onClose}
        title="Close (Escape)"
        aria-label="Close search"
        className="flex size-6 items-center justify-center rounded-(--radius-sm) border-l border-line/60 text-ink-muted transition hover:bg-surface-hover hover:text-ink"
      >
        <IconX size={14} stroke={2} />
      </button>
    </div>
  );
}
