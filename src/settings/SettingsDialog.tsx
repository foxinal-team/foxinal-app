import {
  IconCheck,
  IconInfoCircle,
  IconLock,
  IconSettings,
  IconShieldLock,
  IconTerminal2,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { type FormEvent, useEffect, useState } from "react";
import type { InventoryItem } from "../inventory/types";
import { hasMasterPassword, MASTER_PASSWORD_MIN_LENGTH } from "../security/masterPassword";
import {
  AUTO_LOCK_MINUTE_OPTIONS,
  saveSecurityPrefs,
  type SecurityPrefs,
} from "../security/prefs";
import {
  changeMasterPassword,
  disableMasterPassword,
  enableMasterPassword,
} from "../security/session";
import { APP_NAME, APP_VERSION } from "../version";
import {
  DEFAULT_TERMINAL_PREFS,
  TERMINAL_FONTS,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_THEMES,
  fontFamilyForId,
  resolveTerminalTheme,
  type TerminalPrefs,
  type TerminalThemeId,
} from "./terminalPrefs";

type SettingsSection = "terminal" | "account" | "security" | "about";

type SettingsDialogProps = {
  open: boolean;
  appTheme: string;
  terminalPrefs: TerminalPrefs;
  inventoryItems: InventoryItem[];
  securityEnabled: boolean;
  securityPrefs: SecurityPrefs;
  onChangeTerminalPrefs: (prefs: TerminalPrefs) => void;
  onSecurityChange: () => void;
  onVaultKeyChange: (key: CryptoKey | null) => void;
  onSecurityPrefsChange: (prefs: SecurityPrefs) => void;
  onClose: () => void;
};

export function SettingsDialog({
  open,
  appTheme,
  terminalPrefs,
  inventoryItems,
  securityEnabled,
  securityPrefs,
  onChangeTerminalPrefs,
  onSecurityChange,
  onVaultKeyChange,
  onSecurityPrefsChange,
  onClose,
}: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSection>("terminal");
  const [draft, setDraft] = useState<TerminalPrefs>(terminalPrefs);
  const [securityOn, setSecurityOn] = useState(securityEnabled);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSection("terminal");
    setDraft(terminalPrefs);
    setSecurityOn(hasMasterPassword());
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setSecurityError(null);
    setSecurityMessage(null);
  }, [open, terminalPrefs]);

  if (!open) return null;

  const dirty =
    draft.fontId !== terminalPrefs.fontId ||
    draft.fontSize !== terminalPrefs.fontSize ||
    draft.theme !== terminalPrefs.theme;

  const previewTheme = resolveTerminalTheme(draft.theme, appTheme);

  function updateDraft<K extends keyof TerminalPrefs>(
    key: K,
    value: TerminalPrefs[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyTerminal() {
    onChangeTerminalPrefs(draft);
  }

  function resetTerminal() {
    setDraft({ ...DEFAULT_TERMINAL_PREFS });
    onChangeTerminalPrefs({ ...DEFAULT_TERMINAL_PREFS });
  }

  function clearSecurityForm() {
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
  }

  function updateSecurityPrefs(patch: Partial<SecurityPrefs>) {
    const next = { ...securityPrefs, ...patch };
    saveSecurityPrefs(next);
    onSecurityPrefsChange(next);
  }

  async function handleSetMasterPassword(e: FormEvent) {
    e.preventDefault();
    setSecurityError(null);
    setSecurityMessage(null);

    if (nextPassword !== confirmPassword) {
      setSecurityError("New passwords do not match.");
      return;
    }

    setSecurityBusy(true);
    try {
      const result = securityOn
        ? await changeMasterPassword(
            currentPassword,
            nextPassword,
            inventoryItems,
          )
        : await enableMasterPassword(nextPassword, inventoryItems);
      if (!result.ok) {
        setSecurityError(result.error);
        return;
      }
      setSecurityOn(true);
      onVaultKeyChange(result.key);
      clearSecurityForm();
      setSecurityMessage(
        securityOn
          ? "Master password updated. Inventory re-encrypted."
          : "Master password set. Inventory is encrypted on this device.",
      );
      onSecurityChange();
    } finally {
      setSecurityBusy(false);
    }
  }

  async function handleRemoveMasterPassword(e: FormEvent) {
    e.preventDefault();
    setSecurityError(null);
    setSecurityMessage(null);

    if (!currentPassword) {
      setSecurityError("Enter your current master password to remove it.");
      return;
    }

    setSecurityBusy(true);
    try {
      const result = await disableMasterPassword(
        currentPassword,
        inventoryItems,
      );
      if (!result.ok) {
        setSecurityError(result.error);
        return;
      }
      setSecurityOn(false);
      onVaultKeyChange(null);
      clearSecurityForm();
      updateSecurityPrefs({
        autoLockEnabled: false,
        lockOnBlurEnabled: false,
      });
      setSecurityMessage(
        "Master password removed. Inventory stored in plaintext again.",
      );
      onSecurityChange();
    } finally {
      setSecurityBusy(false);
    }
  }

  return (
    <div className="dialog" role="presentation" onClick={onClose}>
      <div
        className="dialog__panel dialog__panel--settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings__header">
          <div className="dialog__heading">
            <span className="dialog__icon">
              <IconSettings size={22} stroke={1.75} aria-hidden />
            </span>
            <div>
              <h2 id="settings-dialog-title" className="dialog__title">
                Settings
              </h2>
              <p className="dialog__lede">Preferences for this app instance.</p>
            </div>
          </div>
          <button
            type="button"
            className="settings__close"
            aria-label="Close settings"
            onClick={onClose}
          >
            <IconX size={18} stroke={1.75} aria-hidden />
          </button>
        </div>

        <div
          className="settings__nav"
          role="tablist"
          aria-label="Settings sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={section === "terminal"}
            className={
              section === "terminal"
                ? "settings__nav-btn settings__nav-btn--active"
                : "settings__nav-btn"
            }
            onClick={() => setSection("terminal")}
          >
            <IconTerminal2 size={16} stroke={1.75} aria-hidden />
            <span>Terminal</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "account"}
            className={
              section === "account"
                ? "settings__nav-btn settings__nav-btn--active"
                : "settings__nav-btn"
            }
            onClick={() => setSection("account")}
          >
            <IconUser size={16} stroke={1.75} aria-hidden />
            <span>Account</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "security"}
            className={
              section === "security"
                ? "settings__nav-btn settings__nav-btn--active"
                : "settings__nav-btn"
            }
            onClick={() => setSection("security")}
          >
            <IconShieldLock size={16} stroke={1.75} aria-hidden />
            <span>Security</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "about"}
            className={
              section === "about"
                ? "settings__nav-btn settings__nav-btn--active"
                : "settings__nav-btn"
            }
            onClick={() => setSection("about")}
          >
            <IconInfoCircle size={16} stroke={1.75} aria-hidden />
            <span>About</span>
          </button>
        </div>

        <div className="settings__body">
          {section === "terminal" ? (
            <div className="settings__section">
              <label className="dialog__field" htmlFor="term-font">
                <span>Font</span>
                <select
                  id="term-font"
                  value={draft.fontId}
                  onChange={(e) => updateDraft("fontId", e.currentTarget.value)}
                >
                  {TERMINAL_FONTS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="dialog__field" htmlFor="term-size">
                <span>
                  Size <em className="settings__value">{draft.fontSize}px</em>
                </span>
                <input
                  id="term-size"
                  type="range"
                  min={TERMINAL_FONT_SIZE_MIN}
                  max={TERMINAL_FONT_SIZE_MAX}
                  step={1}
                  value={draft.fontSize}
                  onChange={(e) =>
                    updateDraft("fontSize", Number(e.currentTarget.value))
                  }
                />
              </label>

              <fieldset className="dialog__fieldset">
                <legend>Theme</legend>
                <div
                  className="settings__theme-grid"
                  role="group"
                  aria-label="Terminal theme"
                >
                  {TERMINAL_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className={
                        draft.theme === theme.id
                          ? "settings__theme-option settings__theme-option--active"
                          : "settings__theme-option"
                      }
                      onClick={() =>
                        updateDraft("theme", theme.id as TerminalThemeId)
                      }
                    >
                      <span
                        className={`settings__theme-swatch settings__theme-swatch--${theme.id}`}
                        aria-hidden
                      />
                      <span>{theme.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <p
                className="settings__preview"
                style={{
                  fontFamily: fontFamilyForId(draft.fontId),
                  fontSize: draft.fontSize,
                  background: previewTheme.background,
                  color: previewTheme.foreground,
                  borderColor: previewTheme.selectionBackground,
                }}
              >
                <span style={{ color: previewTheme.green }}>user</span>
                <span style={{ color: previewTheme.foreground }}>@</span>
                <span style={{ color: previewTheme.cyan }}>foxinal</span>
                <span style={{ color: previewTheme.foreground }}>:</span>
                <span style={{ color: previewTheme.blue }}>~</span>
                <span style={{ color: previewTheme.foreground }}>$ </span>
                <span style={{ color: previewTheme.foreground }}>echo </span>
                <span style={{ color: previewTheme.yellow }}>
                  &quot;preview&quot;
                </span>
              </p>

              <div className="dialog__actions">
                <button
                  type="button"
                  className="dialog__cancel"
                  onClick={resetTerminal}
                >
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  className="dialog__submit"
                  disabled={!dirty}
                  onClick={applyTerminal}
                >
                  <IconCheck size={16} stroke={1.75} aria-hidden />
                  <span>Apply</span>
                </button>
              </div>
            </div>
          ) : null}

          {section === "account" ? (
            <div className="settings__section">
              <div className="settings__account-card">
                <span className="settings__account-icon" aria-hidden>
                  <IconLock size={18} stroke={1.75} />
                </span>
                <div>
                  <p className="settings__account-title">Local mode</p>
                  <p className="settings__account-meta">
                    Data stays on this device. Server sync is not enabled yet.
                  </p>
                </div>
              </div>
              <p className="settings__hint">
                Account sync and profile options will show up here in a later
                release. Use the Security tab for master password and lock
                behavior.
              </p>
            </div>
          ) : null}

          {section === "security" ? (
            <div className="settings__section">
              <div className="settings__security-head">
                <span className="settings__security-icon" aria-hidden>
                  <IconShieldLock size={18} stroke={1.75} />
                </span>
                <div>
                  <h3 id="security-heading" className="settings__security-title">
                    Master password
                  </h3>
                  <p className="settings__security-meta">
                    {securityOn
                      ? "Encrypts your inventory and unlocks Foxinal on this device."
                      : "Optional. Encrypt inventory and require unlock on launch."}
                  </p>
                </div>
              </div>

              <form
                className="settings__security-form"
                onSubmit={handleSetMasterPassword}
              >
                {securityOn ? (
                  <label className="dialog__field" htmlFor="mp-current">
                    <span>Current master password</span>
                    <input
                      id="mp-current"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) =>
                        setCurrentPassword(e.currentTarget.value)
                      }
                      disabled={securityBusy}
                    />
                  </label>
                ) : null}

                <label className="dialog__field" htmlFor="mp-new">
                  <span>
                    {securityOn ? "New master password" : "Master password"}
                  </span>
                  <input
                    id="mp-new"
                    type="password"
                    autoComplete="new-password"
                    value={nextPassword}
                    onChange={(e) => setNextPassword(e.currentTarget.value)}
                    placeholder={`At least ${MASTER_PASSWORD_MIN_LENGTH} characters`}
                    disabled={securityBusy}
                  />
                </label>

                <label className="dialog__field" htmlFor="mp-confirm">
                  <span>Confirm master password</span>
                  <input
                    id="mp-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                    disabled={securityBusy}
                  />
                </label>

                {securityError ? (
                  <p
                    className="inventory__transfer inventory__transfer--error"
                    role="alert"
                  >
                    {securityError}
                  </p>
                ) : null}
                {securityMessage ? (
                  <p className="inventory__transfer" role="status">
                    {securityMessage}
                  </p>
                ) : null}

                <div className="settings__account-actions">
                  <button
                    type="submit"
                    className="dialog__submit"
                    disabled={securityBusy || !nextPassword || !confirmPassword}
                  >
                    <IconCheck size={16} stroke={1.75} aria-hidden />
                    <span>
                      {securityBusy
                        ? "Saving…"
                        : securityOn
                          ? "Update password"
                          : "Set master password"}
                    </span>
                  </button>
                </div>
              </form>

              <div
                className={
                  securityOn
                    ? "settings__lock-prefs"
                    : "settings__lock-prefs settings__lock-prefs--disabled"
                }
              >
                <p className="settings__lock-prefs-title">Lock behavior</p>
                <p className="settings__hint">
                  {securityOn
                    ? "Choose when Foxinal should lock and require your master password again."
                    : "Available after you set a master password."}
                </p>

                <label className="settings__toggle">
                  <input
                    type="checkbox"
                    checked={securityPrefs.autoLockEnabled}
                    disabled={!securityOn}
                    onChange={(e) =>
                      updateSecurityPrefs({
                        autoLockEnabled: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>Auto-lock after inactivity</span>
                </label>

                <label className="dialog__field" htmlFor="auto-lock-minutes">
                  <span>Idle timeout</span>
                  <select
                    id="auto-lock-minutes"
                    value={securityPrefs.autoLockMinutes}
                    disabled={!securityOn || !securityPrefs.autoLockEnabled}
                    onChange={(e) =>
                      updateSecurityPrefs({
                        autoLockMinutes: Number(e.currentTarget.value),
                      })
                    }
                  >
                    {AUTO_LOCK_MINUTE_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minute{minutes === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="settings__toggle">
                  <input
                    type="checkbox"
                    checked={securityPrefs.lockOnBlurEnabled}
                    disabled={!securityOn}
                    onChange={(e) =>
                      updateSecurityPrefs({
                        lockOnBlurEnabled: e.currentTarget.checked,
                      })
                    }
                  />
                  <span>Lock when app is hidden</span>
                </label>
              </div>

              {securityOn ? (
                <form
                  className="settings__security-remove"
                  onSubmit={handleRemoveMasterPassword}
                >
                  <p className="settings__hint">
                    Removing the master password decrypts inventory to plaintext
                    and opens Foxinal unlocked.
                  </p>
                  <button
                    type="submit"
                    className="dialog__cancel"
                    disabled={securityBusy || !currentPassword}
                  >
                    <span>Remove master password</span>
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

          {section === "about" ? (
            <div className="settings__section settings__section--about">
              <p className="settings__about-name">{APP_NAME}</p>
              <p className="settings__about-version">v{APP_VERSION}</p>
              <p className="settings__hint">
                Manage local terminals and SSH hosts in one place.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
