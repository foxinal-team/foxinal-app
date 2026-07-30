//! Foxinal fork of tauri-plugin-pty 0.3.1.
//!
//! Upstream runs blocking PTY `read` / `wait` on the async runtime, which
//! freezes the whole app once a few idle sessions exist (common on Linux).
//! All blocking IO is moved onto `spawn_blocking`.

use std::{
    collections::BTreeMap,
    ffi::OsString,
    io::{Read, Write},
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc, Mutex,
    },
};

use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, PtyPair, PtySize};
use tauri::{
    async_runtime::RwLock,
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};

#[derive(Default)]
struct PluginState {
    session_id: AtomicU32,
    sessions: RwLock<BTreeMap<PtyHandler, Arc<Session>>>,
}

struct Session {
    pair: Mutex<PtyPair>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
    child_killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    writer: Mutex<Box<dyn Write + Send>>,
    reader: Mutex<Box<dyn Read + Send>>,
}

type PtyHandler = u32;

fn lock_err<T>(r: Result<T, std::sync::PoisonError<T>>) -> Result<T, String> {
    r.map_err(|_| "PTY lock poisoned".into())
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
async fn spawn<R: Runtime>(
    file: String,
    args: Vec<String>,
    term_name: Option<String>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    env: BTreeMap<String, String>,
    encoding: Option<String>,
    handle_flow_control: Option<bool>,
    flow_control_pause: Option<String>,
    flow_control_resume: Option<String>,
    state: tauri::State<'_, PluginState>,
    _app_handle: AppHandle<R>,
) -> Result<PtyHandler, String> {
    let _ = term_name;
    let _ = encoding;
    let _ = handle_flow_control;
    let _ = flow_control_pause;
    let _ = flow_control_resume;

    let session = tauri::async_runtime::spawn_blocking(move || {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
        let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

        let mut cmd = CommandBuilder::new(file);
        cmd.args(args);
        if let Some(cwd) = cwd {
            cmd.cwd(OsString::from(cwd));
        }
        for (k, v) in env.iter() {
            cmd.env(OsString::from(k), OsString::from(v));
        }
        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        let child_killer = child.clone_killer();

        Ok::<Session, String>(Session {
            pair: Mutex::new(pair),
            child: Mutex::new(child),
            child_killer: Mutex::new(child_killer),
            writer: Mutex::new(writer),
            reader: Mutex::new(reader),
        })
    })
    .await
    .map_err(|e| format!("PTY spawn task failed: {e}"))??;

    let handler = state.session_id.fetch_add(1, Ordering::Relaxed);
    state
        .sessions
        .write()
        .await
        .insert(handler, Arc::new(session));
    Ok(handler)
}

#[tauri::command]
async fn write(
    pid: PtyHandler,
    data: String,
    state: tauri::State<'_, PluginState>,
) -> Result<(), String> {
    let session = state
        .sessions
        .read()
        .await
        .get(&pid)
        .ok_or_else(|| "Unavailable pid".to_string())?
        .clone();

    tauri::async_runtime::spawn_blocking(move || {
        lock_err(session.writer.lock())?
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("PTY write task failed: {e}"))?
}

#[tauri::command]
async fn read(
    pid: PtyHandler,
    state: tauri::State<'_, PluginState>,
) -> Result<tauri::ipc::Response, String> {
    let session = state
        .sessions
        .read()
        .await
        .get(&pid)
        .ok_or_else(|| "Unavailable pid".to_string())?
        .clone();

    tauri::async_runtime::spawn_blocking(move || {
        let mut buf = vec![0u8; 4096];
        let n = lock_err(session.reader.lock())?
            .read(&mut buf)
            .map_err(|e| e.to_string())?;
        if n == 0 {
            Err(String::from("EOF"))
        } else {
            buf.truncate(n);
            Ok(tauri::ipc::Response::new(buf))
        }
    })
    .await
    .map_err(|e| format!("PTY read task failed: {e}"))?
}

#[tauri::command]
async fn resize(
    pid: PtyHandler,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, PluginState>,
) -> Result<(), String> {
    let session = state
        .sessions
        .read()
        .await
        .get(&pid)
        .ok_or_else(|| "Unavailable pid".to_string())?
        .clone();

    tauri::async_runtime::spawn_blocking(move || {
        lock_err(session.pair.lock())?
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("PTY resize task failed: {e}"))?
}

#[tauri::command]
async fn kill(pid: PtyHandler, state: tauri::State<'_, PluginState>) -> Result<(), String> {
    let session = state
        .sessions
        .read()
        .await
        .get(&pid)
        .ok_or_else(|| "Unavailable pid".to_string())?
        .clone();

    tauri::async_runtime::spawn_blocking(move || {
        lock_err(session.child_killer.lock())?
            .kill()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("PTY kill task failed: {e}"))?
}

#[tauri::command]
async fn exitstatus(pid: PtyHandler, state: tauri::State<'_, PluginState>) -> Result<u32, String> {
    let session = state
        .sessions
        .read()
        .await
        .get(&pid)
        .ok_or_else(|| "Unavailable pid".to_string())?
        .clone();

    let exitstatus = tauri::async_runtime::spawn_blocking(move || {
        lock_err(session.child.lock())?
            .wait()
            .map_err(|e| e.to_string())
            .map(|status| status.exit_code())
    })
    .await
    .map_err(|e| format!("PTY wait task failed: {e}"))??;

    let _ = state.sessions.write().await.remove(&pid);
    Ok(exitstatus)
}

#[tauri::command]
async fn get_all_pids(state: tauri::State<'_, PluginState>) -> Result<Vec<PtyHandler>, String> {
    let sessions = state.sessions.read().await;
    Ok(sessions.keys().copied().collect())
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("pty")
        .invoke_handler(tauri::generate_handler![
            spawn,
            write,
            read,
            resize,
            kill,
            exitstatus,
            get_all_pids
        ])
        .setup(|app_handle, _api| {
            app_handle.manage(PluginState::default());
            Ok(())
        })
        .build()
}
