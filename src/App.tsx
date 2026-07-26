import {
  IconLock,
  IconLogin2,
} from "@tabler/icons-react";
import { type FormEvent, useState } from "react";
import { Atmosphere } from "@/components/Atmosphere";
import { BrandMark } from "@/components/BrandMark";
import { Dashboard } from "@/components/Dashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/useTheme";
import { loadInventory } from "@/inventory/store";
import type { InventoryItem } from "@/inventory/types";
import { toast } from "@/lib/toast";
import { hasMasterPassword } from "@/security/masterPassword";
import { loadSecurityPrefs, type SecurityPrefs } from "@/security/prefs";
import { unlockApp } from "@/security/session";
import { APP_VERSION } from "@/lib/version";

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
      toast.error("Enter your master password.");
      return;
    }

    setBusy(true);
    try {
      const result = await unlockApp(password);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
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
    <main className="relative isolate box-border flex h-full min-h-full flex-col items-center overflow-x-hidden overflow-y-auto px-[clamp(1.25rem,4vw,2.5rem)] py-[clamp(1.25rem,4vw,2.5rem)]">
      <Atmosphere variant="fixed" />

      <ThemeToggle
        theme={theme}
        label={themeLabel}
        onCycle={cycleTheme}
        className="fixed top-[clamp(1rem,3vw,1.5rem)] right-[clamp(1rem,3vw,1.5rem)] z-2"
      />

      <section className="relative z-1 my-auto flex w-[min(100%,24.5rem)] shrink-0 flex-col gap-7 motion-safe:animate-panel-rise">
        <header className="text-center">
          <p className="m-0 inline-flex items-center justify-center gap-3 font-(family-name:--font-brand) text-[clamp(2.4rem,7vw,3rem)] leading-none font-bold tracking-[-0.045em] text-ink motion-safe:animate-brand-settle">
            <BrandMark className="size-[clamp(2.5rem,7vw,3rem)] shrink-0 rounded-[22%] shadow-[0_10px_28px_color-mix(in_srgb,var(--fox)_30%,transparent),0_1px_0_oklch(1_0_0_/_0.35)_inset]" />
            <span>foxinal</span>
          </p>
          <p className="mt-3.5 mb-0 text-base font-medium tracking-[-0.01em] text-ink-muted">
            SSH connections, organized.
          </p>
        </header>

        <div className="rounded-lg border border-line bg-surface p-7 shadow-(--panel-shadow) backdrop-blur-[var(--blur-md)]">
          <div className="mb-5">
            <h1 className="m-0 font-(family-name:--font-brand) text-xl font-bold tracking-tight text-ink">
              Unlock
            </h1>
            <p className="mt-1.5 mb-0 text-[0.9rem] leading-snug text-ink-muted">
              Enter your master password to decrypt your inventory and open
              Foxinal.
            </p>
          </div>

          <form
            className="flex flex-col gap-4"
            onSubmit={handleUnlock}
            noValidate
            aria-busy={busy || undefined}
          >
            <div className="flex flex-col gap-1.5 text-left text-[0.8125rem] font-semibold text-ink">
              <Label htmlFor="master-password">Master password</Label>
              <span className="flex min-h-11 w-full items-center gap-2.5 rounded-sm border border-line bg-[var(--field-bg)] px-3.5 transition-[border-color,background-color,box-shadow] duration-150 ease-[var(--ease-fox)] hover:bg-[var(--field-bg-hover)] focus-within:border-fox/55 focus-within:bg-[var(--field-bg-focus)] focus-within:shadow-[0_0_0_3px_var(--ring)]">
                <IconLock
                  className="shrink-0 text-ink-muted pointer-events-none"
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
                  className="h-auto flex-1 border-0 bg-transparent px-0 py-[0.7rem] font-medium shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </span>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="mt-0.5 h-11 w-full text-[0.95rem] font-bold tracking-tight active:scale-[0.985]"
            >
              <IconLogin2 size={18} stroke={1.75} aria-hidden />
              <span>{busy ? "Unlocking…" : "Unlock"}</span>
            </Button>
          </form>
        </div>

        <p className="mt-4 mb-0 pb-1 text-center text-[0.78rem] font-semibold tracking-wide text-ink-muted tabular-nums">
          v{APP_VERSION}
        </p>
      </section>
    </main>
  );
}

export default App;
