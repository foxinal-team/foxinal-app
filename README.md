# Foxinal

SSH connection manager for your desktop. Organize hosts in nested groups, open multi-tab local shells and SSH sessions, and keep everything on-device for now.

> **Status:** early / in progress (`v0.1.0`). Built with Tauri 2 + React.

<p align="center">
  <img src="public/foxinal-icon.png" alt="Foxinal" width="96" height="96" />
</p>

## Features

- **Local or account login** — continue without credentials, or sign in with env-configured credentials (placeholder for future sync)
- **Nested inventory** — groups and SSH hosts with search, list/grid layout, and A–Z sorting
- **Multi-tab sessions** — local OS terminal and SSH tabs stay alive while you switch or visit the dashboard
- **SSH auth** — password (auto-typed at prompt) or private key
- **Drag-and-drop** — move hosts/groups with the grip handle; drop on a group or breadcrumb
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
cp .env.example .env
```

Optional `.env` (defaults shown in `.env.example`):

```env
VITE_DEFAULT_USERNAME=admin
VITE_DEFAULT_PASSWORD=admin
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

- Inventory is stored in `localStorage` (`foxinal-inventory`). Host secrets are stored in plaintext for now — do not use this for production credentials yet.
- Double-click a **group** to open it; double-click a **host** to connect in a new tab.
- Drag from the **grip** on a row to nest under another group or move via breadcrumbs.
- Regenerate app icons from the master art: `pnpm tauri icon app-icon.png`

## Roadmap

- Server sync for account mode
- OS keychain / vault for secrets
- Host key verification UX
- Jump hosts

## License

Proprietary / undecided — update this section when you publish a license.
