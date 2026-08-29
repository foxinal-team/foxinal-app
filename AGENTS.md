# Foxinal — AI Agent Index & Rules

> **Agent Instruction**: This file is a lightweight entrypoint. **Do not read all documentation files upfront.** Inspect this index and only read the specific topic file in [`docs/`](file:///Users/danial/Documents/Projects/foxinal/docs) relevant to your current task.

---

## 1. Documentation Router

Read the document below that matches what you are working on:

| Topic / Task                                                   | Relevant File                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Architecture, IPC flow, directory structure                    | [`docs/architecture.md`](file:///Users/danial/Documents/Projects/foxinal/docs/architecture.md)                 |
| Terminal, PTY, SSH arguments, host keys                        | [`docs/terminal-and-pty.md`](file:///Users/danial/Documents/Projects/foxinal/docs/terminal-and-pty.md)         |
| SFTP, file transfers, dual-pane explorer, Rust `ssh2`          | [`docs/sftp.md`](file:///Users/danial/Documents/Projects/foxinal/docs/sftp.md)                                 |
| Vault, encryption (AES-GCM/PBKDF2), master password, auto-lock | [`docs/security-and-vault.md`](file:///Users/danial/Documents/Projects/foxinal/docs/security-and-vault.md)     |
| Hosts, groups, import/export, data models                      | [`docs/inventory-and-data.md`](file:///Users/danial/Documents/Projects/foxinal/docs/inventory-and-data.md)     |
| UI components, Tailwind CSS v4, themes, styling                | [`docs/ui-and-styling.md`](file:///Users/danial/Documents/Projects/foxinal/docs/ui-and-styling.md)             |
| Build commands, dependencies, version bumping                  | [`docs/development-workflow.md`](file:///Users/danial/Documents/Projects/foxinal/docs/development-workflow.md) |
| Feature roadmap, planned capabilities, milestone tracking      | [`docs/roadmap.md`](file:///Users/danial/Documents/Projects/foxinal/docs/roadmap.md)                           |

---

## 2. Mandatory Rules for Agents

1. **Keep Docs in Sync**:
   - Whenever you add features, modify existing behavior, alter IPC commands, or change data schemas, **you MUST update the corresponding file(s) in `docs/`** as part of your task.
   - If a new architectural area or subsystem is created, add a corresponding document in `docs/` and add its row to the router table above.

2. **Local-First & Zero-Knowledge**:
   - Never add cloud sync, telemetry, or remote dependencies that transmit host data or credentials.

3. **Security Discipline**:
   - Never write plaintext secrets or private keys to persistent storage or unmasked logs.
   - Temporary private key files must use `0600` permissions on Unix and be deleted immediately after PTY spawn.

4. **IPC & Backend Integrity**:
   - Keep Tauri commands non-blocking (`async` / `spawn_blocking`).
   - Register all new commands in `src-tauri/src/lib.rs` and update permission capabilities if required.

5. **UI & Code Standards**:
   - React 19 + TypeScript (strict mode).
   - Tailwind CSS v4 + Radix UI + Tabler Icons (`@tabler/icons-react`).
