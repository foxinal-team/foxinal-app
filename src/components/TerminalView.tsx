import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { spawn, type IPty } from "tauri-pty";
import {
  IconPlugConnected,
  IconTerminal2,
  IconX,
} from "@tabler/icons-react";
import { ConnectionOverlay } from "@/components/ConnectionOverlay";
import { Button } from "@/components/ui/button";
import { hostSummary } from "@/inventory/types";
import type { TerminalSession } from "@/lib/sessions";
import { cn } from "@/lib/utils";
import {
  fontFamilyForId,
  resolveTerminalTheme,
  type TerminalPrefs,
} from "@/settings/terminalPrefs";
import "@xterm/xterm/css/xterm.css";
import "@/styles/xterm-host.css";

export type { TerminalSession };

type SshLaunch = {
  program: string;
  args: string[];
  env: Record<string, string>;
  cleanupPaths: string[];
};

type ConnPhase = "connecting" | "ready" | "error";

type TerminalViewProps = {
  session: TerminalSession;
  /** Stable tab id — keeps each PTY instance independent across remounts. */
  sessionId: string;
  active?: boolean;
  onCloseSession?: () => void;
  terminalPrefs: TerminalPrefs;
  appTheme: string;
};

const SSH_ERROR_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /permission denied/i, label: "Permission denied" },
  { re: /authentication failed/i, label: "Authentication failed" },
  { re: /too many authentication failures/i, label: "Too many authentication failures" },
  { re: /connection refused/i, label: "Connection refused" },
  { re: /connection timed out|operation timed out/i, label: "Connection timed out" },
  { re: /could not resolve hostname/i, label: "Could not resolve hostname" },
  { re: /no route to host/i, label: "No route to host" },
  { re: /network is unreachable/i, label: "Network is unreachable" },
  { re: /host key verification failed/i, label: "Host key verification failed" },
  { re: /connection reset by peer/i, label: "Connection reset" },
  { re: /connection closed by/i, label: "Connection closed by remote host" },
  { re: /broken pipe/i, label: "Connection lost" },
  { re: /client_loop:\s*send disconnect/i, label: "Connection lost" },
];

const CONNECT_TIMEOUT_MS = 45_000;
const CONNECT_LOG_MAX = 12_000;

function decodePtyChunk(data: string | Uint8Array): string {
  if (typeof data === "string") return data;
  return new TextDecoder().decode(data);
}

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function formatConnectionLog(raw: string): string {
  return stripAnsi(raw)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

async function writeClipboardText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to native clipboard (needed in some Tauri webviews).
  }
  await invoke("clipboard_write_text", { text });
}

async function readClipboardText(): Promise<string> {
  try {
    const text = await navigator.clipboard.readText();
    if (text) return text;
  } catch {
    // Fall through.
  }
  return invoke<string>("clipboard_read_text");
}

function isCopyChord(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase();
  if (e.metaKey && !e.ctrlKey && !e.altKey && key === "c") return true;
  if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && key === "c") {
    return true;
  }
  if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key === "Insert") {
    return true;
  }
  return false;
}

function isPasteChord(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase();
  if (e.metaKey && !e.ctrlKey && !e.altKey && key === "v") return true;
  if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && key === "v") {
    return true;
  }
  if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && e.key === "Insert") {
    return true;
  }
  return false;
}

function looksLikePasswordPrompt(buffer: string): boolean {
  const text = stripAnsi(buffer).replace(/\r/g, "");
  return /(?:password|passphrase)[^:\n]*:\s*$/i.test(text);
}

function extractSshError(buffer: string): string | null {
  const text = stripAnsi(buffer);
  for (const { re, label } of SSH_ERROR_PATTERNS) {
    if (!re.test(text)) continue;
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const hit = [...lines].reverse().find((line) => re.test(line));
    return hit || label;
  }
  return null;
}

function looksLikeShellReady(buffer: string): boolean {
  const text = stripAnsi(buffer).replace(/\r/g, "");
  if (looksLikePasswordPrompt(text)) return false;
  if (extractSshError(text)) return false;

  const trimmed = text.trimEnd();
  if (/[%$#~>]\s*$/.test(trimmed)) return true;

  const lines = trimmed.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return false;
  const last = lines[lines.length - 1];
  return /[%$#~>]\s*$/.test(last) || /@[^:\s]+:[^\n]*[#$]\s*$/.test(last);
}

export function TerminalView({
  session,
  sessionId,
  active = true,
  onCloseSession,
  terminalPrefs,
  appTheme,
}: TerminalViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<IPty | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const prefsRef = useRef(terminalPrefs);
  const appThemeRef = useRef(appTheme);
  prefsRef.current = terminalPrefs;
  appThemeRef.current = appTheme;
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<ConnPhase>(
    session.kind === "local" ? "ready" : "connecting",
  );
  const [error, setError] = useState<string | null>(null);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  /** True once an SSH session reached ready — exit then means reconnect, not first-connect retry. */
  const [canReconnect, setCanReconnect] = useState(false);

  // One PTY lifecycle per tab — never share keys across local shells or same-host SSH tabs.
  const sessionKey = sessionId;

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;

    let disposed = false;
    let pty: IPty | null = null;
    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cleanupPaths: string[] = [];
    let connectTimer: number | undefined;
    let readyTimer: number | undefined;
    const disposables: Array<{ dispose: () => void }> = [];

    const isSsh = session.kind === "ssh";
    setPhase(isSsh ? "connecting" : "ready");
    setError(null);
    setErrorLog(null);
    setCanReconnect(false);

    function markReady() {
      if (disposed) return;
      window.clearTimeout(connectTimer);
      window.clearTimeout(readyTimer);
      setPhase("ready");
      setError(null);
      setErrorLog(null);
      if (isSsh) setCanReconnect(true);
    }

    function markError(
      message: string,
      reconnectable = false,
      log: string | null = null,
    ) {
      if (disposed) return;
      window.clearTimeout(connectTimer);
      window.clearTimeout(readyTimer);
      setPhase("error");
      setError(message);
      const formatted = log ? formatConnectionLog(log) : "";
      setErrorLog(
        formatted ||
          (message.trim()
            ? message.trim()
            : "No connection output was captured."),
      );
      if (reconnectable) setCanReconnect(true);
    }

    async function start() {
      try {
        let program: string;
        let args: string[] = [];
        let extraEnv: Record<string, string> = {};

        if (session.kind === "local") {
          program = await invoke<string>("default_shell");
        } else {
          const launch = await invoke<SshLaunch>("prepare_ssh_launch", {
            address: session.host.address,
            port: session.host.port,
            username: session.host.username,
            authMethod: session.host.authMethod,
            privateKey: session.host.privateKey,
          });
          program = launch.program;
          args = launch.args;
          extraEnv = launch.env ?? {};
          cleanupPaths = launch.cleanupPaths ?? [];
        }

        if (disposed || !hostEl) return;

        const prefs = prefsRef.current;
        term = new Terminal({
          cursorBlink: true,
          fontFamily: fontFamilyForId(prefs.fontId),
          fontSize: prefs.fontSize,
          scrollback: 5000,
          theme: resolveTerminalTheme(prefs.theme, appThemeRef.current),
          allowProposedApi: true,
        });
        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(hostEl);
        fitAddon.fit();
        termRef.current = term;
        fitRef.current = fitAddon;

        const savedPassword =
          session.kind === "ssh" &&
          session.host.authMethod === "password" &&
          session.host.password
            ? session.host.password
            : null;
        let outputBuffer = "";
        let passwordSent = false;
        let settled = !isSsh;

        if (isSsh) {
          connectTimer = window.setTimeout(() => {
            if (!settled) {
              settled = true;
              markError(
                "Connection timed out. Check the host and try again.",
                false,
                outputBuffer ||
                  "No output received before the connection timed out.",
              );
            }
          }, CONNECT_TIMEOUT_MS);
        }

        pty = spawn(program, args, {
          cols: term.cols,
          rows: term.rows,
          env: {
            TERM: "xterm-256color",
            COLORTERM: "truecolor",
            ...extraEnv,
          },
        });
        ptyRef.current = pty;

        const writePaste = (text: string) => {
          if (!text || disposed || !pty) return;
          // Terminals expect CR for line breaks.
          pty.write(text.replace(/\r\n/g, "\r").replace(/\n/g, "\r"));
        };

        // Prefer browser `paste` (clipboardData). Only fall back to native
        // clipboard if no paste event arrives — arboard can hang the UI on Linux
        // when called on every Ctrl+Shift+V.
        let pasteFallbackTimer: number | undefined;
        let expectPasteEvent = false;

        const onBrowserPaste = (e: Event) => {
          const ev = e as ClipboardEvent;
          ev.preventDefault();
          ev.stopPropagation();
          const text = ev.clipboardData?.getData("text/plain") ?? "";
          if (!text) return;
          expectPasteEvent = false;
          window.clearTimeout(pasteFallbackTimer);
          writePaste(text);
        };

        const pasteTarget =
          (term as { textarea?: HTMLTextAreaElement | null }).textarea ??
          hostEl;
        pasteTarget.addEventListener("paste", onBrowserPaste, true);
        disposables.push({
          dispose: () => {
            expectPasteEvent = false;
            window.clearTimeout(pasteFallbackTimer);
            pasteTarget.removeEventListener("paste", onBrowserPaste, true);
          },
        });

        // Linux/Windows: Ctrl+Shift+C/V · macOS: ⌘C/⌘V · also Ctrl/Shift+Insert.
        term.attachCustomKeyEventHandler((ev) => {
          if (ev.type !== "keydown") return true;

          if (isCopyChord(ev)) {
            const selection = term?.getSelection() ?? "";
            if (selection) {
              void writeClipboardText(selection).catch(() => undefined);
            }
            return false;
          }

          if (isPasteChord(ev)) {
            expectPasteEvent = true;
            window.clearTimeout(pasteFallbackTimer);
            pasteFallbackTimer = window.setTimeout(() => {
              if (!expectPasteEvent || disposed) return;
              expectPasteEvent = false;
              void readClipboardText()
                .then((text) => {
                  if (!disposed) writePaste(text);
                })
                .catch(() => undefined);
            }, 50);
            return false;
          }

          return true;
        });

        disposables.push(
          pty.onData((data) => {
            term?.write(data);

            if (!isSsh) return;

            outputBuffer = (outputBuffer + decodePtyChunk(data)).slice(
              -CONNECT_LOG_MAX,
            );

            if (
              savedPassword &&
              !passwordSent &&
              looksLikePasswordPrompt(outputBuffer)
            ) {
              passwordSent = true;
              window.setTimeout(() => {
                if (!disposed && pty) {
                  pty.write(`${savedPassword}\n`);
                }
              }, 30);
              return;
            }

            if (settled) return;

            const sshError = extractSshError(outputBuffer);
            if (sshError) {
              settled = true;
              markError(sshError, false, outputBuffer);
              return;
            }

            if (looksLikeShellReady(outputBuffer)) {
              settled = true;
              markReady();
              return;
            }

            // After auth starts, treat a short burst of non-error output as connected.
            if (
              passwordSent ||
              (session.kind === "ssh" && session.host.authMethod === "key")
            ) {
              window.clearTimeout(readyTimer);
              readyTimer = window.setTimeout(() => {
                if (disposed || settled) return;
                const lateError = extractSshError(outputBuffer);
                if (lateError) {
                  settled = true;
                  markError(lateError, false, outputBuffer);
                  return;
                }
                if (outputBuffer.trim().length > 0) {
                  settled = true;
                  markReady();
                }
              }, 450);
            }
          }),
        );
        disposables.push(
          term.onData((data) => {
            pty?.write(data);
          }),
        );
        disposables.push(
          pty.onExit(({ exitCode }) => {
            term?.writeln(`\r\n[process exited with code ${exitCode}]`);
            if (!isSsh) return;

            const exitNote = `\n[process exited with code ${exitCode}]`;
            const log = `${outputBuffer}${exitNote}`;

            if (!settled) {
              settled = true;
              const sshError = extractSshError(outputBuffer);
              markError(
                sshError ||
                  (exitCode === 0
                    ? "Connection closed before the session was ready."
                    : `Connection failed (exit ${exitCode}).`),
                false,
                log,
              );
              return;
            }

            // Session was live — offer reconnect instead of a dead terminal.
            const sshError = extractSshError(outputBuffer);
            markError(
              sshError ||
                (exitCode === 0
                  ? "Session ended."
                  : `Connection lost (exit ${exitCode}).`),
              true,
              log,
            );
          }),
        );

        const syncSize = () => {
          if (!term || !fitAddon || !pty) return;
          fitAddon.fit();
          pty.resize(term.cols, term.rows);
        };

        resizeObserver = new ResizeObserver(() => syncSize());
        resizeObserver.observe(hostEl);
        window.addEventListener("resize", syncSize);
        disposables.push({
          dispose: () => window.removeEventListener("resize", syncSize),
        });

        if (!isSsh) {
          term.focus();
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Could not start the session. Run the app with `pnpm tauri dev`.";
        markError(message, false, message);
      }
    }

    void start();

    return () => {
      disposed = true;
      window.clearTimeout(connectTimer);
      window.clearTimeout(readyTimer);
      resizeObserver?.disconnect();
      for (const d of disposables) d.dispose();
      try {
        pty?.kill();
      } catch {
        // PTY may already be closed.
      }
      term?.dispose();
      termRef.current = null;
      fitRef.current = null;
      ptyRef.current = null;
      if (cleanupPaths.length > 0) {
        void invoke("cleanup_ssh_temp", { paths: cleanupPaths }).catch(
          () => undefined,
        );
      }
    };
  }, [sessionKey, attempt]);

  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitRef.current;
    const pty = ptyRef.current;
    if (!term) return;

    term.options.fontFamily = fontFamilyForId(terminalPrefs.fontId);
    term.options.fontSize = terminalPrefs.fontSize;
    term.options.theme = resolveTerminalTheme(terminalPrefs.theme, appTheme);

    requestAnimationFrame(() => {
      if (!fitAddon) return;
      fitAddon.fit();
      if (pty) pty.resize(term.cols, term.rows);
    });
  }, [terminalPrefs, appTheme]);

  useEffect(() => {
    if (!active || phase !== "ready") return;
    const fitAddon = fitRef.current;
    const pty = ptyRef.current;
    const term = termRef.current;
    if (!fitAddon || !pty || !term) return;

    requestAnimationFrame(() => {
      fitAddon.fit();
      pty.resize(term.cols, term.rows);
      term.focus();
    });
  }, [active, phase, attempt]);

  const title =
    session.kind === "local"
      ? "Local"
      : session.host.name || hostSummary(session.host);
  const subtitle =
    session.kind === "local" ? "Your OS shell" : hostSummary(session.host);
  const host = session.kind === "ssh" ? session.host : null;

  function retry() {
    setAttempt((n) => n + 1);
  }

  const errorTitle = canReconnect ? "Disconnected" : "Connection failed";
  const isHostKeyError =
    !!error && /host key verification failed/i.test(error);
  const errorMessage = isHostKeyError
    ? "This host’s SSH key is new or has changed. Trust it only if you expect that (reinstall, rebuild, or IP reuse)."
    : error ||
      (canReconnect
        ? "The SSH session ended. Reconnect to continue."
        : "Something went wrong while connecting.");
  const retryLabel = canReconnect ? "Reconnect" : "Retry";

  async function trustHostAndRetry() {
    if (session.kind !== "ssh") {
      retry();
      return;
    }
    try {
      await invoke("clear_ssh_host_key", {
        address: session.host.address,
        port: session.host.port,
      });
    } catch {
      // Still retry — prepare_ssh_launch may accept-new on a clean file.
    }
    retry();
  }

  return (
    <section
      className={cn(
        "flex w-full min-h-0 flex-1 flex-col gap-[0.65rem]",
        active &&
          "motion-safe:animate-[panel-rise_0.4s_var(--ease-fox)_both]",
      )}
      aria-hidden={!active}
      inert={!active ? true : undefined}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-[0.65rem]">
          <span
            className="grid size-(--control-h) shrink-0 place-items-center rounded-(--radius-sm) bg-fox/12 text-fox"
            aria-hidden
          >
            {session.kind === "local" ? (
              <IconTerminal2 size={18} stroke={1.75} />
            ) : (
              <IconPlugConnected size={18} stroke={1.75} />
            )}
          </span>
          <div className="min-w-0">
            <p className="m-0 font-(family-name:--font-brand) text-[0.95rem] font-bold tracking-tight text-ink">
              {title}
            </p>
            <p className="m-0 mt-px overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ink-muted">
              {subtitle}
            </p>
          </div>
        </div>
        {onCloseSession ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={`Close ${title}`}
            onClick={onCloseSession}
          >
            <IconX size={16} stroke={1.75} aria-hidden />
            <span>Close</span>
          </Button>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {phase === "connecting" && host ? (
          <ConnectionOverlay
            variant="connecting"
            title="Connecting"
            hostLabel={host.name || hostSummary(host)}
            meta={hostSummary(host)}
          />
        ) : null}

        {phase === "error" ? (
          <ConnectionOverlay
            variant="error"
            title={errorTitle}
            hostLabel={
              host ? host.name || hostSummary(host) : undefined
            }
            message={errorMessage}
            logs={errorLog}
            onTrustHost={isHostKeyError ? () => void trustHostAndRetry() : undefined}
            onRetry={retry}
            retryLabel={retryLabel}
            onDismiss={onCloseSession}
          />
        ) : null}

        <div
          className={cn(
            "fox-xterm-host h-full min-h-0 flex-1 overflow-hidden rounded-md border border-line bg-surface-solid shadow-(--shadow-sm)",
            phase !== "ready" &&
              "pointer-events-none absolute inset-0 opacity-0",
          )}
          ref={hostRef}
        />
      </div>
    </section>
  );
}
