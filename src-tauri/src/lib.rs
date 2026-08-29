use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

mod sftp;

use sftp::{
    cancel_sftp_transfer, fs_create_file, fs_home_dir, fs_list_dir, fs_mkdir, fs_parent_dir,
    fs_remove, fs_rename, sftp_connect, sftp_create_file, sftp_disconnect, sftp_home_dir,
    sftp_list_dir, sftp_mkdir, sftp_parent_dir, sftp_remove, sftp_rename, transfer_entries,
    SftpState,
};

const KNOWN_HOSTS_FILE: &str = "ssh_known_hosts";

fn app_known_hosts_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create app data dir: {e}"))?;
    Ok(dir.join(KNOWN_HOSTS_FILE))
}

fn global_known_hosts_null() -> &'static str {
    if cfg!(windows) {
        "NUL"
    } else {
        "/dev/null"
    }
}

fn unique_download_path(dir: &std::path::Path, filename: &str) -> PathBuf {
    let safe_name = PathBuf::from(filename)
        .file_name()
        .map(|n| n.to_owned())
        .unwrap_or_else(|| std::ffi::OsString::from("foxinal-export.json"));
    let path = dir.join(&safe_name);
    if !path.exists() {
        return path;
    }

    let stem = PathBuf::from(&safe_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("foxinal-export")
        .to_string();
    let ext = PathBuf::from(&safe_name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("json")
        .to_string();

    for i in 1..10_000 {
        let candidate = dir.join(format!("{stem} ({i}).{ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    dir.join(format!("{}-{}.{}", stem, uuid_like(), ext))
}

/// Write an inventory export JSON into the user's Downloads folder.
/// Returns the absolute path so the UI can reveal it in Finder / Files / Explorer.
#[tauri::command]
fn write_export_file(app: AppHandle, filename: String, contents: String) -> Result<String, String> {
    let downloads = app
        .path()
        .download_dir()
        .map_err(|e| format!("Could not resolve Downloads folder: {e}"))?;
    fs::create_dir_all(&downloads)
        .map_err(|e| format!("Could not create Downloads folder: {e}"))?;

    let path = unique_download_path(&downloads, &filename);
    fs::write(&path, contents).map_err(|e| format!("Could not write export file: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

/// Read a user-selected import file (dialog / drag-drop path).
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("No file path provided.".into());
    }
    let file_path = PathBuf::from(path);
    if !file_path.is_file() {
        return Err("That path is not a file.".into());
    }
    fs::read_to_string(&file_path).map_err(|e| format!("Could not read file: {e}"))
}

fn known_hosts_host_patterns(address: &str, port: u16) -> Vec<String> {
    let address = address.trim();
    let mut hosts = vec![address.to_string(), format!("[{address}]:{port}")];
    if port == 22 {
        hosts.push(format!("[{address}]"));
    }
    hosts.sort();
    hosts.dedup();
    hosts
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SshLaunch {
    program: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cleanup_paths: Vec<String>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(windows) {
            "powershell.exe".into()
        } else if cfg!(target_os = "macos") {
            "/bin/zsh".into()
        } else {
            "/bin/bash".into()
        }
    })
}

#[tauri::command]
fn prepare_ssh_launch(
    app: AppHandle,
    address: String,
    port: u16,
    username: String,
    auth_method: String,
    private_key: String,
) -> Result<SshLaunch, String> {
    let address = address.trim();
    let username = username.trim();
    if address.is_empty() {
        return Err("Host address is required.".into());
    }
    if username.is_empty() {
        return Err("Username is required.".into());
    }
    if port == 0 {
        return Err("Invalid SSH port.".into());
    }

    let program = if cfg!(windows) {
        "ssh.exe".to_string()
    } else {
        "ssh".to_string()
    };

    // Use Foxinal's own known_hosts so ~/.ssh mismatches don't block connects.
    let known_hosts = app_known_hosts_path(&app)?;
    // Ensure the file exists — OpenSSH can error if UserKnownHostsFile is missing.
    if !known_hosts.exists() {
        fs::File::create(&known_hosts)
            .map_err(|e| format!("Could not create known_hosts file: {e}"))?;
    }

    let mut args = vec![
        "-p".to_string(),
        port.to_string(),
        "-o".to_string(),
        "StrictHostKeyChecking=accept-new".to_string(),
        "-o".to_string(),
        format!("UserKnownHostsFile={}", known_hosts.display()),
        "-o".to_string(),
        format!("GlobalKnownHostsFile={}", global_known_hosts_null()),
        // Keep idle sessions alive when Foxinal is backgrounded (NAT / server idle kills).
        "-o".to_string(),
        "ServerAliveInterval=30".to_string(),
        "-o".to_string(),
        "ServerAliveCountMax=3".to_string(),
        "-o".to_string(),
        "TCPKeepAlive=yes".to_string(),
        "-tt".to_string(),
    ];

    let env = HashMap::new();
    let mut cleanup_paths = Vec::new();

    if auth_method == "key" {
        let key = private_key.trim();
        if key.is_empty() {
            return Err("Private key is empty.".into());
        }

        let path = write_temp_private_key(key)?;
        args.push("-i".to_string());
        args.push(path.display().to_string());
        args.push("-o".to_string());
        args.push("IdentitiesOnly=yes".to_string());
        cleanup_paths.push(path.display().to_string());
    } else {
        // Password is injected by the frontend when the PTY shows a password prompt.
        args.push("-o".to_string());
        args.push("PreferredAuthentications=password,keyboard-interactive".to_string());
        args.push("-o".to_string());
        args.push("PubkeyAuthentication=no".to_string());
        args.push("-o".to_string());
        args.push("NumberOfPasswordPrompts=3".to_string());
    }

    args.push(format!("{username}@{address}"));

    Ok(SshLaunch {
        program,
        args,
        env,
        cleanup_paths,
    })
}

#[tauri::command]
fn cleanup_ssh_temp(paths: Vec<String>) -> Result<(), String> {
    for path in paths {
        let path = PathBuf::from(path);
        if path.exists() {
            let _ = fs::remove_file(&path);
        }
    }
    Ok(())
}

/// Remove a host from Foxinal's known_hosts so the next connect can accept a new key.
#[tauri::command]
fn clear_ssh_host_key(app: AppHandle, address: String, port: u16) -> Result<(), String> {
    let address = address.trim();
    if address.is_empty() {
        return Err("Host address is required.".into());
    }
    if port == 0 {
        return Err("Invalid SSH port.".into());
    }

    let known_hosts = app_known_hosts_path(&app)?;
    if !known_hosts.exists() {
        return Ok(());
    }

    let program = if cfg!(windows) {
        "ssh-keygen.exe"
    } else {
        "ssh-keygen"
    };

    for host in known_hosts_host_patterns(address, port) {
        let _ = Command::new(program)
            .args([
                "-R",
                &host,
                "-f",
                &known_hosts.to_string_lossy(),
            ])
            .output();
    }

    // ssh-keygen leaves a `.old` backup — drop it quietly.
    let old = PathBuf::from(format!("{}.old", known_hosts.display()));
    if old.exists() {
        let _ = fs::remove_file(&old);
    }

    Ok(())
}

fn write_temp_private_key(private_key: &str) -> Result<PathBuf, String> {
    let mut path = std::env::temp_dir();
    path.push(format!("foxinal-ssh-{}.key", uuid_like()));

    let mut file = fs::File::create(&path)
        .map_err(|e| format!("Failed to create temporary key file: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(&path, perms)
            .map_err(|e| format!("Failed to set key permissions: {e}"))?;
    }

    let contents = if private_key.ends_with('\n') {
        private_key.to_string()
    } else {
        format!("{private_key}\n")
    };

    file
        .write_all(contents.as_bytes())
        .map_err(|e| format!("Failed to write private key: {e}"))?;

    Ok(path)
}

fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:x}")
}

#[tauri::command]
async fn clipboard_write_text(text: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        arboard::Clipboard::new()
            .map_err(|e| format!("Clipboard unavailable: {e}"))?
            .set_text(text)
            .map_err(|e| format!("Could not copy: {e}"))
    })
    .await
    .map_err(|e| format!("Clipboard write task failed: {e}"))?
}

#[tauri::command]
async fn clipboard_read_text() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        arboard::Clipboard::new()
            .map_err(|e| format!("Clipboard unavailable: {e}"))?
            .get_text()
            .map_err(|e| format!("Could not paste: {e}"))
    })
    .await
    .map_err(|e| format!("Clipboard read task failed: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_pty::init())
        .manage(SftpState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            default_shell,
            prepare_ssh_launch,
            cleanup_ssh_temp,
            clear_ssh_host_key,
            clipboard_write_text,
            clipboard_read_text,
            write_export_file,
            read_text_file,
            fs_home_dir,
            fs_list_dir,
            fs_parent_dir,
            fs_mkdir,
            fs_create_file,
            fs_remove,
            fs_rename,
            sftp_connect,
            sftp_disconnect,
            sftp_home_dir,
            sftp_list_dir,
            sftp_parent_dir,
            sftp_mkdir,
            sftp_create_file,
            sftp_remove,
            sftp_rename,
            cancel_sftp_transfer,
            transfer_entries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        assert_eq!(
            greet("Foxinal"),
            "Hello, Foxinal! You've been greeted from Rust!"
        );
    }

    #[test]
    fn test_default_shell_not_empty() {
        let shell = default_shell();
        assert!(!shell.trim().is_empty());
    }

    #[test]
    fn test_global_known_hosts_null() {
        let null_path = global_known_hosts_null();
        if cfg!(windows) {
            assert_eq!(null_path, "NUL");
        } else {
            assert_eq!(null_path, "/dev/null");
        }
    }

    #[test]
    fn test_known_hosts_host_patterns_port_22() {
        let patterns = known_hosts_host_patterns("192.168.1.10", 22);
        assert!(patterns.contains(&"192.168.1.10".to_string()));
        assert!(patterns.contains(&"[192.168.1.10]:22".to_string()));
        assert!(patterns.contains(&"[192.168.1.10]".to_string()));
    }

    #[test]
    fn test_known_hosts_host_patterns_custom_port() {
        let patterns = known_hosts_host_patterns("example.com", 2222);
        assert!(patterns.contains(&"example.com".to_string()));
        assert!(patterns.contains(&"[example.com]:2222".to_string()));
        assert!(!patterns.contains(&"[example.com]".to_string()));
    }

    #[test]
    fn test_uuid_like_length_and_hex() {
        let u1 = uuid_like();
        let u2 = uuid_like();
        assert!(!u1.is_empty());
        assert!(u1.chars().all(|c| c.is_ascii_hexdigit()));
        assert!(!u2.is_empty());
    }

    #[test]
    fn test_unique_download_path_no_conflict() {
        let temp_dir = std::env::temp_dir().join(format!("foxinal-test-{}", uuid_like()));
        let _ = fs::create_dir_all(&temp_dir);

        let path = unique_download_path(&temp_dir, "export.json");
        assert_eq!(path.file_name().unwrap(), "export.json");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_unique_download_path_with_conflict() {
        let temp_dir = std::env::temp_dir().join(format!("foxinal-test-{}", uuid_like()));
        let _ = fs::create_dir_all(&temp_dir);

        // Pre-create original file
        let original = temp_dir.join("export.json");
        let _ = fs::write(&original, "{}");

        let path = unique_download_path(&temp_dir, "export.json");
        assert_eq!(path.file_name().unwrap(), "export (1).json");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_write_and_cleanup_temp_private_key() {
        let key_data = "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----";
        let path = write_temp_private_key(key_data).expect("should write temp key");
        assert!(path.exists());

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = fs::metadata(&path).unwrap();
            let mode = metadata.permissions().mode() & 0o777;
            assert_eq!(mode, 0o600, "Unix private key must be permission 0600");
        }

        let read_back = fs::read_to_string(&path).unwrap();
        assert!(read_back.contains("BEGIN OPENSSH PRIVATE KEY"));

        let cleanup_res = cleanup_ssh_temp(vec![path.to_string_lossy().to_string()]);
        assert!(cleanup_res.is_ok());
        assert!(!path.exists(), "temp key must be deleted after cleanup");
    }

    #[test]
    fn test_read_text_file_validation() {
        assert!(read_text_file("".into()).is_err());
        assert!(read_text_file("/non/existent/path/foxinal.json".into()).is_err());
    }
}

