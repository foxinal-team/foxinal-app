import {
  IconDeviceDesktop,
  IconLock,
  IconLogin2,
  IconUser,
} from "@tabler/icons-react";
import { type FormEvent, useState } from "react";
import "./App.css";
import { credentialsMatch } from "./auth";
import { BrandMark } from "./BrandMark";
import { Dashboard } from "./Dashboard";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./useTheme";

export type AppSession =
  | { kind: "account"; username: string }
  | { kind: "local" };

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<AppSession | null>(null);
  const { theme, cycleTheme, label: themeLabel } = useTheme();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your username and password to continue.");
      return;
    }

    if (!credentialsMatch(username, password)) {
      setError("Invalid username or password.");
      return;
    }

    setSession({ kind: "account", username: username.trim() });
    setPassword("");
  }

  function continueLocally() {
    setError("");
    setPassword("");
    setSession({ kind: "local" });
  }

  function handleSignOut() {
    setSession(null);
    setUsername("");
    setPassword("");
    setError("");
  }

  if (session) {
    return (
      <Dashboard
        session={session}
        onSignOut={handleSignOut}
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
            <h1 className="login__headline">Sign in</h1>
            <p className="login__lede">
              Sync is coming soon. Until then, sign in or continue on this device.
            </p>
          </div>

          <form className="login__form" onSubmit={handleSubmit} noValidate>
            <label className="login__field" htmlFor="username">
              <span>Username</span>
              <span className="login__input-wrap">
                <IconUser
                  className="login__input-icon"
                  size={18}
                  stroke={1.75}
                  aria-hidden
                />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.currentTarget.value)}
                  placeholder="Enter username"
                />
              </span>
            </label>

            <label className="login__field" htmlFor="password">
              <span>Password</span>
              <span className="login__input-wrap">
                <IconLock
                  className="login__input-icon"
                  size={18}
                  stroke={1.75}
                  aria-hidden
                />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                />
              </span>
            </label>

            {error ? (
              <p className="login__message login__message--error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="login__submit" type="submit">
              <IconLogin2 size={18} stroke={1.75} aria-hidden />
              <span>Sign in</span>
            </button>
          </form>

          <div className="login__divider" role="separator">
            <span>or</span>
          </div>

          <button
            type="button"
            className="login__local"
            onClick={continueLocally}
          >
            <IconDeviceDesktop size={18} stroke={1.75} aria-hidden />
            <span>Continue locally</span>
          </button>
          <p className="login__local-note">
            Local data only — nothing leaves this app instance.
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
