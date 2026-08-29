# Architecture & System Design

Foxinal is a local-first desktop SSH & SFTP client built on **Tauri 2** (Rust) and **React 19** (TypeScript). It delivers native performance and deep OS integration while retaining a modern web-based UI.

---

## High-Level Topology

```
+-----------------------------------------------------------------------+
|                         Frontend (Webview)                           |
|  React 19 · TypeScript · Tailwind CSS v4 · xterm.js · shadcn/ui      |
|                                                                       |
|  [Inventory Store]   [Vault / Security]   [Terminal View]   [SFTP]   |
+-----------------------------------+-----------------------------------+
                                    |
                          Tauri IPC / Events
                                    |
+-----------------------------------+-----------------------------------+
|                           Backend (Rust)                              |
|  Tauri 2 Core · tauri-plugin-pty · ssh2 · arboard · std::fs           |
|                                                                       |
|  [PTY / Shell Manager]    [SSH Launch Config]    [SFTP Engine]        |
|  [App-Scoped Known Hosts] [Clipboard Manager]    [Filesystem Bridge]  |
+-----------------------------------------------------------------------+
```

---

## Directory Structure

```
foxinal/
├── src/                          # Frontend Application Code
│   ├── components/               # Core UI Views & Overlays
│   │   ├── Dashboard.tsx         # Host/Group inventory view & navigation
│   │   ├── TerminalView.tsx      # Multi-tab xterm.js terminal emulator
│   │   ├── ConnectionOverlay.tsx # Floating connection status / loader
│   │   ├── ThemeToggle.tsx       # Dark / Light / System switcher
│   │   └── ui/                   # shadcn / Radix primitives
│   ├── inventory/                # Host & Group inventory logic
│   │   ├── store.ts              # LocalStorage inventory persistence
│   │   ├── types.ts              # Type definitions (Host, Group, Item)
│   │   ├── transfer.ts           # Import / export serializers & parsers
│   │   └── useInventory.ts       # React hook for CRUD & tree operations
│   ├── security/                 # Encryption & Vault implementation
│   │   ├── vault.ts              # AES-GCM / PBKDF2 encryption engine
│   │   ├── masterPassword.ts     # Master password validation & hash
│   │   ├── session.ts            # In-memory unlocked session state
│   │   └── prefs.ts              # Auto-lock / security settings
│   ├── settings/                 # App & Terminal Preferences
│   │   ├── SettingsDialog.tsx    # Comprehensive settings modal
│   │   └── terminalPrefs.ts      # Fonts, themes, cursor, scrollback
│   ├── sftp/                     # Dual-pane SFTP Explorer
│   │   ├── SftpView.tsx          # Dual-pane layout & state coordination
│   │   ├── SftpPane.tsx          # Single-pane filesystem / SFTP browser
│   │   ├── SftpHostPicker.tsx    # Host selection modal for SFTP
│   │   └── api.ts                # Frontend IPC wrapper for Rust SFTP
│   ├── hooks/                    # Custom React hooks (locks, themes)
│   ├── lib/                      # Utilities, updates, toast notifications
│   ├── App.tsx                   # Main root view & tab switcher
│   ├── main.tsx                  # Vite entrypoint
│   └── index.css                 # Global CSS & Tailwind v4 variables
├── src-tauri/                    # Tauri 2 Rust Backend
│   ├── src/
│   │   ├── lib.rs                # Tauri command registrations & SSH setup
│   │   ├── main.rs               # Binary entrypoint
│   │   └── sftp.rs               # SFTP session management & file transfers
│   ├── crates/
│   │   └── tauri-plugin-pty/     # Custom embedded PTY plugin crate
│   ├── capabilities/             # Tauri 2 permission capabilities
│   └── Cargo.toml                # Rust dependencies & crate configuration
├── scripts/                      # Build & release automation scripts
│   └── set-version.mjs           # Semver bumping script
├── docs/                         # Project documentation
└── AGENTS.md                     # Agent entrypoint & guidelines
```

---

## Core Subsystems

### 1. Tauri IPC Bridge
The frontend interacts with the Rust backend via Tauri's `invoke` API and listens to backend progress streams via Tauri `listen` events:
- **Terminal PTY**: Uses `tauri-plugin-pty` commands (`spawn`, `write`, `read`, `resize`, `kill`) to interact with native PTY processes.
- **SSH Launcher**: Prepares arguments, generates scoped known_hosts flags, and creates secure temporary keys.
- **SFTP Engine**: Manages concurrent remote SSH2 sessions and streams progress events (`sftp:transfer-progress`) back to the frontend.
- **System Integrations**: Native clipboard handling (`arboard`) and dialog triggers (`tauri-plugin-dialog`).

### 2. State & Persistence
- **Local-First**: All inventory data (hosts, groups) is persisted in the browser `localStorage` or encrypted inside the encrypted vault payload.
- **Session Memory**: Unlocked vault credentials remain in frontend memory during an active session and are wiped immediately upon lock or window unload.
- **Custom Known-Hosts**: Foxinal maintains its own isolated `ssh_known_hosts` file under the application data directory (`app_data_dir()`), preventing conflicts with the user's global `~/.ssh/known_hosts`.

---

## Related Documentation
- [Terminal & PTY Subsystem](file:///Users/danial/Documents/Projects/foxinal/docs/terminal-and-pty.md)
- [SFTP Subsystem](file:///Users/danial/Documents/Projects/foxinal/docs/sftp.md)
- [Security & Vault Architecture](file:///Users/danial/Documents/Projects/foxinal/docs/security-and-vault.md)
- [Inventory & Data Models](file:///Users/danial/Documents/Projects/foxinal/docs/inventory-and-data.md)
- [UI & Styling Guidelines](file:///Users/danial/Documents/Projects/foxinal/docs/ui-and-styling.md)
- [Development & Build Workflows](file:///Users/danial/Documents/Projects/foxinal/docs/development-workflow.md)
