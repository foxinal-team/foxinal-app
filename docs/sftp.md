# SFTP & Local Filesystem Subsystem

Foxinal features a dual-pane file manager supporting side-by-side local filesystem browsing and remote SSH/SFTP transfers.

---

## Technical Stack

- **Backend**: Rust [`ssh2`](https://crates.io/crates/ssh2) crate compiled with `vendored-openssl`, standard library filesystem (`std::fs`).
- **Frontend**: [`src/sftp/SftpView.tsx`](file:///Users/danial/Documents/Projects/foxinal/src/sftp/SftpView.tsx) and [`src/sftp/SftpPane.tsx`](file:///Users/danial/Documents/Projects/foxinal/src/sftp/SftpPane.tsx).
- **IPC Client**: [`src/sftp/api.ts`](file:///Users/danial/Documents/Projects/foxinal/src/sftp/api.ts).

---

## Capabilities

### 1. Dual-Pane Operations
- **Left / Right Panes**: Each pane can independently represent a local directory or a remote SFTP connection.
- **Navigation**: Path breadcrumbs, parent directory jumping, hidden files toggle, path input bar, and sorting (name, size, modification date, type).
- **File Management**: Create folder, create file, rename, delete (recursive for directories).

### 2. File Transfers & Drag-and-Drop
- Drag-and-drop between panes (Local to Remote, Remote to Local, Remote to Remote, Local to Local).
- Chunked streaming with real-time transfer progress emitted to frontend:
  - Event: `sftp:transfer-progress`
  - Payload: Transferred bytes, total bytes, speed, current item name.
- Non-blocking asynchronous transfers running in Rust background threads.
- Transfer cancellation support via `cancel_sftp_transfer` using atomic cancellation tokens.

### 3. Built-in Text & Code Editor
- **CodeMirror 6 Engine**: Fast, native code editor supporting syntax highlighting for NGINX, Shell/Bash, YAML, Dockerfile, `.env`, JSON, Python, JS/TS, HTML, CSS, SQL, Rust, Markdown, and plain text.
- **Editor Features**: Line numbers, active line highlight, line wrap toggle, find & replace (`Cmd/Ctrl + F`), bracket matching, auto-indentation, and live cursor position statistics.
- **Direct Remote Save**: Stream edited file buffers directly back to the server or local disk with `Cmd/Ctrl + S`.
- **Safety Safeguards**:
  - Binary file detection prevents editing non-UTF8/binary files to avoid data corruption.
  - Large file protection loads up to 5 MB with read-only warning.
  - Unsaved changes confirmation dialog prevents accidental loss.

---

## Backend Commands Reference (`src-tauri/src/sftp.rs`)

| Command | Description |
|---|---|
| `fs_home_dir` | Get the user's local home directory |
| `fs_list_dir` | List files and directories at a local path |
| `fs_mkdir` / `fs_create_file` | Create directories or empty files locally |
| `fs_remove` / `fs_rename` | Delete or rename local filesystem entries |
| `fs_read_text_file` | Read local text file with UTF-8 and binary detection |
| `fs_write_text_file` | Write edited text file to local disk |
| `sftp_connect` | Establish an authenticated SFTP session (key or password) |
| `sftp_disconnect` | Terminate and clean up an active SFTP session |
| `sftp_home_dir` | Resolve remote user's home directory (`.` or `pwd`) |
| `sftp_list_dir` | List directory contents on remote server |
| `sftp_mkdir` / `sftp_create_file` | Create remote directories or files |
| `sftp_remove` / `sftp_rename` | Remove or rename remote files/directories |
| `sftp_read_text_file` | Read remote file contents over SFTP |
| `sftp_write_text_file` | Write edited text buffer back to remote SFTP destination |
| `transfer_entries` | Execute batch file transfers with progress reporting |
| `cancel_sftp_transfer` | Cancel ongoing transfer task |

---

## Related Documentation
- [System Architecture](file:///Users/danial/Documents/Projects/foxinal/docs/architecture.md)
- [Security & Vault Architecture](file:///Users/danial/Documents/Projects/foxinal/docs/security-and-vault.md)
