import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SaveResult } from "./useInventory";

type NameDialogProps = {
  open: boolean;
  title: string;
  lede: string;
  submitLabel: string;
  placeholder?: string;
  emptyError?: string;
  saveError?: string;
  initialName?: string;
  busy?: boolean;
  icon?: ReactNode;
  submitIcon?: ReactNode;
  cancelIcon?: ReactNode;
  onClose: () => void;
  onSubmitName: (
    name: string,
  ) => SaveResult | boolean | Promise<SaveResult | boolean>;
};

function resolveResult(
  result: SaveResult | boolean,
  fallback: string,
): SaveResult {
  if (result === true) return { ok: true };
  if (result === false) return { ok: false, error: fallback };
  return result;
}

export function NameDialog({
  open,
  title,
  lede,
  submitLabel,
  placeholder = "Name",
  emptyError = "Enter a name.",
  saveError = "Could not save.",
  initialName = "",
  busy = false,
  icon,
  submitIcon,
  cancelIcon,
  onClose,
  onSubmitName,
}: NameDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const locked = busy || submitting;

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError("");
    setSubmitting(false);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, initialName]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (!name.trim()) {
      setError(emptyError);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = resolveResult(
        await Promise.resolve(onSubmitName(name)),
        saveError,
      );
      if (!result.ok) {
        setError(result.error || saveError);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : saveError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="dialog"
      role="presentation"
      onClick={() => {
        if (!locked) onClose();
      }}
    >
      <div
        className="dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__heading">
          {icon ? <span className="dialog__icon">{icon}</span> : null}
          <div>
            <h2 id="name-dialog-title" className="dialog__title">
              {title}
            </h2>
            <p className="dialog__lede">{lede}</p>
          </div>
        </div>

        <form className="dialog__form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="dialog__field" htmlFor="item-name">
            <span>Name</span>
            <input
              ref={inputRef}
              id="item-name"
              name="item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder={placeholder}
              autoComplete="off"
              disabled={locked}
            />
          </label>

          {error ? (
            <p className="dialog__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="dialog__actions">
            <button
              type="button"
              className="dialog__cancel"
              disabled={locked}
              onClick={onClose}
            >
              {cancelIcon}
              <span>Cancel</span>
            </button>
            <button type="submit" className="dialog__submit" disabled={locked}>
              {submitIcon}
              <span>{submitting ? "Creating…" : submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
