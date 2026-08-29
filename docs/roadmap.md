# Foxinal — Product Roadmap & Feature Tracking

> **Living Document**: This roadmap outlines planned, in-progress, and completed capabilities for Foxinal. Whenever a feature is implemented, updated, or re-prioritized, this file **MUST** be updated to reflect the latest status.

---

## 🎯 Legend & Status Indicators

- `[x]` **Completed**: Shipped and available in production.
- `[/]` **In Progress**: Currently under active development.
- `[ ]` **Planned**: Scheduled for upcoming releases.

---

## 🧭 Milestone Overview

```
├── ⚡ Phase 1: Terminal & Session Power-Ups
├── 🔒 Phase 2: Advanced SSH & Network Tunnels
├── 📂 Phase 3: SFTP & Remote File Operations
├── 🏷️ Phase 4: Organization, Tagging & Productivity
└── 🚀 Phase 5: Power Diagnostics & Ecosystem Integration
```

---

## 1. Terminal & Session Management

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :---: |
| `[x]` | **Xterm.js WebGL/Canvas Terminal** | Fast native PTY terminal emulator with customizable font family, size, line height, cursor styles, and scrollback limit. | v1.0 |
| `[x]` | **Local OS Shell & SSH Sessions** | Multi-session tabbed manager supporting local shells and password/key-based SSH connections. | v1.0 |
| `[x]` | **SSH Host Key Verification & Trust Flow** | Automated known_hosts handling with verification failure dialog and trust reset capability. | v1.1 |
| `[ ]` | **Terminal Split Panes (Horizontal / Vertical)** | Split terminal views side-by-side or stacked within the same session tab (like tmux/Tabby). | v1.2 |
| `[ ]` | **Multi-Exec / Broadcast Input** | Broadcast keystrokes and shell commands simultaneously across multiple selected server tabs. | v1.2 |
| `[ ]` | **SSH Keep-Alive & Auto-Reconnect** | Configurable `ServerAliveInterval` and seamless reconnection upon Wi-Fi switch or laptop sleep wake. | v1.2 |
| `[ ]` | **Terminal Session Logging** | Toggle logging raw or formatted session output to local files for audits and compliance. | v1.3 |
| `[ ]` | **Custom Keybindings & Shortcut Manager** | User-configurable keyboard hotkeys for tab navigation, pane splitting, and custom actions. | v1.3 |

---

## 2. Advanced SSH & Network Tunneling

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :---: |
| `[x]` | **Password & Private Key Auth** | Supports raw PEM private keys, password auth, and auto-generated temporary key files (`0600`). | v1.0 |
| `[ ]` | **SSH Port Forwarding / Tunnels Manager** | Visual manager for Local (`-L`), Remote (`-R`), and Dynamic SOCKS5 (`-D`) port forwards with live status. | v1.2 |
| `[ ]` | **Jump Host / ProxyJump / Bastion Support** | Connect to private subnet servers through a Bastion / Gateway host (`ProxyJump bastion.example.com`). | v1.2 |
| `[ ]` | **SSH Agent & Hardware Security Keys** | Native integration with system `ssh-agent`, 1Password SSH Agent, and YubiKey (PKCS#11 / FIDO2). | v1.3 |
| `[ ]` | **Import from `~/.ssh/config` & `known_hosts`** | One-click parser to import existing OpenSSH configuration files, host aliases, and identity files. | v1.2 |

---

## 3. SFTP & Remote File Management

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :---: |
| `[x]` | **Dual-Pane Local/Remote Explorer** | Dual-pane file manager with real-time transfer progress, cancellation, file/folder creation, and deletion. | v1.1 |
| `[x]` | **Pointer Drag-and-Drop Transfers** | Drag files and folders across local and remote panes with live ghost preview and drop targets. | v1.1 |
| `[x]` | **Single-Line Smooth Breadcrumb Nav** | Horizontal auto-scrolling breadcrumbs preventing header overflow in deep directories. | v1.1 |
| `[x]` | **Built-in Quick Text & Code Editor** | View and edit remote configuration files (`nginx.conf`, `.env`, YAML) directly in-app with syntax highlighting. | v1.2 |
| `[ ]` | **Desktop OS Drag-and-Drop** | Drag files directly between native Finder / File Explorer and Foxinal SFTP panes. | v1.3 |
| `[ ]` | **Permissions & Ownership Modal (`chmod`/`chown`)** | Right-click inspector to modify octal permissions (`755`, `644`, `600`) and remote file ownership. | v1.2 |
| `[ ]` | **File Diff & Comparison View** | Side-by-side visual diff comparison between local and remote files before overwriting. | v1.4 |

---

## 4. Organization, Tagging & Productivity

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :---: |
| `[x]` | **Nested Group Hierarchy & Drag-to-Move** | Organize hosts into nested folders with breadcrumb navigation and visual pointer drag re-ordering. | v1.0 |
| `[x]` | **Live Search & Instant Filtering** | Real-time search with group-aware location badges and keyboard shortcut (`Cmd/Ctrl + F`). | v1.0 |
| `[x]` | **List & Adaptive Grid Views** | Switch between high-density list and structured card grid views. | v1.1 |
| `[x]` | **JSON Export & Import** | Full inventory export and safe merging into root or sub-groups. | v1.0 |
| `[x]` | **Command Palette (`Cmd/Ctrl + K`)** | Universal spotlight launcher to jump to any host, switch sessions, run snippets, or toggle settings. | v1.1 |
| `[ ]` | **Command Snippets & Quick Scripts** | Library of reusable shell scripts with variable placeholder prompts (e.g. `docker logs {{container}}`). | v1.2 |
| `[ ]` | **Environment Color Badges & Production Safeguards** | Tag hosts with `PROD`, `STAGING`, `DEV` badges and optional confirm prompts for destructive commands. | v1.3 |
| `[ ]` | **Custom Host Environment Variables** | Define custom environment variables preset per host or group. | v1.3 |

---

## 5. Security & Vault

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :---: |
| `[x]` | **AES-256-GCM / PBKDF2 Vault** | 600,000 PBKDF2 iterations, hardware Web Crypto API, zero-knowledge local encryption. | v1.0 |
| `[x]` | **Master Password & Auto-Lock Timer** | Configurable inactivity timeout and window blur auto-lock. | v1.0 |
| `[x]` | **Safe In-Memory Session Storage** | Decrypted master key remains strictly in memory; never written to disk or logs. | v1.0 |
| `[ ]` | **Encrypted Remote Backup / Sync (Self-Hosted)** | Zero-knowledge vault sync via user-owned WebDAV, local folder, or S3 bucket without third-party servers. | v1.3 |
| `[ ]` | **Biometric Unlock (Touch ID / Windows Hello)** | Quick biometric unlock using OS secure enclave / keychain. | v1.4 |

---

## 6. System Diagnostics & Host Insights

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :---: |
| `[ ]` | **Host Health Snapshot** | Lightweight, non-intrusive status widget on connection showing CPU load, RAM usage, disk space, and uptime. | v1.3 |
| `[ ]` | **Process & Port Inspector** | Quick view of listening ports and running remote processes on connected servers. | v1.4 |

---

## 📝 Maintenance Instructions

Whenever you implement a feature from this roadmap:
1. Mark the item as completed (`[x]`).
2. If version numbering changes, update the Target column.
3. If new feature requests or architectural ideas emerge, append them to the appropriate section.
