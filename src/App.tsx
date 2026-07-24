import {
  IconLock,
  IconLogin2,
} from "@tabler/icons-react";
import { type FormEvent, useState } from "react";
import "./App.css";
import { BrandMark } from "./BrandMark";
import { Dashboard } from "./Dashboard";
import { loadInventory } from "./inventory/store";
import { hasMasterPassword } from "./security/masterPassword";
import { loadSecurityPrefs, type SecurityPrefs } from "./security/prefs";
import { unlockApp } from "./security/session";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./useTheme";
import { APP_VERSION } from "./version";
import type { InventoryItem } from "./inventory/types";

/** Unlocked app session — local-only until server sync exists. */
export type AppSession = { kind: "local" };

type UnlockedState = {
  vaultKey: CryptoKey | null;
  items: InventoryItem[];
};

function App() {
  const [locked, setLocked] = useState(() => hasMasterPassword());
  const [unlocked, setUnlocked] = useState<UnlockedState | null>(() => {
    if (hasMasterPassword()) return null;
    return { vaultKey: null, items: loadInventory().items };
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [securityEnabled, setSecurityEnabled] = useState(() =>
    hasMasterPassword(),
  );
  const [securityPrefs, setSecurityPrefs] = useState<SecurityPrefs>(() =>
    loadSecurityPrefs(),
  );
  const { theme, cycleTheme, label: themeLabel } = useTheme();

  function handleLock() {
    setPassword("");
    setError("");
    setUnlocked(null);
    setLocked(true);
  }

  function refreshSecurity() {
    const enabled = hasMasterPassword();
    setSecurityEnabled(enabled);
    if (!enabled) {
      setLocked(false);
      setUnlocked((prev) =>
        prev ?? { vaultKey: null, items: loadInventory().items },
      );
    }
  }

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Enter your master password.");
      return;
    }

    setBusy(true);
    try {
      const result = await unlockApp(password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPassword("");
      setUnlocked({ vaultKey: result.key, items: result.items });
      setSecurityEnabled(true);
      setLocked(false);
    } finally {
      setBusy(false);
    }
  }

  function handleVaultKeyChange(key: CryptoKey | null) {
    setUnlocked((prev) =>
      prev ? { ...prev, vaultKey: key } : { vaultKey: key, items: [] },
    );
  }

  function handleSecurityPrefsChange(prefs: SecurityPrefs) {
    setSecurityPrefs(prefs);
  }

  if (!locked && unlocked) {
    return (
      <Dashboard
        vaultKey={unlocked.vaultKey}
        initialItems={unlocked.items}
        securityEnabled={securityEnabled}
        securityPrefs={securityPrefs}
        onLock={handleLock}
        onSecurityChange={refreshSecurity}
        onVaultKeyChange={handleVaultKeyChange}
        onSecurityPrefsChange={handleSecurityPrefsChange}
        theme={theme}
        themeLabel={themeLabel}
        onCycleTheme={cycleTheme}
      />
    );
  }

  return (
    <main className="login">
      <div className="login__atmosphere" aria-hidden="true" />

      <ThemeToggle
        theme={theme}
        label={themeLabel}
        onCycle={cycleTheme}
        className="theme-toggle--float"
      />

      <section className="login__panel">
        <header className="login__header">
          <p className="login__brand">
            <BrandMark className="login__brand-mark" />
            <span>foxinal</span>
          </p>
          <p className="login__tagline">SSH connections, organized.</p>
        </header>

        <div className="login__card">
          <div className="login__card-head">
            <h1 className="login__headline">Unlock</h1>
            <p className="login__lede">
              Enter your master password to decrypt your inventory and open
              Foxinal.
            </p>
          </div>

          <form className="login__form" onSubmit={handleUnlock} noValidate>
            <label className="login__field" htmlFor="master-password">
              <span>Master password</span>
              <span className="login__input-wrap">
                <IconLock
                  className="login__input-icon"
                  size={18}
                  stroke={1.75}
                  aria-hidden
                />
                <input
                  id="master-password"
                  name="master-password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                  disabled={busy}
                />
              </span>
            </label>

            {error ? (
              <p className="login__message login__message--error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="login__submit" type="submit" disabled={busy}>
              <IconLogin2 size={18} stroke={1.75} aria-hidden />
              <span>{busy ? "Unlocking…" : "Unlock"}</span>
            </button>
          </form>
        </div>

        <p className="login__version">v{APP_VERSION}</p>
      </section>
    </main>
  );
}

export default App;
