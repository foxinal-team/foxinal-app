import type { ReactNode } from "react";

type ConfirmDeleteDialogProps = {
  open: boolean;
  title: string;
  message: string;
  icon?: ReactNode;
  confirmIcon?: ReactNode;
  cancelIcon?: ReactNode;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  title,
  message,
  icon,
  confirmIcon,
  cancelIcon,
  busy = false,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  if (!open) return null;

  return (
    <div
      className="dialog"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__heading">
          {icon ? (
            <span className="dialog__icon dialog__icon--danger">{icon}</span>
          ) : null}
          <div>
            <h2 id="confirm-delete-title" className="dialog__title">
              {title}
            </h2>
            <p className="dialog__lede">{message}</p>
          </div>
        </div>

        <div className="dialog__actions">
          <button
            type="button"
            className="dialog__cancel"
            disabled={busy}
            onClick={onClose}
          >
            {cancelIcon}
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className="dialog__submit dialog__submit--danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmIcon}
            <span>{busy ? "Deleting…" : "Delete"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
