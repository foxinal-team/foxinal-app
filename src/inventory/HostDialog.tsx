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
  const labelRef = useRef<HTMLInputElement | null>(null);

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
    const id = window.setTimeout(() => labelRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, mode, initialHost, initialValues]);

  if (!open) return null;

  function updateField<K extends keyof HostInput>(key: K, value: HostInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.address.trim()) {
      setError("Enter a hostname or IP address.");
      return;
    }
    if (!form.username.trim()) {
      setError("Enter a username.");
      return;
    }
    const port = Number(form.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setError("Port must be between 1 and 65535.");
      return;
    }
    if (form.authMethod === "key" && !form.privateKey.trim()) {
      setError("Paste a private key, or switch to password auth.");
      return;
    }

    const result = resolveResult(onSubmit(form), "Could not save host.");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
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
    <div className="dialog" role="presentation" onClick={onClose}>
      <div
        className="dialog__panel dialog__panel--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="host-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__heading">
          <span className="dialog__icon">
            {mode === "duplicate" ? (
              <IconCopy size={22} stroke={1.75} aria-hidden />
            ) : (
              <IconServerSpark size={22} stroke={1.75} aria-hidden />
            )}
          </span>
          <div>
            <h2 id="host-dialog-title" className="dialog__title">
              {title}
            </h2>
            <p className="dialog__lede">{lede}</p>
          </div>
        </div>

        <form className="dialog__form" onSubmit={handleSubmit}>
          <label className="dialog__field" htmlFor="host-label">
            <span>
              <IconTag {...labelIcon} /> Label
            </span>
            <input
              ref={labelRef}
              id="host-label"
              name="label"
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.currentTarget.value)}
              placeholder="Optional display name"
              autoComplete="off"
            />
          </label>

          <div className="dialog__row">
            <label className="dialog__field dialog__field--grow" htmlFor="host-address">
              <span>
                <IconNetwork {...labelIcon} /> Address
              </span>
              <input
                id="host-address"
                name="address"
                type="text"
                value={form.address}
                onChange={(e) => updateField("address", e.currentTarget.value)}
                placeholder="hostname or IP"
                autoComplete="off"
                required
              />
            </label>

            <label className="dialog__field dialog__field--port" htmlFor="host-port">
              <span>
                <IconNumber {...labelIcon} /> Port
              </span>
              <input
                id="host-port"
                name="port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) =>
                  updateField(
                    "port",
                    e.currentTarget.value === ""
                      ? DEFAULT_SSH_PORT
                      : Number(e.currentTarget.value),
                  )
                }
              />
            </label>
          </div>

          <label className="dialog__field" htmlFor="host-username">
            <span>
              <IconUser {...labelIcon} /> Username
            </span>
            <input
              id="host-username"
              name="username"
              type="text"
              value={form.username}
              onChange={(e) => updateField("username", e.currentTarget.value)}
              placeholder="root"
              autoComplete="username"
              required
            />
          </label>

          <fieldset className="dialog__fieldset">
            <legend>
              <IconShieldLock {...labelIcon} /> Credentials
            </legend>
            <div className="dialog__auth-toggle" role="group" aria-label="Auth method">
              <button
                type="button"
                className={
                  form.authMethod === "password"
                    ? "dialog__auth-option dialog__auth-option--active"
                    : "dialog__auth-option"
                }
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
                onClick={() => updateField("authMethod", "key")}
              >
                <IconKey size={16} stroke={1.75} aria-hidden />
                SSH key
              </button>
            </div>

            {form.authMethod === "password" ? (
              <label className="dialog__field" htmlFor="host-password">
                <span>
                  <IconLock {...labelIcon} /> Password
                </span>
                <input
                  id="host-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.currentTarget.value)}
                  placeholder="Optional until you connect"
                  autoComplete="new-password"
                />
              </label>
            ) : (
              <label className="dialog__field" htmlFor="host-private-key">
                <span>
                  <IconKey {...labelIcon} /> Private key
                </span>
                <textarea
                  id="host-private-key"
                  name="privateKey"
                  rows={5}
                  value={form.privateKey}
                  onChange={(e) => updateField("privateKey", e.currentTarget.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  spellCheck={false}
                />
              </label>
            )}
          </fieldset>

          {error ? (
            <p className="dialog__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="dialog__actions">
            <button type="button" className="dialog__cancel" onClick={onClose}>
              <IconX size={16} stroke={1.75} aria-hidden />
              <span>Cancel</span>
            </button>
            <button type="submit" className="dialog__submit">
              <SubmitIcon size={16} stroke={1.75} aria-hidden />
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
