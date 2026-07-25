import {
  IconLock,
  IconLogin2,
} from "@tabler/icons-react";
import { type FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/useTheme";
import { Dashboard } from "./Dashboard";
import { loadInventory } from "./inventory/store";
import { hasMasterPassword } from "./security/masterPassword";
import { loadSecurityPrefs, type SecurityPrefs } from "./security/prefs";
import { unlockApp } from "./security/session";
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

          <form
            className="login__form"
            onSubmit={handleUnlock}
            noValidate
            aria-busy={busy || undefined}
          >
            <div className="login__field">
              <Label htmlFor="master-password">Master password</Label>
              <span className="login__input-wrap">
                <IconLock
                  className="login__input-icon"
                  size={18}
                  stroke={1.75}
                  aria-hidden
                />
                <Input
                  id="master-password"
                  name="master-password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                  disabled={busy}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "unlock-error" : undefined}
                  className="h-auto flex-1 border-0 bg-transparent px-0 py-[0.7rem] shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </span>
            </div>

            {error ? (
              <p
                id="unlock-error"
                className="login__message login__message--error"
                role="alert"
              >
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
