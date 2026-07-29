<p align="center">
  <img src="public/foxinal-icon.png" alt="Foxinal" width="120" height="120" />
</p>

<h1 align="center">Foxinal</h1>

<p align="center">
  <em>SSH connections, organized.</em>
</p>

<p align="center">
  Nested groups. Multi-tab terminals. SFTP.<br />
  Your hosts stay on your machine — private by default.
</p>

<p align="center">
  <a href="https://github.com/foxinal-team/foxinal-app/releases/latest"><img src="https://img.shields.io/github/v/release/foxinal-team/foxinal-app?style=for-the-badge&color=ea580c&label=Download" alt="Download" /></a>
  &nbsp;
  <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS" />
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux" />
</p>

<p align="center">
  <a href="https://github.com/foxinal-team/foxinal-app/releases/latest"><b>Download</b></a>
  ·
  <a href="#why-foxinal">Why Foxinal</a>
  ·
  <a href="#install">Install</a>
  ·
  <a href="#build-from-source">Build from source</a>
</p>

---

## Why Foxinal

Foxinal is a desktop home for the SSH hosts you actually use — grouped the way you think, with terminals and files a click away.

| | |
|---|---|
| **Local-first** | No account. No cloud sync. Inventory lives on your device. |
| **Organized** | Nested groups, search, list or grid, import and export. |
| **Always connected** | Local shell and SSH tabs keep running while you switch views. |
| **Files included** | Dual-pane SFTP with drag-and-drop between local and remote. |
| **Yours to lock** | Optional master password, idle lock, and lock when hidden. |

---

## Features

### Connections that stay out of the way

Build a tree of groups and hosts. Double-click to open a folder or start a session. Drag with the grip handle to rearrange. Prefer keys or passwords — Foxinal handles the prompt either way.

### Terminals that feel native

Multi-tab local and SSH sessions with your font, size, and theme. Copy and paste the way your OS expects. Host key changes are handled in-app when they show up.

### SFTP beside your shells

Browse both sides of a transfer. Create folders, rename, delete, and drag files or directories between panes — without leaving Foxinal.

### Security on your terms

Leave the vault open for a personal machine, or set a master password and encrypt inventory at rest. Tune lock behavior in Settings when you need it.

---

## Install

Pick the build for your machine from the [latest release](https://github.com/foxinal-team/foxinal-app/releases/latest).

<table>
  <tr>
    <th align="left">Platform</th>
    <th align="left">Download</th>
  </tr>
  <tr>
    <td><b>macOS</b> · Apple Silicon</td>
    <td><code>foxinal_*_aarch64.dmg</code></td>
  </tr>
  <tr>
    <td><b>macOS</b> · Intel</td>
    <td><code>foxinal_*_x64.dmg</code></td>
  </tr>
  <tr>
    <td><b>Linux</b> · portable</td>
    <td><code>foxinal_*_amd64.AppImage</code></td>
  </tr>
  <tr>
    <td><b>Linux</b> · Debian / Ubuntu</td>
    <td><code>foxinal_*_amd64.deb</code></td>
  </tr>
  <tr>
    <td><b>Linux</b> · Fedora / RHEL</td>
    <td><code>foxinal_*-*.x86_64.rpm</code></td>
  </tr>
</table>

### macOS

1. Download the DMG for your chip and open it.
2. Drag **foxinal** into **Applications**.
3. Run once in Terminal (unsigned builds need this step):

```bash
xattr -cr /Applications/foxinal.app
```

4. Open Foxinal from Applications. If macOS still warns you, right-click → **Open** → **Open**.

### Linux

**AppImage**

```bash
chmod +x foxinal_*_amd64.AppImage
./foxinal_*_amd64.AppImage
```

**Package**

```bash
# Debian / Ubuntu
sudo dpkg -i foxinal_*_amd64.deb

# Fedora / RHEL
sudo rpm -i foxinal_*-*.x86_64.rpm
```

---

## Built with care

A fast native shell on [Tauri 2](https://tauri.app/), a React interface with a quiet liquid-glass look, and a real PTY for terminals that behave like the real thing.

| | |
|---|---|
| Shell | Tauri 2 · Rust |
| Interface | React 19 · TypeScript · Vite · Tailwind · shadcn/ui |
| Terminal | xterm.js · PTY |

In-app **Check for updates** points you at the GitHub release when a newer version is out.

---

## Build from source

```bash
git clone https://github.com/foxinal-team/foxinal-app.git
cd foxinal-app
pnpm install
pnpm tauri dev      # full app (required for terminal / SSH)
pnpm tauri build    # installers under src-tauri/target/release/bundle/
```

You’ll need Node.js (LTS), [pnpm](https://pnpm.io/), Rust, [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS, and `ssh` on your `PATH`.

---

<p align="center">
  <sub>Made for people who live in terminals.</sub><br />
  <a href="https://github.com/foxinal-team/foxinal-app/releases/latest">Download Foxinal</a>
</p>
