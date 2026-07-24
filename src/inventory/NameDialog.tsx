import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
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
  icon?: ReactNode;
  submitIcon?: ReactNode;
  cancelIcon?: ReactNode;
  onClose: () => void;
  onSubmitName: (name: string) => SaveResult | boolean;
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
  icon,
  submitIcon,
  cancelIcon,
  onClose,
  onSubmitName,
}: NameDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError("");
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, initialName]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(emptyError);
      return;
    }
    const result = resolveResult(onSubmitName(name), saveError);
    if (!result.ok) {
      setError(result.error || saveError);
      return;
    }
    onClose();
  }

  return (
    <div className="dialog" role="presentation" onClick={onClose}>
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

        <form className="dialog__form" onSubmit={handleSubmit}>
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
            />
          </label>

          {error ? (
            <p className="dialog__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="dialog__actions">
            <button type="button" className="dialog__cancel" onClick={onClose}>
              {cancelIcon}
              <span>Cancel</span>
            </button>
            <button type="submit" className="dialog__submit">
              {submitIcon}
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
