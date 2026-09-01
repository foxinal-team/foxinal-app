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
| `[ ]` | **Terminal Split Panes (Horizontal / Vertical)** | Split terminal views side-by-side or stacked within the same session tab (like tmux/Tabby). | v1.4 |
| `[ ]` | **Multi-Exec / Broadcast Input** | Broadcast keystrokes and shell commands simultaneously across multiple selected server tabs. | v1.4 |
| `[ ]` | **SSH Keep-Alive & Auto-Reconnect** | Configurable `ServerAliveInterval` and seamless reconnection upon Wi-Fi switch or laptop sleep wake. | v1.4 |
| `[ ]` | **Terminal Session Logging** | Toggle logging raw or formatted session output to local files for audits and compliance. | v1.4 |
| `[ ]` | **Terminal Scrollback Search Bar (`Cmd/Ctrl + F`)** | Real-time buffer search with regex, case sensitivity, and jump-to-match navigation. | v1.4 |
| `[ ]` | **Smart Clickable Links & SFTP Editor Jump** | `Cmd/Ctrl + Click` on remote file paths in terminal output to immediately open and edit them in the built-in SFTP editor, plus clickable URLs. | v1.4 |
| `[ ]` | **Tab Color Tags, Custom Emojis & Renaming** | Right-click any active terminal or SFTP tab to assign custom color tags (e.g., Red for PROD, Green for DEV), emojis, and custom labels. | v1.4 |
| `[ ]` | **Connect Scripts & Auto-Tmux on Login** | Execute automated startup commands, environment activations, or auto-attach tmux sessions upon connection. | v1.4 |
| `[ ]` | **Custom Keybindings & Shortcut Manager** | User-configurable keyboard hotkeys for tab navigation, pane splitting, and custom actions. | v1.5 |
| `[ ]` | **Smart Output Highlighting & Triggers** | Auto regex syntax highlighting for errors, IP addresses, URLs, and custom keyword alerts/actions. | v1.5 |
| `[ ]` | **Quake / Dropdown Global Hotkey Terminal** | Summon a floating quick-terminal scratchpad from anywhere in the OS via global hotkey. | v1.5 |
| `[ ]` | **ZMODEM (`rz` / `sz`) File Transfer Integration** | Direct file upload and download within the active terminal stream without switching views. | v1.5 |

---

## 2. Advanced SSH & Network Tunneling

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :--- |
| `[x]` | **Password & Private Key Auth** | Supports raw PEM private keys, password auth, and auto-generated temporary key files (`0600`). | v1.0 |
| `[ ]` | **SSH Port Forwarding / Tunnels Manager** | Visual manager for Local (`-L`), Remote (`-R`), and Dynamic SOCKS5 (`-D`) port forwards with live status. | v1.4 |
| `[ ]` | **Jump Host / ProxyJump / Bastion Support** | Connect to private subnet servers through a Bastion / Gateway host (`ProxyJump bastion.example.com`). | v1.4 |
| `[ ]` | **Import from `~/.ssh/config` & `known_hosts`** | One-click parser to import existing OpenSSH configuration files, host aliases, and identity files. | v1.4 |
| `[ ]` | **SSH Key Pair Generator & 1-Click `ssh-copy-id`** | Built-in Ed25519/RSA-4096 key generator with automated public key deployment to remote servers. | v1.4 |
| `[ ]` | **SSH Agent & Hardware Security Keys** | Native integration with system `ssh-agent`, 1Password SSH Agent, and YubiKey (PKCS#11 / FIDO2). | v1.5 |
| `[ ]` | **Mosh (Mobile Shell) Protocol Support** | Roaming-friendly sessions that gracefully survive Wi-Fi hops, IP roaming, and high-latency mobile networks. | v1.5 |
| `[ ]` | **Serial (COM/USB) & Telnet Connections** | Direct connections to embedded devices, Raspberry Pis, switches, and serial consoles (`/dev/tty.*`, `COM*`). | v1.5 |

---

## 3. SFTP & Remote File Management

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :--- |
| `[x]` | **Dual-Pane Local/Remote Explorer** | Dual-pane file manager with real-time transfer progress, cancellation, file/folder creation, and deletion. | v1.1 |
| `[x]` | **Pointer Drag-and-Drop Transfers** | Drag files and folders across local and remote panes with live ghost preview and drop targets. | v1.1 |
| `[x]` | **Single-Line Smooth Breadcrumb Nav** | Horizontal auto-scrolling breadcrumbs preventing header overflow in deep directories. | v1.1 |
| `[x]` | **Built-in Quick Text & Code Editor** | View and edit remote configuration files (`nginx.conf`, `.env`, YAML) directly in-app with syntax highlighting. | v1.2 |
| `[x]` | **Permissions & Ownership Modal (`chmod`/`chown`)** | Right-click inspector to modify octal permissions (`755`, `644`, `600`), ownership (`chown`), and SSH sudo elevation fallback. | v1.3 |
| `[ ]` | **Remote Archive & Extract (`.tar.gz`, `.zip`, `.tar.bz2`)** | Right-click context actions to compress or extract archives directly on the remote server via SSH. | v1.4 |
| `[ ]` | **Background Transfer Queue & Speed Controls** | Non-blocking transfer manager with pause/resume, retry failed transfers, and bandwidth throttling. | v1.4 |
| `[ ]` | **Desktop OS Drag-and-Drop** | Drag files directly between native Finder / File Explorer and Foxinal SFTP panes. | v1.4 |
| `[ ]` | **Synchronized Dual-Pane Browsing** | Lock navigation between local and remote explorer panes for seamless website and directory mirror navigation. | v1.5 |
| `[ ]` | **External Editor Watcher ("Edit in VS Code / Local IDE")** | Open remote files in local desktop editors with automatic background upload on save. | v1.5 |
| `[ ]` | **File Diff & Comparison View** | Side-by-side visual diff comparison between local and remote files before overwriting. | v1.5 |

---

## 4. Organization, Tagging & Productivity

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :--- |
| `[x]` | **Nested Group Hierarchy & Drag-to-Move** | Organize hosts into nested folders with breadcrumb navigation and visual pointer drag re-ordering. | v1.0 |
| `[x]` | **Live Search & Instant Filtering** | Real-time search with group-aware location badges and keyboard shortcut (`Cmd/Ctrl + F`). | v1.0 |
| `[x]` | **List & Adaptive Grid Views** | Switch between high-density list and structured card grid views. | v1.1 |
| `[x]` | **JSON Export & Import** | Full inventory export and safe merging into root or sub-groups. | v1.0 |
| `[x]` | **Command Palette (`Cmd/Ctrl + K`)** | Universal spotlight launcher to jump to any host, switch sessions, run snippets, or toggle settings. | v1.1 |
| `[ ]` | **Curated Theme Gallery & Live Switcher** | 1-click theme gallery with live instant preview across both the application UI and Xterm terminal palettes (*Catppuccin, Tokyo Night, Dracula, Nord, Gruvbox, One Dark*). | v1.4 |
| `[ ]` | **Command Snippets & Quick Scripts** | Library of reusable shell scripts with variable placeholder prompts (e.g. `docker logs {{container}}`). | v1.4 |
| `[ ]` | **Server Notes & Markdown Runbooks Drawer** | Slide-out host drawer for saving cheat-sheets, architecture notes, and troubleshooting runbooks. | v1.4 |
| `[ ]` | **Distro & Cloud Visual Badges** | Auto-detect or select visual icons/badges for Linux distros (Ubuntu, Debian, Alpine, Arch) and cloud providers (AWS, GCP, Proxmox). | v1.4 |
| `[ ]` | **Environment Color Badges & Production Safeguards** | Tag hosts with `PROD`, `STAGING`, `DEV` badges and optional confirm prompts for destructive commands. | v1.4 |
| `[ ]` | **Custom Host Environment Variables** | Define custom environment variables preset per host or group. | v1.4 |

---

## 5. Security & Vault

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :--- |
| `[x]` | **AES-256-GCM / PBKDF2 Vault** | 600,000 PBKDF2 iterations, hardware Web Crypto API, zero-knowledge local encryption. | v1.0 |
| `[x]` | **Master Password & Auto-Lock Timer** | Configurable inactivity timeout and window blur auto-lock. | v1.0 |
| `[x]` | **Safe In-Memory Session Storage** | Decrypted master key remains strictly in memory; never written to disk or logs. | v1.0 |
| `[ ]` | **Encrypted Remote Backup / Sync (Self-Hosted)** | Zero-knowledge vault sync via user-owned WebDAV, local folder, or S3 bucket without third-party servers. | v1.4 |
| `[ ]` | **Biometric Unlock (Touch ID / Windows Hello)** | Quick biometric unlock using OS secure enclave / keychain. | v1.5 |

---

## 6. System Diagnostics & Container Insights

| Status | Feature | Description | Target |
| :---: | :--- | :--- | :--- |
| `[ ]` | **Host Health Snapshot** | Lightweight, non-intrusive status widget on connection showing CPU load, RAM usage, disk space, and uptime. | v1.4 |
| `[ ]` | **Process & Port Inspector** | Quick view of listening ports and running remote processes on connected servers. | v1.4 |
| `[ ]` | **Docker & Container Explorer / Shell Attach** | Visual remote Docker container manager to inspect statuses, stream container logs, and launch 1-click container shells. | v1.5 |

---

## 📝 Maintenance Instructions

Whenever you implement a feature from this roadmap:
1. Mark the item as completed (`[x]`).
2. If version numbering changes, update the Target column.
3. If new feature requests or architectural ideas emerge, append them to the appropriate section.
