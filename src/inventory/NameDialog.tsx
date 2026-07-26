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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import type { SaveResult } from "./useInventory";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (!name.trim()) {
      setError(emptyError);
      toast.error(emptyError);
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
        const msg = result.error || saveError;
        setError(msg);
        toast.error(msg);
        return;
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : saveError;
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !locked) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          {icon ? <DialogIcon>{icon}</DialogIcon> : null}
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{lede}</DialogDescription>
          </div>
        </DialogHeader>

        <form className="flex flex-col gap-3.5" onSubmit={(e) => void handleSubmit(e)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-name" className="text-[0.78rem] font-semibold">
              Name
            </Label>
            <Input
              ref={inputRef}
              id="item-name"
              name="item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder={placeholder}
              autoComplete="off"
              disabled={locked}
              aria-invalid={error ? true : undefined}
            />
          </div>

          <DialogFooter className="mt-1">
            <Button
              type="button"
              variant="outline"
              disabled={locked}
              onClick={onClose}
            >
              {cancelIcon}
              <span>Cancel</span>
            </Button>
            <Button type="submit" disabled={locked} aria-busy={submitting || undefined}>
              {submitIcon}
              <span>{submitting ? "Saving…" : submitLabel}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
