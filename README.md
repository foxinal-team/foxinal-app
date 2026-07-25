# Foxinal

SSH connection manager for your desktop. Organize hosts in nested groups, open multi-tab local shells and SSH sessions, and keep everything on-device for now.

> **Status:** early / in progress. Built with Tauri 2 + React. Grab installers from [Releases](https://github.com/foxinal-team/foxinal-app/releases).

<p align="center">
  <img src="public/foxinal-icon.png" alt="Foxinal" width="96" height="96" />
</p>

## Download (macOS)

Builds are **not Apple-signed** yet (no Developer Program). Gatekeeper may say the app is *damaged* or block it after download — that is normal for unsigned apps, not a corrupt file.

1. Open the latest [Release](https://github.com/foxinal-team/foxinal-app/releases).
2. Pick the right DMG for your Mac:
   - **Apple Silicon** (M series): `foxinal_*_aarch64.dmg`
   - **Intel Mac**: `foxinal_*_x64.dmg`
3. Open the DMG and drag **foxinal** into **Applications**.
4. Clear the quarantine flag, then open the app normally (double-click):

```bash
xattr -cr /Applications/foxinal.app
```

If macOS still blocks it: right-click the app → **Open** → **Open**.

**Linux:** use the `.AppImage` (then `chmod +x` and run), or install the `.deb` / `.rpm` from the same release.

## Features

- **Local-first** — opens straight into the app; no account required
- **Optional master password** — encrypts inventory (AES-GCM); unlock screen on launch
- **Lock prefs** — optional auto-lock on idle, and lock when the app is hidden/unfocused
- **Nested inventory** — groups and SSH hosts with search, list/grid layout, and A–Z sorting
- **Multi-tab sessions** — local OS terminal and SSH tabs stay alive while you switch or visit the dashboard
- **SSH auth** — password (auto-typed at prompt) or private key
- **Drag-and-drop** — move hosts/groups with the grip handle; drop on a group or breadcrumb
- **SFTP** — dual-pane local/remote file browser with drag-and-drop transfers
- **Import / export** — JSON inventory (whole tree or current group subtree)
- **Settings** — terminal font, size, and theme (Match app / Dark / Light / Fox)

## Stack

| Layer | Tech |
|-------|------|
| App shell | [Tauri 2](https://tauri.app/) + Rust |
| UI | React 19, TypeScript, Vite 7 |
| Terminal | xterm.js + `tauri-plugin-pty` |
| Package manager | [pnpm](https://pnpm.io/) |

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS) and [pnpm](https://pnpm.io/installation)
- [Rust](https://www.rust-lang.org/tools/install) toolchain
- Tauri platform deps for your OS — see [Tauri prerequisites](https://tauri.app/start/prerequisites/)
- `ssh` available on `PATH` (used for remote sessions)

## Setup

```bash
git clone https://github.com/foxinal-team/foxinal-app.git
cd foxinal
pnpm install
```

## Development

```bash
# Full app — required for terminal / SSH (PTY)
pnpm tauri dev
```

Frontend-only Vite (`pnpm dev`) runs the UI at `http://localhost:1420`, but terminal and SSH will not work without Tauri.

## Build

```bash
pnpm tauri build
```

Installers land under `src-tauri/target/release/bundle/`.

## Usage notes

- Master password (optional) encrypts inventory with AES-GCM (`foxinal-inventory-vault`). Without it, inventory stays plaintext in `foxinal-inventory`.
- Settings → Account → Security also controls **auto-lock** and **lock when hidden/unfocused** (off by default; require a master password).
- Double-click a **group** to open it; double-click a **host** to connect in a new tab.
- Drag from the **grip** on a row to nest under another group or move via breadcrumbs.
- Regenerate app icons from the master art: `pnpm tauri icon app-icon.png`

## Roadmap

- Server sync
- OS keychain integration
- Host key verification UX
- Jump hosts
- Recovery key for forgotten master password

## License

Proprietary / undecided — update this section when you publish a license.
