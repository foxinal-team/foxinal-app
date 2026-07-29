<p align="center">
  <img src="public/foxinal-icon.png" alt="Foxinal" width="112" height="112" />
</p>

<h1 align="center">Foxinal</h1>

<p align="center">
  <strong>SSH connections, organized.</strong><br />
  Local-first desktop app for nested host groups, multi-tab terminals, and SFTP.
</p>

<p align="center">
  <a href="https://github.com/foxinal-team/foxinal-app/releases/latest"><img src="https://img.shields.io/github/v/release/foxinal-team/foxinal-app?style=flat-square&color=ea580c&label=latest" alt="Latest release" /></a>
  <a href="https://github.com/foxinal-team/foxinal-app/releases"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-111827?style=flat-square" alt="Platforms: macOS and Linux" /></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/built%20with-Tauri%202-24c8db?style=flat-square" alt="Built with Tauri 2" /></a>
</p>

<p align="center">
  <a href="https://github.com/foxinal-team/foxinal-app/releases/latest"><b>Download latest release</b></a>
  ·
  <a href="#features">Features</a>
  ·
  <a href="#development">Development</a>
</p>

---

Foxinal keeps your inventory **on this device** — no account required. Open local shells and SSH sessions in tabs, browse files over SFTP, and optionally lock everything behind a master password.

> **Status:** early / in progress. Grab installers from [Releases](https://github.com/foxinal-team/foxinal-app/releases). Draft CI builds are not listed under “latest” until published.

## Download

Installers ship for **macOS** and **Linux** from the same release page.

| Platform | What to get | Notes |
|----------|-------------|--------|
| **macOS** Apple Silicon (M series) | `foxinal_*_aarch64.dmg` | Not Apple-signed yet — see Gatekeeper steps below |
| **macOS** Intel | `foxinal_*_x64.dmg` | Same as above |
| **Linux** (portable) | `foxinal_*_amd64.AppImage` | `chmod +x` then run |
| **Linux** Debian/Ubuntu | `foxinal_*_amd64.deb` | `sudo dpkg -i …` |
| **Linux** Fedora/RHEL | `foxinal_*-*.x86_64.rpm` | `sudo rpm -i …` |

Windows builds are not published yet.

### macOS install

Builds are **not Apple-signed** (no Developer Program). Gatekeeper may say the app is *damaged* or blocked after download — that is normal for unsigned apps, not a corrupt file.

1. Open the [latest release](https://github.com/foxinal-team/foxinal-app/releases/latest).
2. Download the DMG that matches your Mac (**aarch64** or **x64**).
3. Open the DMG and drag **foxinal** into **Applications**.
4. Clear the quarantine flag, then open the app normally:

```bash
xattr -cr /Applications/foxinal.app
```

If macOS still blocks it: right-click the app → **Open** → **Open**.

### Linux install

1. Open the [latest release](https://github.com/foxinal-team/foxinal-app/releases/latest).
2. Choose **AppImage**, **.deb**, or **.rpm**.
3. For AppImage:

```bash
chmod +x foxinal_*_amd64.AppImage
./foxinal_*_amd64.AppImage
```

## Features

- **Local-first** — opens straight into the app; no cloud account
- **Optional master password** — AES-GCM encrypted inventory; unlock on launch
- **Lock prefs** — auto-lock on idle; lock when the app is hidden
- **Nested inventory** — groups + hosts, search, list/grid, A–Z sort, import/export JSON
- **Multi-tab sessions** — local terminal and SSH tabs stay alive while you switch views
- **SSH auth** — password (auto-typed at the prompt) or private key
- **Host keys** — Foxinal-managed `known_hosts`; trust & retry when a key changes
- **SFTP** — dual-pane browser, rename/mkdir/delete, drag-and-drop transfers
- **Updates** — in-app “check for updates” opens the GitHub release (no auto-install)
- **Settings** — terminal font, size, and theme (Match app / Dark / Light / Fox)

## Stack

| Layer | Tech |
|-------|------|
| App shell | [Tauri 2](https://tauri.app/) + Rust |
| UI | React 19, TypeScript, Vite 7, [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) |
| Terminal | xterm.js + `tauri-plugin-pty` |
| Package manager | [pnpm](https://pnpm.io/) |

### Frontend layout

- `src/components/ui/` — shadcn primitives (`pnpm dlx shadcn@latest add <name>`)
- `src/components/` — app shell (`Dashboard`, `TerminalView`, `BrandMark`, …)
- `src/hooks/` — `useTheme`, `useLockGuards`
- `src/lib/` — `utils` (`cn`), `sessions`, `version`, `updates`, `toast`
- `src/index.css` — Tailwind + Foxinal tokens
- Feature modules: `inventory/`, `settings/`, `sftp/`, `security/`
- Path alias: `@/` → `src/`

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS) and [pnpm](https://pnpm.io/installation)
- [Rust](https://www.rust-lang.org/tools/install) toolchain
- Tauri platform deps — see [Tauri prerequisites](https://tauri.app/start/prerequisites/)
- `ssh` on `PATH` (used for remote sessions)

## Setup

```bash
git clone https://github.com/foxinal-team/foxinal-app.git
cd foxinal-app
pnpm install
```

## Development

```bash
# Full app — required for terminal / SSH (PTY)
pnpm tauri dev
```

`pnpm dev` runs the UI only at `http://localhost:1420` — terminal and SSH need Tauri.

## Build

```bash
pnpm tauri build
```

Installers land under `src-tauri/target/release/bundle/`.

## Usage notes

- Master password (optional) encrypts inventory (`foxinal-inventory-vault`). Without it, data stays in plaintext `foxinal-inventory`.
- Settings → Security controls **auto-lock** and **lock when hidden** (need a master password).
- **Double-click** a group to open it, or a host to connect.
- Drag from the **grip** to nest under another group or drop on breadcrumbs.
- Regenerate icons: `pnpm tauri icon app-icon.png`

## Roadmap

- Windows builds
- Server sync
- OS keychain
- Richer host-key UX (fingerprint prompt)
- Jump hosts
- Recovery key for forgotten master password
- Optional in-app updater (`tauri-plugin-updater`)

## License

Proprietary / undecided — update this section when you publish a license.
