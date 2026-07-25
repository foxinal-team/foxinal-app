import {
  IconCheck,
  IconCopy,
  IconKey,
  IconLock,
  IconNetwork,
  IconNumber,
  IconServerSpark,
  IconShieldLock,
  IconTag,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { SaveResult } from "./useInventory";
import {
  DEFAULT_SSH_PORT,
  defaultHostInput,
  type HostInput,
  type HostItem,
  hostInputFromItem,
} from "./types";

const labelIcon = { size: 14, stroke: 1.75, "aria-hidden": true as const };

type HostDialogProps = {
  open: boolean;
  mode: "create" | "edit" | "duplicate";
  parentLabel: string;
  initialHost?: HostItem | null;
  initialValues?: HostInput | null;
  onClose: () => void;
  onSubmit: (input: HostInput) => SaveResult | boolean;
};

function resolveResult(
  result: SaveResult | boolean,
  fallback: string,
): SaveResult {
  if (result === true) return { ok: true };
  if (result === false) return { ok: false, error: fallback };
  return result;
}

export function HostDialog({
  open,
  mode,
  parentLabel,
  initialHost = null,
  initialValues = null,
  onClose,
  onSubmit,
}: HostDialogProps) {
  const [form, setForm] = useState<HostInput>(defaultHostInput);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const labelRef = useRef<HTMLInputElement | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const usernameRef = useRef<HTMLInputElement | null>(null);
  const portRef = useRef<HTMLInputElement | null>(null);
  const keyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialHost) {
      setForm(hostInputFromItem(initialHost));
    } else if (initialValues) {
      setForm(initialValues);
    } else {
      setForm(defaultHostInput());
    }
    setError("");
    setSubmitting(false);
    const id = window.setTimeout(() => labelRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, mode, initialHost, initialValues]);

  function updateField<K extends keyof HostInput>(key: K, value: HostInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!form.address.trim()) {
      setError("Enter a hostname or IP address.");
      addressRef.current?.focus();
      return;
    }
    if (!form.username.trim()) {
      setError("Enter a username.");
      usernameRef.current?.focus();
      return;
    }
    const port = Number(form.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setError("Port must be between 1 and 65535.");
      portRef.current?.focus();
      return;
    }
    if (form.authMethod === "key" && !form.privateKey.trim()) {
      setError("Paste a private key, or switch to password auth.");
      keyRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const result = resolveResult(onSubmit(form), "Could not save host.");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "edit"
      ? "Edit host"
      : mode === "duplicate"
        ? "Duplicate host"
        : "New host";
  const lede =
    mode === "edit"
      ? `Update SSH details for “${initialHost?.name ?? ""}”`
      : mode === "duplicate"
        ? `Copy of credentials inside ${parentLabel}`
        : `SSH host inside ${parentLabel}`;
  const submitLabel =
    mode === "edit" ? "Save" : mode === "duplicate" ? "Duplicate" : "Create";
  const SubmitIcon = mode === "duplicate" ? IconCopy : IconCheck;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !submitting) onClose();
      }}
    >
      <DialogContent size="wide" aria-busy={submitting || undefined}>
        <DialogHeader>
          <span className="dialog__icon">
            {mode === "duplicate" ? (
              <IconCopy size={22} stroke={1.75} aria-hidden />
            ) : (
              <IconServerSpark size={22} stroke={1.75} aria-hidden />
            )}
          </span>
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{lede}</DialogDescription>
          </div>
        </DialogHeader>

        <form
          className="flex flex-col gap-3.5"
          onSubmit={handleSubmit}
          aria-busy={submitting || undefined}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="host-label" className="text-[0.78rem] font-semibold">
              <IconTag {...labelIcon} /> Label
            </Label>
            <Input
              ref={labelRef}
              id="host-label"
              name="label"
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.currentTarget.value)}
              placeholder="e.g. prod-api"
              autoComplete="off"
              disabled={submitting}
            />
          </div>

          <div className="flex gap-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label
                htmlFor="host-address"
                className="text-[0.78rem] font-semibold"
              >
                <IconNetwork {...labelIcon} /> Address
              </Label>
              <Input
                ref={addressRef}
                id="host-address"
                name="address"
                type="text"
                value={form.address}
                onChange={(e) => updateField("address", e.currentTarget.value)}
                placeholder="e.g. 192.168.1.10"
                autoComplete="off"
                required
                disabled={submitting}
                aria-invalid={
                  error.toLowerCase().includes("hostname") ||
                  error.toLowerCase().includes("address")
                    ? true
                    : undefined
                }
                aria-describedby={error ? "host-dialog-error" : undefined}
              />
            </div>

            <div className="flex w-[5.5rem] shrink-0 flex-col gap-1.5">
              <Label htmlFor="host-port" className="text-[0.78rem] font-semibold">
                <IconNumber {...labelIcon} /> Port
              </Label>
              <Input
                ref={portRef}
                id="host-port"
                name="port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                disabled={submitting}
                aria-invalid={
                  error.toLowerCase().includes("port") ? true : undefined
                }
                aria-describedby={error ? "host-dialog-error" : undefined}
                onChange={(e) =>
                  updateField(
                    "port",
                    e.currentTarget.value === ""
                      ? DEFAULT_SSH_PORT
                      : Number(e.currentTarget.value),
                  )
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="host-username"
              className="text-[0.78rem] font-semibold"
            >
              <IconUser {...labelIcon} /> Username
            </Label>
            <Input
              ref={usernameRef}
              id="host-username"
              name="username"
              type="text"
              value={form.username}
              onChange={(e) => updateField("username", e.currentTarget.value)}
              placeholder="e.g. root"
              autoComplete="username"
              required
              disabled={submitting}
              aria-invalid={
                error.toLowerCase().includes("username") ? true : undefined
              }
              aria-describedby={error ? "host-dialog-error" : undefined}
            />
          </div>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1.5 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-foreground">
              <IconShieldLock {...labelIcon} /> Credentials
            </legend>
            <div
              className="dialog__auth-toggle"
              role="group"
              aria-label="Auth method"
            >
              <button
                type="button"
                className={
                  form.authMethod === "password"
                    ? "dialog__auth-option dialog__auth-option--active"
                    : "dialog__auth-option"
                }
                aria-pressed={form.authMethod === "password"}
                disabled={submitting}
                onClick={() => updateField("authMethod", "password")}
              >
                <IconLock size={16} stroke={1.75} aria-hidden />
                Password
              </button>
              <button
                type="button"
                className={
                  form.authMethod === "key"
                    ? "dialog__auth-option dialog__auth-option--active"
                    : "dialog__auth-option"
                }
                aria-pressed={form.authMethod === "key"}
                disabled={submitting}
                onClick={() => updateField("authMethod", "key")}
              >
                <IconKey size={16} stroke={1.75} aria-hidden />
                SSH key
              </button>
            </div>

            {form.authMethod === "password" ? (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="host-password"
                  className="text-[0.78rem] font-semibold"
                >
                  <IconLock {...labelIcon} /> Password
                </Label>
                <Input
                  id="host-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    updateField("password", e.currentTarget.value)
                  }
                  placeholder="Optional password"
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="host-private-key"
                  className="text-[0.78rem] font-semibold"
                >
                  <IconKey {...labelIcon} /> Private key
                </Label>
                <Textarea
                  ref={keyRef}
                  id="host-private-key"
                  name="privateKey"
                  rows={5}
                  value={form.privateKey}
                  onChange={(e) =>
                    updateField("privateKey", e.currentTarget.value)
                  }
                  placeholder="Paste private key (PEM)"
                  spellCheck={false}
                  disabled={submitting}
                  aria-invalid={
                    error.toLowerCase().includes("private key")
                      ? true
                      : undefined
                  }
                  aria-describedby={error ? "host-dialog-error" : undefined}
                  className="min-h-24 resize-y rounded-[var(--radius-sm)] border-[var(--line)] bg-[var(--field-bg)] font-mono text-[0.8rem] leading-[1.45] placeholder:text-[var(--placeholder)] focus-visible:ring-[var(--ring)]"
                />
              </div>
            )}
          </fieldset>

          {error ? (
            <p
              id="host-dialog-error"
              className="m-0 text-[0.8125rem] text-[var(--error)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-1">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={onClose}
            >
              <IconX size={16} stroke={1.75} aria-hidden />
              <span>Cancel</span>
            </Button>
            <Button type="submit" disabled={submitting} aria-busy={submitting || undefined}>
              <SubmitIcon size={16} stroke={1.75} aria-hidden />
              <span>{submitting ? "Saving…" : submitLabel}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
