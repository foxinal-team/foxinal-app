use serde::Serialize;
use ssh2::{FileStat, Session};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

const PROGRESS_EVENT: &str = "sftp-transfer-progress";
const PROGRESS_EMIT_EVERY: u64 = 1024 * 1024;
const PROGRESS_EMIT_MS: u128 = 160;
const TRANSFER_BUF: usize = 1024 * 1024;
pub const TRANSFER_CANCELLED: &str = "Transfer cancelled.";

struct SessionAuth {
    address: String,
    port: u16,
    username: String,
    auth_method: String,
    password: String,
    private_key: String,
    endpoint: String,
}

impl Clone for SessionAuth {
    fn clone(&self) -> Self {
        Self {
            address: self.address.clone(),
            port: self.port,
            username: self.username.clone(),
            auth_method: self.auth_method.clone(),
            password: self.password.clone(),
            private_key: self.private_key.clone(),
            endpoint: self.endpoint.clone(),
        }
    }
}

struct LiveSession {
    session: Session,
    home: Option<String>,
    /// Credentials to open dedicated transfer connections (browse stays free).
    auth: SessionAuth,
}

pub struct SftpState {
    sessions: Mutex<HashMap<String, LiveSession>>,
    /// Per-transfer cancel flags (transferId → flag).
    cancel_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl Default for SftpState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            cancel_flags: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub size: u64,
    pub modified: Option<u64>,
    pub hidden: bool,
    pub size_label: String,
    pub modified_label: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectResult {
    pub session_id: String,
    pub home: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferResult {
    pub transferred: u64,
    pub message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgress {
    pub transfer_id: String,
    pub name: String,
    pub transferred: u64,
    pub total: u64,
    pub done: bool,
}

struct Progress {
    app: AppHandle,
    transfer_id: String,
    name: String,
    transferred: u64,
    total: u64,
    last_emit_bytes: u64,
    last_emit_at: Instant,
    cancel: Arc<AtomicBool>,
}

impl Progress {
    fn new(
        app: AppHandle,
        transfer_id: String,
        name: String,
        total: u64,
        cancel: Arc<AtomicBool>,
    ) -> Self {
        let mut progress = Self {
            app,
            transfer_id,
            name,
            transferred: 0,
            total,
            last_emit_bytes: 0,
            last_emit_at: Instant::now(),
            cancel,
        };
        progress.emit(true);
        progress
    }

    fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }

    fn check(&self) -> Result<(), String> {
        if self.cancelled() {
            Err(TRANSFER_CANCELLED.into())
        } else {
            Ok(())
        }
    }

    fn emit(&mut self, force: bool) {
        if !force {
            let bytes_delta = self.transferred.saturating_sub(self.last_emit_bytes);
            let elapsed_ms = self.last_emit_at.elapsed().as_millis();
            if bytes_delta < PROGRESS_EMIT_EVERY && elapsed_ms < PROGRESS_EMIT_MS {
                return;
            }
        }
        self.last_emit_bytes = self.transferred;
        self.last_emit_at = Instant::now();
        let _ = self.app.emit(
            PROGRESS_EVENT,
            TransferProgress {
                transfer_id: self.transfer_id.clone(),
                name: self.name.clone(),
                transferred: self.transferred,
                total: self.total,
                done: false,
            },
        );
    }

    fn add(&mut self, n: u64) -> Result<(), String> {
        self.check()?;
        self.transferred = self.transferred.saturating_add(n);
        self.emit(false);
        Ok(())
    }

    fn finish(&mut self) {
        if self.total == 0 {
            self.total = self.transferred;
        }
        let _ = self.app.emit(
            PROGRESS_EVENT,
            TransferProgress {
                transfer_id: self.transfer_id.clone(),
                name: self.name.clone(),
                transferred: self.transferred,
                total: self.total.max(self.transferred),
                done: true,
            },
        );
    }
}

fn path_name(path: &Path) -> String {
    path.file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

fn is_hidden_name(name: &str) -> bool {
    name.starts_with('.') && name != "." && name != ".."
}

fn format_bytes_label(size: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * 1024;
    const GB: u64 = 1024 * 1024 * 1024;
    if size < KB {
        format!("{size} B")
    } else if size < MB {
        format!("{:.1} KB", size as f64 / KB as f64)
    } else if size < GB {
        format!("{:.1} MB", size as f64 / MB as f64)
    } else {
        format!("{:.2} GB", size as f64 / GB as f64)
    }
}

/// Locale-independent short stamp (YYYY-MM-DD HH:MM UTC).
fn format_modified_label(epoch_secs: Option<u64>) -> String {
    let Some(secs) = epoch_secs else {
        return "—".into();
    };
    let z = secs as i64;
    let days = z.div_euclid(86_400);
    let tod = z.rem_euclid(86_400) as u32;
    let hour = tod / 3600;
    let min = (tod % 3600) / 60;
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02} {hour:02}:{min:02}")
}

/// Howard Hinnant’s civil_from_days (UTC).
fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

fn make_entry(
    name: String,
    path: String,
    kind: &str,
    size: u64,
    modified: Option<u64>,
) -> FsEntry {
    let hidden = is_hidden_name(&name);
    FsEntry {
        size_label: if kind == "dir" {
            "—".into()
        } else {
            format_bytes_label(size)
        },
        modified_label: format_modified_label(modified),
        name,
        path,
        kind: kind.into(),
        size,
        modified,
        hidden,
    }
}

fn sort_entries(entries: &mut [FsEntry]) {
    entries.sort_by(|a, b| {
        let a_dir = a.kind == "dir";
        let b_dir = b.kind == "dir";
        match (a_dir, b_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a
                .name
                .to_ascii_lowercase()
                .cmp(&b.name.to_ascii_lowercase()),
        }
    });
}

fn modified_secs(stat: &std::fs::Metadata) -> Option<u64> {
    stat.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

fn remote_modified_secs(stat: &FileStat) -> Option<u64> {
    stat.mtime
}

fn join_remote(parent: &str, name: &str) -> String {
    if parent.is_empty() || parent == "/" {
        format!("/{name}")
    } else {
        format!(
            "{}/{}",
            parent.trim_end_matches('/'),
            name.trim_start_matches('/')
        )
    }
}

fn parent_remote(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() || trimmed == "/" {
        return "/".into();
    }
    match trimmed.rsplit_once('/') {
        Some(("", _)) => "/".into(),
        Some((parent, _)) if parent.is_empty() => "/".into(),
        Some((parent, _)) => parent.to_string(),
        None => "/".into(),
    }
}

fn take_session(state: &SftpState, session_id: &str) -> Result<LiveSession, String> {
    let mut map = state
        .sessions
        .lock()
        .map_err(|_| "SFTP lock poisoned.".to_string())?;
    map.remove(session_id)
        .ok_or_else(|| "SFTP session not connected. Select the host again.".to_string())
}

fn put_session(state: &SftpState, session_id: String, live: LiveSession) -> Result<(), String> {
    let mut map = state
        .sessions
        .lock()
        .map_err(|_| "SFTP lock poisoned.".to_string())?;
    map.insert(session_id, live);
    Ok(())
}

fn get_auth(state: &SftpState, session_id: &str) -> Result<SessionAuth, String> {
    let map = state
        .sessions
        .lock()
        .map_err(|_| "SFTP lock poisoned.".to_string())?;
    map.get(session_id)
        .map(|live| live.auth.clone())
        .ok_or_else(|| "SFTP session not connected. Select the host again.".to_string())
}

fn establish_session(auth: &SessionAuth) -> Result<Session, String> {
    let tcp = TcpStream::connect((auth.address.as_str(), auth.port))
        .map_err(|e| format!("Connection failed: {e}"))?;
    let _ = tcp.set_nodelay(true);
    let _ = tcp.set_read_timeout(Some(Duration::from_secs(60)));
    let _ = tcp.set_write_timeout(Some(Duration::from_secs(60)));

    let mut session = Session::new().map_err(|e| format!("SSH session error: {e}"))?;
    session.set_compress(true);
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|e| format!("SSH handshake failed: {e}"))?;

    if auth.auth_method == "key" {
        let key = auth.private_key.trim();
        if key.is_empty() {
            return Err("Private key is empty.".into());
        }
        session
            .userauth_pubkey_memory(auth.username.as_str(), None, key, None)
            .map_err(|e| format!("Key authentication failed: {e}"))?;
    } else {
        session
            .userauth_password(auth.username.as_str(), auth.password.trim())
            .map_err(|e| format!("Password authentication failed: {e}"))?;
    }

    if !session.authenticated() {
        return Err("Authentication failed.".into());
    }
    session.set_keepalive(true, 30);
    Ok(session)
}

fn begin_transfer_cancel(state: &SftpState, transfer_id: &str) -> Result<Arc<AtomicBool>, String> {
    let flag = Arc::new(AtomicBool::new(false));
    let mut map = state
        .cancel_flags
        .lock()
        .map_err(|_| "SFTP lock poisoned.".to_string())?;
    map.insert(transfer_id.to_string(), Arc::clone(&flag));
    Ok(flag)
}

fn end_transfer_cancel(state: &SftpState, transfer_id: &str) {
    if let Ok(mut map) = state.cancel_flags.lock() {
        map.remove(transfer_id);
    }
}

/// POSIX single-quote escape for remote shell commands.
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

fn assert_safe_remote_delete(path: &str) -> Result<(), String> {
    let trimmed = path.trim().trim_end_matches('/');
    if trimmed.is_empty() || trimmed == "/" || trimmed == "." || trimmed == ".." {
        return Err("Refusing to delete that remote path.".into());
    }
    Ok(())
}

fn exec_command(session: &Session, cmd: &str) -> Result<(i32, String), String> {
    let mut channel = session
        .channel_session()
        .map_err(|e| format!("SSH channel failed: {e}"))?;
    channel
        .exec(cmd)
        .map_err(|e| format!("Remote command failed: {e}"))?;
    let mut stderr = String::new();
    let _ = channel.stderr().read_to_string(&mut stderr);
    let mut stdout = String::new();
    let _ = channel.read_to_string(&mut stdout);
    channel
        .wait_close()
        .map_err(|e| format!("Remote command failed: {e}"))?;
    let status = channel.exit_status().unwrap_or(-1);
    let _ = stdout;
    Ok((status, stderr))
}

fn resolve_remote_home(session: &Session) -> String {
    if let Ok(sftp) = session.sftp() {
        if let Ok(path) = sftp.realpath(Path::new(".")) {
            return path.to_string_lossy().to_string();
        }
    }
    if let Ok(home) = exec_stdout(session, "printf %s \"$HOME\"") {
        if !home.is_empty() {
            return home;
        }
    }
    "/".into()
}

fn exec_stdout(session: &Session, cmd: &str) -> Result<String, String> {
    let mut channel = session
        .channel_session()
        .map_err(|e| format!("SSH channel failed: {e}"))?;
    channel
        .exec(cmd)
        .map_err(|e| format!("Remote command failed: {e}"))?;
    let mut stdout = String::new();
    channel
        .read_to_string(&mut stdout)
        .map_err(|e| format!("Remote read failed: {e}"))?;
    let mut stderr = String::new();
    let _ = channel.stderr().read_to_string(&mut stderr);
    channel
        .wait_close()
        .map_err(|e| format!("Remote command failed: {e}"))?;
    let status = channel.exit_status().unwrap_or(-1);
    if status != 0 {
        let detail = stderr.trim();
        return Err(if detail.is_empty() {
            format!("Remote command failed (exit {status}).")
        } else {
            detail.to_string()
        });
    }
    Ok(stdout.trim_end_matches(['\r', '\n']).to_string())
}

#[tauri::command]
pub fn fs_home_dir() -> Result<String, String> {
    dirs_home().map(|p| p.to_string_lossy().to_string())
}

fn dirs_home() -> Result<PathBuf, String> {
    if let Ok(home) = std::env::var("HOME") {
        return Ok(PathBuf::from(home));
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        return Ok(PathBuf::from(profile));
    }
    Err("Could not resolve home directory.".into())
}

#[tauri::command]
pub async fn fs_list_dir(path: String) -> Result<Vec<FsEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || list_local_dir(path))
        .await
        .map_err(|e| format!("List task failed: {e}"))?
}

fn list_local_dir(path: String) -> Result<Vec<FsEntry>, String> {
    let path = if path.trim().is_empty() {
        dirs_home()?
    } else {
        PathBuf::from(path)
    };
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", path.display()));
    }

    let mut entries = Vec::new();
    let read = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {e}"))?;
    for item in read {
        let item = item.map_err(|e| format!("Failed to read entry: {e}"))?;
        let name = item.file_name().to_string_lossy().to_string();
        let full = item.path();
        let file_type = item.file_type().ok();
        let kind = if file_type.as_ref().map(|t| t.is_dir()).unwrap_or(false) {
            "dir"
        } else if file_type.as_ref().map(|t| t.is_file()).unwrap_or(false) {
            "file"
        } else {
            "other"
        };
        // Prefer dirent type; only hit metadata for size/mtime when useful.
        let meta = item.metadata().ok();
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = meta.as_ref().and_then(modified_secs);
        entries.push(make_entry(
            name,
            full.to_string_lossy().to_string(),
            kind,
            size,
            modified,
        ));
    }
    sort_entries(&mut entries);
    Ok(entries)
}

#[tauri::command]
pub fn fs_parent_dir(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => {
            Ok(parent.to_string_lossy().to_string())
        }
        _ => Ok(path.to_string_lossy().to_string()),
    }
}

#[tauri::command]
pub async fn fs_mkdir(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        fs::create_dir_all(&path).map_err(|e| format!("Failed to create folder: {e}"))
    })
    .await
    .map_err(|e| format!("Mkdir task failed: {e}"))?
}

#[tauri::command]
pub async fn fs_create_file(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(&path);
        if path.exists() {
            return Err("A file or folder with that name already exists.".into());
        }
        File::options()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|e| format!("Failed to create file: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Create file task failed: {e}"))?
}

#[tauri::command]
pub async fn fs_remove(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(path);
        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| format!("Failed to delete folder: {e}"))
        } else {
            fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {e}"))
        }
    })
    .await
    .map_err(|e| format!("Remove task failed: {e}"))?
}

#[tauri::command]
pub async fn fs_rename(from: String, to: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let from = PathBuf::from(&from);
        let to = PathBuf::from(&to);
        if !from.exists() {
            return Err("Source path does not exist.".into());
        }
        if to.exists() {
            return Err("A file or folder with that name already exists.".into());
        }
        fs::rename(&from, &to).map_err(|e| format!("Failed to rename: {e}"))
    })
    .await
    .map_err(|e| format!("Rename task failed: {e}"))?
}

#[tauri::command]
pub async fn sftp_connect(
    state: State<'_, SftpState>,
    address: String,
    port: u16,
    username: String,
    auth_method: String,
    password: String,
    private_key: String,
) -> Result<ConnectResult, String> {
    let address = address.trim().to_string();
    let username = username.trim().to_string();
    if address.is_empty() {
        return Err("Host address is required.".into());
    }
    if username.is_empty() {
        return Err("Username is required.".into());
    }
    if port == 0 {
        return Err("Invalid SSH port.".into());
    }

    let endpoint = format!("{username}@{address}:{port}");
    let auth = SessionAuth {
        address,
        port,
        username,
        auth_method,
        password,
        private_key,
        endpoint: endpoint.clone(),
    };

    let (session_id, live) = tauri::async_runtime::spawn_blocking(move || {
        let session = establish_session(&auth)?;
        let home = resolve_remote_home(&session);
        let session_id = format!(
            "{}-{}",
            auth.endpoint,
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        );

        Ok::<(String, LiveSession), String>((
            session_id,
            LiveSession {
                session,
                home: Some(home),
                auth,
            },
        ))
    })
    .await
    .map_err(|e| format!("Connection task failed: {e}"))??;

    let home = live.home.clone().unwrap_or_else(|| "/".into());
    let mut map = state
        .sessions
        .lock()
        .map_err(|_| "SFTP lock poisoned.".to_string())?;
    map.insert(session_id.clone(), live);
    Ok(ConnectResult { session_id, home })
}

#[tauri::command]
pub fn sftp_disconnect(state: State<'_, SftpState>, session_id: String) -> Result<(), String> {
    let mut map = state
        .sessions
        .lock()
        .map_err(|_| "SFTP lock poisoned.".to_string())?;
    map.remove(&session_id);
    Ok(())
}

#[tauri::command]
pub async fn sftp_home_dir(
    state: State<'_, SftpState>,
    session_id: String,
) -> Result<String, String> {
    let mut live = take_session(&state, &session_id)?;
    if let Some(home) = live.home.clone() {
        put_session(&state, session_id, live)?;
        return Ok(home);
    }
    let sid = session_id.clone();
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let home = resolve_remote_home(&live.session);
        live.home = Some(home.clone());
        (Ok::<String, String>(home), live)
    })
    .await
    .map_err(|e| format!("SFTP task failed: {e}"))?;

    let (result, live) = joined;
    put_session(&state, sid, live)?;
    result
}

#[tauri::command]
pub async fn sftp_list_dir(
    state: State<'_, SftpState>,
    session_id: String,
    path: String,
) -> Result<Vec<FsEntry>, String> {
    let live = take_session(&state, &session_id)?;
    let sid = session_id.clone();
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let result = (|| {
            let sftp = live
                .session
                .sftp()
                .map_err(|e| format!("SFTP open failed: {e}"))?;
            let remote = if path.trim().is_empty() {
                "/"
            } else {
                path.trim()
            };
            let listed = sftp
                .readdir(Path::new(remote))
                .map_err(|e| format!("Failed to list remote directory: {e}"))?;

            let mut entries = Vec::with_capacity(listed.len());
            for (entry_path, stat) in listed {
                let name = path_name(&entry_path);
                if name == "." || name == ".." {
                    continue;
                }
                let full = if entry_path.is_absolute() {
                    entry_path.to_string_lossy().to_string()
                } else {
                    join_remote(remote, &name)
                };
                let kind = if stat.is_dir() {
                    "dir"
                } else if stat.is_file() {
                    "file"
                } else {
                    "other"
                };
                entries.push(make_entry(
                    name,
                    full,
                    kind,
                    stat.size.unwrap_or(0),
                    remote_modified_secs(&stat),
                ));
            }
            sort_entries(&mut entries);
            Ok(entries)
        })();
        (result, live)
    })
    .await
    .map_err(|e| format!("SFTP task failed: {e}"))?;

    let (result, live) = joined;
    put_session(&state, sid, live)?;
    result
}

#[tauri::command]
pub fn sftp_parent_dir(path: String) -> Result<String, String> {
    Ok(parent_remote(&path))
}

#[tauri::command]
pub async fn sftp_mkdir(
    state: State<'_, SftpState>,
    session_id: String,
    path: String,
) -> Result<(), String> {
    let live = take_session(&state, &session_id)?;
    let sid = session_id.clone();
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let result = mkdir_remote(&live.session, &path);
        (result, live)
    })
    .await
    .map_err(|e| format!("SFTP task failed: {e}"))?;

    let (result, live) = joined;
    put_session(&state, sid, live)?;
    result
}

fn mkdir_remote(session: &Session, path: &str) -> Result<(), String> {
    let cmd = format!("mkdir -p -- {}", shell_quote(path));
    match exec_command(session, &cmd) {
        Ok((0, _)) => Ok(()),
        Ok((status, stderr)) => {
            // Fallback to SFTP single-level mkdir.
            let sftp = session
                .sftp()
                .map_err(|e| format!("SFTP open failed: {e}"))?;
            sftp.mkdir(Path::new(path), 0o755).map_err(|e| {
                let detail = stderr.trim();
                if detail.is_empty() {
                    format!("Failed to create remote folder (exit {status}): {e}")
                } else {
                    format!("Failed to create remote folder: {detail}")
                }
            })
        }
        Err(exec_err) => {
            let sftp = session
                .sftp()
                .map_err(|e| format!("SFTP open failed: {e}"))?;
            sftp.mkdir(Path::new(path), 0o755).map_err(|e| {
                format!("{exec_err} (SFTP fallback also failed: {e})")
            })
        }
    }
}

#[tauri::command]
pub async fn sftp_create_file(
    state: State<'_, SftpState>,
    session_id: String,
    path: String,
) -> Result<(), String> {
    let live = take_session(&state, &session_id)?;
    let sid = session_id.clone();
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let result = create_file_remote(&live.session, &path);
        (result, live)
    })
    .await
    .map_err(|e| format!("SFTP task failed: {e}"))?;

    let (result, live) = joined;
    put_session(&state, sid, live)?;
    result
}

fn create_file_remote(session: &Session, path: &str) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() || path == "/" {
        return Err("Invalid remote file path.".into());
    }
    assert_safe_remote_delete(path).map_err(|_| {
        "Refusing to create a file at that remote path.".to_string()
    })?;

    let sftp = session
        .sftp()
        .map_err(|e| format!("SFTP open failed: {e}"))?;
    if sftp.stat(Path::new(path)).is_ok() {
        return Err("A file or folder with that name already exists.".into());
    }

    // Prefer shell `set -C` (noclobber) so we never clobber an existing file.
    let cmd = format!("set -C && : > {}", shell_quote(path));
    match exec_command(session, &cmd) {
        Ok((0, _)) => Ok(()),
        Ok((status, stderr)) => {
            let detail = stderr.trim();
            sftp.create(Path::new(path)).map(|_| ()).map_err(|e| {
                if detail.is_empty() {
                    format!("Failed to create remote file (exit {status}): {e}")
                } else {
                    format!("Failed to create remote file: {detail}")
                }
            })
        }
        Err(exec_err) => sftp.create(Path::new(path)).map(|_| ()).map_err(|e| {
            format!("{exec_err} (SFTP fallback also failed: {e})")
        }),
    }
}

#[tauri::command]
pub async fn sftp_remove(
    state: State<'_, SftpState>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), String> {
    let live = take_session(&state, &session_id)?;
    let sid = session_id.clone();
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let result = remove_remote(&live.session, &path, is_dir);
        (result, live)
    })
    .await
    .map_err(|e| format!("SFTP task failed: {e}"))?;

    let (result, live) = joined;
    put_session(&state, sid, live)?;
    result
}

fn rename_remote(session: &Session, from: &str, to: &str) -> Result<(), String> {
    let from = from.trim();
    let to = to.trim();
    if from.is_empty() || to.is_empty() {
        return Err("Source and destination paths are required.".into());
    }
    if from == to {
        return Ok(());
    }
    assert_safe_remote_delete(from)?;
    assert_safe_remote_delete(to)?;

    let cmd = format!("mv -- {} {}", shell_quote(from), shell_quote(to));
    match exec_command(session, &cmd) {
        Ok((0, _)) => Ok(()),
        Ok((status, stderr)) => {
            let sftp = session
                .sftp()
                .map_err(|e| format!("SFTP open failed: {e}"))?;
            sftp.rename(Path::new(from), Path::new(to), None)
                .map_err(|e| {
                    let detail = stderr.trim();
                    if detail.is_empty() {
                        format!("Failed to rename (exit {status}): {e}")
                    } else {
                        format!("Failed to rename: {detail}")
                    }
                })
        }
        Err(exec_err) => {
            let sftp = session
                .sftp()
                .map_err(|e| format!("SFTP open failed: {e}"))?;
            sftp.rename(Path::new(from), Path::new(to), None)
                .map_err(|e| format!("{exec_err} (SFTP fallback also failed: {e})"))
        }
    }
}

#[tauri::command]
pub async fn sftp_rename(
    state: State<'_, SftpState>,
    session_id: String,
    from: String,
    to: String,
) -> Result<(), String> {
    let live = take_session(&state, &session_id)?;
    let sid = session_id.clone();
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let result = rename_remote(&live.session, &from, &to);
        (result, live)
    })
    .await
    .map_err(|e| format!("SFTP task failed: {e}"))?;

    let (result, live) = joined;
    put_session(&state, sid, live)?;
    result
}

fn remove_remote_via_exec(session: &Session, path: &str) -> Result<(), String> {
    assert_safe_remote_delete(path)?;
    let cmd = format!("rm -rf -- {}", shell_quote(path));
    let (status, stderr) = exec_command(session, &cmd)?;
    if status != 0 {
        let detail = stderr.trim();
        return Err(if detail.is_empty() {
            format!("Failed to delete remote path (exit {status}).")
        } else {
            format!("Failed to delete remote path: {detail}")
        });
    }
    Ok(())
}

fn remove_remote(session: &Session, path: &str, is_dir: bool) -> Result<(), String> {
    if is_dir {
        match remove_remote_via_exec(session, path) {
            Ok(()) => return Ok(()),
            Err(exec_err) => {
                let sftp = session
                    .sftp()
                    .map_err(|e| format!("SFTP open failed: {e}"))?;
                return remove_remote_dir(&sftp, Path::new(path)).map_err(|sftp_err| {
                    format!("{exec_err} (SFTP fallback also failed: {sftp_err})")
                });
            }
        }
    }

    // Prefer shell rm for files too (same RTT, handles busy files better).
    match remove_remote_via_exec(session, path) {
        Ok(()) => Ok(()),
        Err(exec_err) => {
            let sftp = session
                .sftp()
                .map_err(|e| format!("SFTP open failed: {e}"))?;
            sftp.unlink(Path::new(path)).map_err(|e| {
                format!("Failed to delete remote file: {e} ({exec_err})")
            })
        }
    }
}

fn remove_remote_dir(sftp: &ssh2::Sftp, path: &Path) -> Result<(), String> {
    assert_safe_remote_delete(&path.to_string_lossy())?;
    let entries = sftp
        .readdir(path)
        .map_err(|e| format!("Failed to read remote folder: {e}"))?;
    for (child, stat) in entries {
        let name = path_name(&child);
        if name == "." || name == ".." {
            continue;
        }
        let child_path = if child.is_absolute() {
            child
        } else {
            path.join(&name)
        };
        if stat.is_dir() {
            remove_remote_dir(sftp, &child_path)?;
        } else {
            sftp.unlink(&child_path)
                .map_err(|e| format!("Failed to delete remote file: {e}"))?;
        }
    }
    sftp.rmdir(path)
        .map_err(|e| format!("Failed to delete remote folder: {e}"))
}

fn is_would_block(err: &std::io::Error) -> bool {
    err.kind() == std::io::ErrorKind::WouldBlock
        || err.to_string().contains("Would block")
        || err.to_string().contains("EAGAIN")
}

fn copy_remote_via_cp(
    session: &Session,
    from: &str,
    to: &str,
    progress: &mut Progress,
) -> Result<(), String> {
    progress.check()?;
    let parent = parent_remote(to);
    let _ = mkdir_remote(session, &parent);
    progress.check()?;
    let cmd = format!(
        "cp -a -- {} {}",
        shell_quote(from),
        shell_quote(to)
    );
    let mut channel = session
        .channel_session()
        .map_err(|e| format!("SSH channel failed: {e}"))?;
    channel
        .exec(&cmd)
        .map_err(|e| format!("Remote copy failed: {e}"))?;

    // Non-blocking poll so Cancel can interrupt server-side cp.
    session.set_blocking(false);
    let mut buf = [0u8; 1024];
    let wait_result = (|| -> Result<(), String> {
        loop {
            if let Err(err) = progress.check() {
                let _ = channel.close();
                return Err(err);
            }
            match channel.read(&mut buf) {
                Ok(0) => {
                    if channel.eof() {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(30));
                }
                Ok(_) => {}
                Err(e) if is_would_block(&e) => {
                    std::thread::sleep(Duration::from_millis(30));
                }
                Err(e) => return Err(format!("Remote copy failed: {e}")),
            }
        }
        Ok(())
    })();
    session.set_blocking(true);

    let _ = channel.wait_close();
    if let Err(err) = wait_result {
        let _ = remove_remote_via_exec(session, to);
        return Err(err);
    }

    let status = channel.exit_status().unwrap_or(-1);
    if status != 0 {
        let mut stderr = String::new();
        let _ = channel.stderr().read_to_string(&mut stderr);
        let detail = stderr.trim();
        return Err(if detail.is_empty() {
            format!("Remote copy failed (exit {status}).")
        } else {
            format!("Remote copy failed: {detail}")
        });
    }
    Ok(())
}

fn tar_unavailable(err: &str) -> bool {
    // Only fall back to SFTP when tar never started streaming.
    // Cancel / mid-transfer errors must NOT fall through (that ignored Cancel).
    err.starts_with("Local tar failed")
        || err.starts_with("Remote tar failed")
        || err.starts_with("SSH channel failed")
}

/// Stream a remote directory (or file) via `tar` into a local path. One SSH round-trip for trees.
fn download_via_tar(
    session: &Session,
    remote: &str,
    local: &Path,
    progress: &mut Progress,
) -> Result<u64, String> {
    progress.check()?;
    let parent = parent_remote(remote);
    let name = path_name(Path::new(remote));
    let local_parent = local
        .parent()
        .ok_or_else(|| "Invalid local destination.".to_string())?;
    fs::create_dir_all(local_parent).map_err(|e| format!("Failed to create folder: {e}"))?;

    let cmd = format!(
        "tar cf - -C {} {}",
        shell_quote(&parent),
        shell_quote(&name)
    );
    let mut channel = session
        .channel_session()
        .map_err(|e| format!("SSH channel failed: {e}"))?;
    channel
        .exec(&cmd)
        .map_err(|e| format!("Remote tar failed: {e}"))?;

    let mut child = Command::new("tar")
        .args(["xf", "-", "-C", &local_parent.to_string_lossy()])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Local tar failed: {e}"))?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open local tar stdin.".to_string())?;
    let mut buf = vec![0u8; TRANSFER_BUF];
    let mut total = 0u64;
    let pump = (|| -> Result<u64, String> {
        loop {
            progress.check()?;
            let n = channel
                .read(&mut buf)
                .map_err(|e| format!("Failed to read remote tar: {e}"))?;
            if n == 0 {
                break;
            }
            stdin
                .write_all(&buf[..n])
                .map_err(|e| format!("Failed to write local tar: {e}"))?;
            total += n as u64;
            progress.add(n as u64)?;
        }
        Ok(total)
    })();

    drop(stdin);
    if pump.is_err() {
        let _ = child.kill();
        let _ = channel.close();
    }
    let wait = child.wait_with_output();
    let _ = channel.wait_close();
    let remote_status = channel.exit_status().unwrap_or(-1);

    if let Err(err) = pump {
        let _ = if local.exists() {
            if local.is_dir() {
                fs::remove_dir_all(local)
            } else {
                fs::remove_file(local)
            }
        } else {
            Ok(())
        };
        return Err(err);
    }

    let wait = wait.map_err(|e| format!("Local tar failed: {e}"))?;
    if !wait.status.success() || remote_status != 0 {
        let _ = if local.exists() {
            if local.is_dir() {
                fs::remove_dir_all(local)
            } else {
                fs::remove_file(local)
            }
        } else {
            Ok(())
        };
        let err_msg = String::from_utf8_lossy(&wait.stderr);
        return Err(if err_msg.trim().is_empty() {
            format!("Tar download failed (remote exit {remote_status}).")
        } else {
            format!("Tar download failed: {}", err_msg.trim())
        });
    }
    Ok(total)
}

/// Stream a local directory (or file) via `tar` to the remote host.
fn upload_via_tar(
    session: &Session,
    local: &Path,
    remote: &str,
    progress: &mut Progress,
) -> Result<u64, String> {
    progress.check()?;
    let local_parent = local
        .parent()
        .ok_or_else(|| "Invalid local source.".to_string())?;
    let name = path_name(local);
    let remote_parent = parent_remote(remote);
    mkdir_remote(session, &remote_parent)?;
    progress.check()?;

    let cmd = format!("tar xf - -C {}", shell_quote(&remote_parent));
    let mut channel = session
        .channel_session()
        .map_err(|e| format!("SSH channel failed: {e}"))?;
    channel
        .exec(&cmd)
        .map_err(|e| format!("Remote tar failed: {e}"))?;

    let mut child = Command::new("tar")
        .args([
            "cf",
            "-",
            "-C",
            &local_parent.to_string_lossy(),
            &name,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Local tar failed: {e}"))?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to open local tar stdout.".to_string())?;
    let mut buf = vec![0u8; TRANSFER_BUF];
    let mut total = 0u64;
    let pump = (|| -> Result<u64, String> {
        loop {
            progress.check()?;
            let n = stdout
                .read(&mut buf)
                .map_err(|e| format!("Failed to read local tar: {e}"))?;
            if n == 0 {
                break;
            }
            channel
                .write_all(&buf[..n])
                .map_err(|e| format!("Failed to write remote tar: {e}"))?;
            total += n as u64;
            progress.add(n as u64)?;
        }
        Ok(total)
    })();

    if pump.is_err() {
        let _ = child.kill();
        let _ = channel.close();
    } else {
        let _ = channel.send_eof();
    }
    let _ = channel.wait_close();
    let remote_status = channel.exit_status().unwrap_or(-1);
    let wait = child.wait_with_output();

    if let Err(err) = pump {
        let _ = remove_remote_via_exec(session, remote);
        return Err(err);
    }

    let wait = wait.map_err(|e| format!("Local tar failed: {e}"))?;
    if !wait.status.success() || remote_status != 0 {
        let _ = remove_remote_via_exec(session, remote);
        let err_msg = String::from_utf8_lossy(&wait.stderr);
        return Err(if err_msg.trim().is_empty() {
            format!("Tar upload failed (remote exit {remote_status}).")
        } else {
            format!("Tar upload failed: {}", err_msg.trim())
        });
    }
    Ok(total)
}

fn copy_local_recursive(
    from: &Path,
    to: &Path,
    progress: &mut Progress,
    buf: &mut [u8],
) -> Result<u64, String> {
    progress.check()?;
    if from.is_file() {
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create folder: {e}"))?;
        }
        let mut src = File::open(from).map_err(|e| format!("Failed to open local file: {e}"))?;
        let mut dst =
            File::create(to).map_err(|e| format!("Failed to create local file: {e}"))?;
        let mut total = 0u64;
        let result = (|| -> Result<u64, String> {
            loop {
                progress.check()?;
                let n = src
                    .read(buf)
                    .map_err(|e| format!("Failed to read local file: {e}"))?;
                if n == 0 {
                    break;
                }
                dst.write_all(&buf[..n])
                    .map_err(|e| format!("Failed to write local file: {e}"))?;
                total += n as u64;
                progress.add(n as u64)?;
            }
            Ok(total)
        })();
        if result.is_err() {
            drop(dst);
            let _ = fs::remove_file(to);
        }
        result
    } else if from.is_dir() {
        fs::create_dir_all(to).map_err(|e| format!("Failed to create folder: {e}"))?;
        let mut total = 0u64;
        for item in fs::read_dir(from).map_err(|e| format!("Failed to read folder: {e}"))? {
            progress.check()?;
            let item = item.map_err(|e| format!("Failed to read entry: {e}"))?;
            total += copy_local_recursive(&item.path(), &to.join(item.file_name()), progress, buf)?;
        }
        Ok(total)
    } else {
        Err("Unsupported local entry type.".into())
    }
}

fn upload_path(
    session: &Session,
    sftp: &ssh2::Sftp,
    local: &Path,
    remote: &Path,
    progress: &mut Progress,
    buf: &mut [u8],
) -> Result<u64, String> {
    progress.check()?;
    if local.is_dir() {
        let remote_str = remote.to_string_lossy();
        match upload_via_tar(session, local, &remote_str, progress) {
            Ok(n) => return Ok(n),
            Err(err) if err == TRANSFER_CANCELLED => return Err(err),
            Err(err) if tar_unavailable(&err) => {
                // Tar missing / channel won't open — fall back to SFTP walk.
            }
            Err(err) => return Err(err),
        }
        let _ = sftp.mkdir(remote, 0o755);
        let mut total = 0u64;
        for item in fs::read_dir(local).map_err(|e| format!("Failed to read folder: {e}"))? {
            progress.check()?;
            let item = item.map_err(|e| format!("Failed to read entry: {e}"))?;
            let name = item.file_name();
            total += upload_path(
                session,
                sftp,
                &item.path(),
                &remote.join(name),
                progress,
                buf,
            )?;
        }
        return Ok(total);
    }

    if !local.is_file() {
        return Err("Unsupported local entry type.".into());
    }

    if let Some(parent) = remote.parent() {
        let _ = mkdir_remote(session, &parent.to_string_lossy());
    }
    let mut src = File::open(local).map_err(|e| format!("Failed to open local file: {e}"))?;
    let mut dst = sftp
        .create(remote)
        .map_err(|e| format!("Failed to create remote file: {e}"))?;
    let mut total = 0u64;
    let result = (|| -> Result<u64, String> {
        loop {
            progress.check()?;
            let n = src
                .read(buf)
                .map_err(|e| format!("Failed to read local file: {e}"))?;
            if n == 0 {
                break;
            }
            dst.write_all(&buf[..n])
                .map_err(|e| format!("Failed to write remote file: {e}"))?;
            total += n as u64;
            progress.add(n as u64)?;
        }
        Ok(total)
    })();
    if result.is_err() {
        drop(dst);
        let _ = sftp.unlink(remote);
    }
    result
}

fn download_path(
    session: &Session,
    sftp: &ssh2::Sftp,
    remote: &Path,
    local: &Path,
    is_dir: bool,
    progress: &mut Progress,
    buf: &mut [u8],
) -> Result<u64, String> {
    progress.check()?;
    if is_dir {
        let remote_str = remote.to_string_lossy();
        match download_via_tar(session, &remote_str, local, progress) {
            Ok(n) => return Ok(n),
            Err(err) if err == TRANSFER_CANCELLED => return Err(err),
            Err(err) if tar_unavailable(&err) => {
                // Tar missing / channel won't open — fall back to SFTP walk.
            }
            Err(err) => return Err(err),
        }
        fs::create_dir_all(local).map_err(|e| format!("Failed to create folder: {e}"))?;
        let entries = sftp
            .readdir(remote)
            .map_err(|e| format!("Failed to list remote folder: {e}"))?;
        let mut total = 0u64;
        for (child, stat) in entries {
            progress.check()?;
            let name = path_name(&child);
            if name == "." || name == ".." {
                continue;
            }
            let child_remote = if child.is_absolute() {
                child
            } else {
                remote.join(&name)
            };
            total += download_path(
                session,
                sftp,
                &child_remote,
                &local.join(name),
                stat.is_dir(),
                progress,
                buf,
            )?;
        }
        return Ok(total);
    }

    if let Some(parent) = local.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create folder: {e}"))?;
    }
    let mut src = sftp
        .open(remote)
        .map_err(|e| format!("Failed to open remote file: {e}"))?;
    let mut dst = File::create(local).map_err(|e| format!("Failed to create local file: {e}"))?;
    let mut total = 0u64;
    let result = (|| -> Result<u64, String> {
        loop {
            progress.check()?;
            let n = src
                .read(buf)
                .map_err(|e| format!("Failed to read remote file: {e}"))?;
            if n == 0 {
                break;
            }
            dst.write_all(&buf[..n])
                .map_err(|e| format!("Failed to write local file: {e}"))?;
            total += n as u64;
            progress.add(n as u64)?;
        }
        Ok(total)
    })();
    if result.is_err() {
        drop(dst);
        let _ = fs::remove_file(local);
    }
    result
}

fn local_transfer_total(path: &Path, is_dir: bool, known_size: Option<u64>) -> u64 {
    if let Some(size) = known_size {
        if !is_dir {
            return size;
        }
    }
    if is_dir {
        0
    } else {
        fs::metadata(path).map(|m| m.len()).unwrap_or(0)
    }
}

#[tauri::command]
pub fn cancel_sftp_transfer(state: State<'_, SftpState>, transfer_id: String) {
    if let Ok(map) = state.cancel_flags.lock() {
        if let Some(flag) = map.get(&transfer_id) {
            flag.store(true, Ordering::SeqCst);
        }
    }
}

#[tauri::command]
pub async fn transfer_entries(
    app: AppHandle,
    state: State<'_, SftpState>,
    transfer_id: String,
    source_kind: String,
    source_session_id: Option<String>,
    dest_kind: String,
    dest_session_id: Option<String>,
    source_path: String,
    source_is_dir: bool,
    dest_dir: String,
    entry_name: String,
    entry_size: Option<u64>,
) -> Result<TransferResult, String> {
    if transfer_id.trim().is_empty() {
        return Err("Missing transfer id.".into());
    }
    let cancel = begin_transfer_cancel(&state, &transfer_id)?;
    let tid = transfer_id.clone();

    let dest_path_local = PathBuf::from(&dest_dir).join(&entry_name);
    let dest_path_remote = join_remote(&dest_dir, &entry_name);
    let source = PathBuf::from(&source_path);
    let entry_name_owned = entry_name.clone();

    let result = match (source_kind.as_str(), dest_kind.as_str()) {
        ("local", "local") => {
            let app = app.clone();
            let cancel = Arc::clone(&cancel);
            let transfer_id = transfer_id.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let total = local_transfer_total(&source, source_is_dir, entry_size);
                let mut progress = Progress::new(
                    app,
                    transfer_id,
                    entry_name_owned.clone(),
                    total,
                    cancel,
                );
                let mut buf = vec![0u8; TRANSFER_BUF];
                let bytes =
                    copy_local_recursive(&source, &dest_path_local, &mut progress, &mut buf)?;
                progress.finish();
                Ok::<TransferResult, String>(TransferResult {
                    transferred: bytes,
                    message: format!("Copied “{entry_name_owned}”."),
                })
            })
            .await
            .map_err(|e| format!("Transfer task failed: {e}"))?
        }
        ("local", "remote") => {
            let session_id = dest_session_id.ok_or("Missing destination SFTP session.")?;
            let auth = get_auth(&state, &session_id)?;
            let app = app.clone();
            let cancel = Arc::clone(&cancel);
            let transfer_id = transfer_id.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let total = local_transfer_total(&source, source_is_dir, entry_size);
                let mut progress = Progress::new(
                    app,
                    transfer_id,
                    entry_name_owned.clone(),
                    total,
                    cancel,
                );
                let mut buf = vec![0u8; TRANSFER_BUF];
                let session = establish_session(&auth)?;
                let sftp = session
                    .sftp()
                    .map_err(|e| format!("SFTP open failed: {e}"))?;
                let bytes = upload_path(
                    &session,
                    &sftp,
                    &source,
                    Path::new(&dest_path_remote),
                    &mut progress,
                    &mut buf,
                )?;
                progress.finish();
                Ok::<TransferResult, String>(TransferResult {
                    transferred: bytes,
                    message: format!("Uploaded “{entry_name_owned}”."),
                })
            })
            .await
            .map_err(|e| format!("Transfer task failed: {e}"))?
        }
        ("remote", "local") => {
            let session_id = source_session_id.ok_or("Missing source SFTP session.")?;
            let auth = get_auth(&state, &session_id)?;
            let app = app.clone();
            let cancel = Arc::clone(&cancel);
            let transfer_id = transfer_id.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let session = establish_session(&auth)?;
                let sftp = session
                    .sftp()
                    .map_err(|e| format!("SFTP open failed: {e}"))?;
                let total = if source_is_dir {
                    0
                } else {
                    entry_size.unwrap_or_else(|| {
                        sftp.stat(&source).ok().and_then(|s| s.size).unwrap_or(0)
                    })
                };
                let mut progress = Progress::new(
                    app,
                    transfer_id,
                    entry_name_owned.clone(),
                    total,
                    cancel,
                );
                let mut buf = vec![0u8; TRANSFER_BUF];
                let bytes = download_path(
                    &session,
                    &sftp,
                    &source,
                    &dest_path_local,
                    source_is_dir,
                    &mut progress,
                    &mut buf,
                )?;
                progress.finish();
                Ok::<TransferResult, String>(TransferResult {
                    transferred: bytes,
                    message: format!("Downloaded “{entry_name_owned}”."),
                })
            })
            .await
            .map_err(|e| format!("Transfer task failed: {e}"))?
        }
        ("remote", "remote") => {
            let src_id = source_session_id.ok_or("Missing source SFTP session.")?;
            let dst_id = dest_session_id.ok_or("Missing destination SFTP session.")?;
            let src_auth = get_auth(&state, &src_id)?;
            let dst_auth = get_auth(&state, &dst_id)?;
            let same_host = src_auth.endpoint == dst_auth.endpoint;
            let app = app.clone();
            let cancel = Arc::clone(&cancel);
            let transfer_id = transfer_id.clone();
            tauri::async_runtime::spawn_blocking(move || {
                if same_host {
                    let session = establish_session(&src_auth)?;
                    let mut progress = Progress::new(
                        app,
                        transfer_id,
                        entry_name_owned.clone(),
                        0,
                        cancel,
                    );
                    copy_remote_via_cp(
                        &session,
                        &source_path,
                        &dest_path_remote,
                        &mut progress,
                    )?;
                    progress.finish();
                    return Ok(TransferResult {
                        transferred: 0,
                        message: format!("Copied “{entry_name_owned}” on host."),
                    });
                }

                let total = if source_is_dir {
                    0
                } else {
                    entry_size.unwrap_or(0).saturating_mul(2)
                };
                let mut progress = Progress::new(
                    app,
                    transfer_id,
                    entry_name_owned.clone(),
                    total,
                    cancel,
                );
                let mut buf = vec![0u8; TRANSFER_BUF];

                let mut temp = std::env::temp_dir();
                temp.push(format!(
                    "foxinal-sftp-{}-{}-{}",
                    std::process::id(),
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis())
                        .unwrap_or(0),
                    path_name(&source)
                ));
                if temp.exists() {
                    let _ = if temp.is_dir() {
                        fs::remove_dir_all(&temp)
                    } else {
                        fs::remove_file(&temp)
                    };
                }

                let src_session = establish_session(&src_auth)?;
                let src_sftp = src_session
                    .sftp()
                    .map_err(|e| format!("SFTP open failed: {e}"))?;
                let bytes = download_path(
                    &src_session,
                    &src_sftp,
                    &source,
                    &temp,
                    source_is_dir,
                    &mut progress,
                    &mut buf,
                )?;
                drop(src_sftp);
                drop(src_session);

                let dst_session = establish_session(&dst_auth)?;
                let dst_sftp = dst_session
                    .sftp()
                    .map_err(|e| format!("SFTP open failed: {e}"))?;
                let upload_result = upload_path(
                    &dst_session,
                    &dst_sftp,
                    &temp,
                    Path::new(&dest_path_remote),
                    &mut progress,
                    &mut buf,
                );

                if temp.is_dir() {
                    let _ = fs::remove_dir_all(&temp);
                } else {
                    let _ = fs::remove_file(&temp);
                }

                let uploaded = upload_result?;
                progress.finish();
                Ok::<TransferResult, String>(TransferResult {
                    transferred: bytes.max(uploaded),
                    message: format!("Transferred “{entry_name_owned}” between hosts."),
                })
            })
            .await
            .map_err(|e| format!("Transfer task failed: {e}"))?
        }
        _ => Err("Unsupported transfer direction.".into()),
    };

    end_transfer_cancel(&state, &tid);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes_label() {
        assert_eq!(format_bytes_label(0), "0 B");
        assert_eq!(format_bytes_label(512), "512 B");
        assert_eq!(format_bytes_label(1024), "1.0 KB");
        assert_eq!(format_bytes_label(1536), "1.5 KB");
        assert_eq!(format_bytes_label(1024 * 1024), "1.0 MB");
        assert_eq!(format_bytes_label(1024 * 1024 * 1024), "1.00 GB");
        assert_eq!(format_bytes_label(5 * 1024 * 1024 * 1024), "5.00 GB");
    }

    #[test]
    fn test_is_hidden_name() {
        assert!(is_hidden_name(".bashrc"));
        assert!(is_hidden_name(".config"));
        assert!(!is_hidden_name("."));
        assert!(!is_hidden_name(".."));
        assert!(!is_hidden_name("document.pdf"));
        assert!(!is_hidden_name("folder"));
    }

    #[test]
    fn test_format_modified_label() {
        assert_eq!(format_modified_label(None), "—");
        // 0 secs = 1970-01-01 00:00 UTC
        assert_eq!(format_modified_label(Some(0)), "1970-01-01 00:00");
        // 1700000000 = 2023-11-14 22:13 UTC
        assert_eq!(format_modified_label(Some(1700000000)), "2023-11-14 22:13");
    }

    #[test]
    fn test_join_remote() {
        assert_eq!(join_remote("/var", "log"), "/var/log");
        assert_eq!(join_remote("/var/", "log"), "/var/log");
        assert_eq!(join_remote("/", "etc"), "/etc");
        assert_eq!(join_remote("", "root"), "/root");
    }

    #[test]
    fn test_parent_remote() {
        assert_eq!(parent_remote("/var/log/nginx"), "/var/log");
        assert_eq!(parent_remote("/var/log"), "/var");
        assert_eq!(parent_remote("/var"), "/");
        assert_eq!(parent_remote("/"), "/");
        assert_eq!(parent_remote(""), "/");
    }

    #[test]
    fn test_shell_quote() {
        assert_eq!(shell_quote("simple"), "'simple'");
        assert_eq!(shell_quote("file with spaces.txt"), "'file with spaces.txt'");
        assert_eq!(shell_quote("it's"), "'it'\\''s'");
    }

    #[test]
    fn test_assert_safe_remote_delete() {
        assert!(assert_safe_remote_delete("/").is_err());
        assert!(assert_safe_remote_delete("  ").is_err());
        assert!(assert_safe_remote_delete(".").is_err());
        assert!(assert_safe_remote_delete("..").is_err());
        assert!(assert_safe_remote_delete("/tmp/test_dir").is_ok());
        assert!(assert_safe_remote_delete("/home/user/file.txt").is_ok());
    }

    #[test]
    fn test_sort_entries() {
        let mut entries = vec![
            FsEntry {
                name: "zebra.txt".into(),
                path: "/zebra.txt".into(),
                kind: "file".into(),
                size: 100,
                modified: None,
                hidden: false,
                size_label: "100 B".into(),
                modified_label: "—".into(),
            },
            FsEntry {
                name: "alpha_dir".into(),
                path: "/alpha_dir".into(),
                kind: "dir".into(),
                size: 0,
                modified: None,
                hidden: false,
                size_label: "—".into(),
                modified_label: "—".into(),
            },
            FsEntry {
                name: "apple.txt".into(),
                path: "/apple.txt".into(),
                kind: "file".into(),
                size: 50,
                modified: None,
                hidden: false,
                size_label: "50 B".into(),
                modified_label: "—".into(),
            },
            FsEntry {
                name: "beta_dir".into(),
                path: "/beta_dir".into(),
                kind: "dir".into(),
                size: 0,
                modified: None,
                hidden: false,
                size_label: "—".into(),
                modified_label: "—".into(),
            },
        ];

        sort_entries(&mut entries);

        // Directories first (alpha_dir, beta_dir), then files (apple.txt, zebra.txt)
        assert_eq!(entries[0].name, "alpha_dir");
        assert_eq!(entries[1].name, "beta_dir");
        assert_eq!(entries[2].name, "apple.txt");
        assert_eq!(entries[3].name, "zebra.txt");
    }
}

