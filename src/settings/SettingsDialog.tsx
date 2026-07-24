import {
  IconCheck,
  IconInfoCircle,
  IconLock,
  IconSettings,
  IconTerminal2,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { AppSession } from "../App";
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

type SettingsSection = "terminal" | "account" | "about";

type SettingsDialogProps = {
  open: boolean;
  session: AppSession;
  appTheme: string;
  terminalPrefs: TerminalPrefs;
  onChangeTerminalPrefs: (prefs: TerminalPrefs) => void;
  onClose: () => void;
};

export function SettingsDialog({
  open,
  session,
  appTheme,
  terminalPrefs,
  onChangeTerminalPrefs,
  onClose,
}: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSection>("terminal");
  const [draft, setDraft] = useState<TerminalPrefs>(terminalPrefs);

  useEffect(() => {
    if (!open) return;
    setSection("terminal");
    setDraft(terminalPrefs);
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

        <div className="settings__nav" role="tablist" aria-label="Settings sections">
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
                <div className="settings__theme-grid" role="group" aria-label="Terminal theme">
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
                <span style={{ color: previewTheme.yellow }}>&quot;preview&quot;</span>
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
                  {session.kind === "local" ? (
                    <IconLock size={18} stroke={1.75} />
                  ) : (
                    <IconUser size={18} stroke={1.75} />
                  )}
                </span>
                <div>
                  <p className="settings__account-title">
                    {session.kind === "local" ? "Local mode" : "Signed in"}
                  </p>
                  <p className="settings__account-meta">
                    {session.kind === "local"
                      ? "Data stays on this device. Account sync is coming soon."
                      : `Signed in as ${session.username}`}
                  </p>
                </div>
              </div>

              <label className="dialog__field" htmlFor="account-username">
                <span>Username</span>
                <input
                  id="account-username"
                  type="text"
                  value={session.kind === "account" ? session.username : ""}
                  placeholder="Not signed in"
                  disabled
                />
              </label>

              <label className="dialog__field" htmlFor="account-email">
                <span>Email</span>
                <input
                  id="account-email"
                  type="email"
                  value=""
                  placeholder="Coming soon"
                  disabled
                />
              </label>

              <div className="settings__account-actions">
                <button type="button" className="inventory__btn" disabled>
                  <span>Change password</span>
                </button>
                <button type="button" className="inventory__btn" disabled>
                  <span>Manage sync</span>
                </button>
              </div>
              <p className="settings__hint">
                Account management UI is ready — server sync arrives in a later
                release.
              </p>
            </div>
          ) : null}

          {section === "about" ? (
            <div className="settings__section settings__section--about">
              <p className="settings__about-name">{APP_NAME}</p>
              <p className="settings__about-version">Version {APP_VERSION}</p>
              <p className="settings__hint">
                Termius-like SSH connection manager for your local and remote
                shells.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
