# Terminal & PTY Subsystem

Foxinal integrates terminal emulation with native OS pseudo-terminals (PTY) to run local shells and remote SSH connections seamlessly.

---

## Technical Stack

- **Frontend Terminal**: [`@xterm/xterm`](https://github.com/xtermjs/xterm.js) with `@xterm/addon-fit` for dynamic responsive resizing.
- **Backend PTY**: Embedded Rust plugin crate `crates/tauri-plugin-pty` using platform-native PTY bindings (`portable-pty` / `pty-process`).
- **Communication Protocol**: Bidirectional data streaming over Tauri events and IPC commands.

---

## Session Types

### 1. Local Shell Sessions
- Discovers the default system shell via the `default_shell` Tauri command:
  - macOS: `/bin/zsh` (or `$SHELL`)
  - Linux: `/bin/bash` (or `$SHELL`)
  - Windows: `powershell.exe`
- Spawns the native shell directly in a PTY with clean environment variables.

### 2. Remote SSH Sessions
When a host connection is initiated:
1. **Prepare Launch (`prepare_ssh_launch`)**:
   - Rust verifies host, port, and username.
   - Generates isolated SSH arguments:
     - `StrictHostKeyChecking=accept-new`
     - `UserKnownHostsFile=<app_data_dir>/ssh_known_hosts`
     - `GlobalKnownHostsFile=/dev/null` (or `NUL` on Windows)
     - `ServerAliveInterval=30`, `ServerAliveCountMax=3`, `TCPKeepAlive=yes`
     - `-tt` to enforce pseudo-terminal allocation.
2. **Authentication Handling**:
   - **Key-based Auth**: Private key is written to a temporary file with restricted permissions (`0600` on Unix), passed via `-i <path>`, and deleted once launched using `cleanup_ssh_temp`.
   - **Password Auth**: Native password prompts detected by `TerminalView.tsx` automatically inject stored credentials or prompt the user.
3. **Host Key Changes**:
   - If a host key changes, Foxinal provides in-app recovery via `clear_ssh_host_key` to remove outdated signatures from `ssh_known_hosts`.

---

## Terminal Configuration & Preferences

Terminal styling and behavior is configured in [`src/settings/terminalPrefs.ts`](file:///Users/danial/Documents/Projects/foxinal/src/settings/terminalPrefs.ts):
- **Themes**: Built-in dark/light palettes, customized foreground/background, cursor color, and ANSI 16-color palette.
- **Typography**: Custom font families (e.g. `Space Grotesk`, JetBrains Mono, Fira Code), font size, line height, font weight.
- **Behavior**: Cursor style (block, underline, bar), cursor blinking, scrollback buffer length, copy-on-select, and paste formatting.

---

## Related Documentation
- [System Architecture](file:///Users/danial/Documents/Projects/foxinal/docs/architecture.md)
- [Security & Vault](file:///Users/danial/Documents/Projects/foxinal/docs/security-and-vault.md)
