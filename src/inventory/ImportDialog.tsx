import {
  IconFile,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useState } from "react";
import { DialogIcon } from "@/components/DialogIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  basenameFromPath,
  isJsonPath,
} from "@/inventory/transfer";
import { cn } from "@/lib/utils";

type ImportDialogProps = {
  open: boolean;
  /** Where items will be imported (shown in the lede). */
  destinationLabel: string;
  busy?: boolean;
  onClose: () => void;
  /** Runs only when the user clicks Import with a file selected. */
  onImport: (path: string) => void | Promise<void>;
};

type SelectedFile = {
  path: string;
  name: string;
};

export function ImportDialog({
  open,
  destinationLabel,
  busy = false,
  onClose,
  onImport,
}: ImportDialogProps) {
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setError("");
    setDragging(false);
  }, [open]);

  // Tauri does not expose OS file drops through HTML5 dataTransfer — use the
  // webview drag-drop API while this dialog is open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (cancelled || busy) return;
        const { type } = event.payload;
        if (type === "enter" || type === "over") {
          setDragging(true);
          return;
        }
        if (type === "leave") {
          setDragging(false);
          return;
        }
        if (type !== "drop") return;

        setDragging(false);
        const path = event.payload.paths[0];
        if (!path) return;
        if (!isJsonPath(path)) {
          setFile(null);
          setError("Drop a foxinal export JSON file (.json).");
          return;
        }
        setFile({ path, name: basenameFromPath(path) });
        setError("");
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [open, busy]);

  async function browseForFile() {
    if (busy) return;
    try {
      const selected = await openFileDialog({
        multiple: false,
        directory: false,
        title: "Import foxinal connections",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (selected === null) return;
      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return;
      if (!isJsonPath(path)) {
        setFile(null);
        setError("Choose a foxinal export JSON file.");
        return;
      }
      setFile({ path, name: basenameFromPath(path) });
      setError("");
    } catch (err) {
      const message =
        typeof err === "string" && err.trim()
          ? err
          : err instanceof Error
            ? err.message
            : "Could not open the file picker.";
      setError(message);
    }
  }

  async function handleImport() {
    if (!file || busy) return;
    setError("");
    await onImport(file.path);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent size="wide" aria-busy={busy || undefined}>
        <DialogHeader>
          <DialogIcon>
            <IconUpload size={22} stroke={1.75} aria-hidden />
          </DialogIcon>
          <div>
            <DialogTitle>Import connections</DialogTitle>
            <DialogDescription>
              Into {destinationLabel}. Drop a foxinal export JSON, or choose a
              file.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void browseForFile()}
            className={cn(
              "flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-line bg-[var(--field-bg)] px-4 py-6 text-center transition-colors",
              "hover:border-fox/45 hover:bg-fox/5",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] focus-visible:outline-none",
              dragging && "border-fox bg-fox/10",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <span className="grid size-10 place-items-center rounded-[var(--radius-sm)] bg-fox/12 text-fox">
              <IconUpload size={22} stroke={1.75} aria-hidden />
            </span>
            <span className="text-[0.9rem] font-semibold text-ink">
              {dragging ? "Drop to select" : "Drag & drop a JSON file here"}
            </span>
            <span className="text-[0.8rem] text-ink-muted">
              or click to browse
            </span>
          </button>

          {file ? (
            <div className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2">
              <IconFile
                className="shrink-0 text-fox"
                size={18}
                stroke={1.75}
                aria-hidden
              />
              <span
                className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold text-ink"
                title={file.path}
              >
                {file.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0"
                disabled={busy}
                aria-label="Remove selected file"
                onClick={() => {
                  setFile(null);
                  setError("");
                }}
              >
                <IconX size={16} stroke={1.75} aria-hidden />
              </Button>
            </div>
          ) : null}

          {error ? (
            <p
              className="m-0 text-[0.8rem] font-medium text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            <IconX size={16} stroke={1.75} aria-hidden />
            <span>Cancel</span>
          </Button>
          <Button
            type="button"
            disabled={busy || !file}
            onClick={() => void handleImport()}
          >
            <IconUpload size={16} stroke={1.75} aria-hidden />
            <span>{busy ? "Importing…" : "Import"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
