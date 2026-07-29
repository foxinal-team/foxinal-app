use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

mod sftp;

use sftp::{
    fs_home_dir, fs_list_dir, fs_mkdir, fs_parent_dir, fs_remove, fs_rename, sftp_connect, sftp_disconnect,
    sftp_home_dir, sftp_list_dir, sftp_mkdir, sftp_parent_dir, sftp_remove, sftp_rename, cancel_sftp_transfer,
    transfer_entries,
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
fn clipboard_write_text(text: String) -> Result<(), String> {
    arboard::Clipboard::new()
        .map_err(|e| format!("Clipboard unavailable: {e}"))?
        .set_text(text)
        .map_err(|e| format!("Could not copy: {e}"))
}

#[tauri::command]
fn clipboard_read_text() -> Result<String, String> {
    arboard::Clipboard::new()
        .map_err(|e| format!("Clipboard unavailable: {e}"))?
        .get_text()
        .map_err(|e| format!("Could not paste: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            fs_home_dir,
            fs_list_dir,
            fs_parent_dir,
            fs_mkdir,
            fs_remove,
            fs_rename,
            sftp_connect,
            sftp_disconnect,
            sftp_home_dir,
            sftp_list_dir,
            sftp_parent_dir,
            sftp_mkdir,
            sftp_remove,
            sftp_rename,
            cancel_sftp_transfer,
            transfer_entries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
