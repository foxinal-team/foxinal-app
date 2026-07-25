use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

mod sftp;

use sftp::{
    fs_home_dir, fs_list_dir, fs_mkdir, fs_parent_dir, fs_remove, sftp_connect, sftp_disconnect,
    sftp_home_dir, sftp_list_dir, sftp_mkdir, sftp_parent_dir, sftp_remove, cancel_sftp_transfer,
    transfer_entries,
    SftpState,
};

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

    let mut args = vec![
        "-p".to_string(),
        port.to_string(),
        "-o".to_string(),
        "StrictHostKeyChecking=accept-new".to_string(),
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
            fs_home_dir,
            fs_list_dir,
            fs_parent_dir,
            fs_mkdir,
            fs_remove,
            sftp_connect,
            sftp_disconnect,
            sftp_home_dir,
            sftp_list_dir,
            sftp_parent_dir,
            sftp_mkdir,
            sftp_remove,
            cancel_sftp_transfer,
            transfer_entries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
