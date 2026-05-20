use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const EVENT_OUTPUT: &str = "terminal-output";

#[derive(Clone, Serialize)]
struct TerminalOutputPayload {
    id: String,
    data: String,
}

struct TerminalSession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    _child: Box<dyn portable_pty::Child + Send + Sync>,
    master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
}

pub struct TerminalState {
    sessions: Mutex<HashMap<String, TerminalSession>>,
}

impl Default for TerminalState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

fn default_shell(cwd: Option<&str>) -> CommandBuilder {
    let mut cmd = if cfg!(windows) {
        let mut c = CommandBuilder::new("powershell.exe");
        c.args(["-NoLogo", "-NoProfile"]);
        c.env("TERM", "xterm-256color");
        c.env("POWERSHELL_TELEMETRY_OPTOUT", "1");
        c.env("PSREADLINE_PREDICTION_SOURCE", "None");
        c.env("PSREADLINE_PREDICTION_VIEWSTYLE", "Off");
        c.env("VSCODE_INJECTION", "0");
        c.env("VSCODE_IPC_HOOK", "");
        c.env("WT_SESSION", "");
        c
    } else {
        let mut c = CommandBuilder::new("bash");
        c.env("TERM", "xterm-256color");
        c
    };

    if let Some(dir) = cwd {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            let path = std::path::Path::new(trimmed);
            if path.is_dir() {
                cmd.cwd(trimmed);
            }
        }
    }
    cmd
}

#[tauri::command]
pub fn terminal_spawn(
    app: AppHandle,
    state: State<'_, TerminalState>,
    id: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|e| format!("Terminal state lock poisoned: {e}"))?;
        sessions.remove(&id);
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Could not open PTY: {e}"))?;

    let cmd = default_shell(cwd.as_deref());
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Could not start shell: {e}"))?;
    drop(pair.slave);

    let master = pair.master;
    let reader = master
        .try_clone_reader()
        .map_err(|e| format!("Could not clone PTY reader: {e}"))?;
    let writer = master
        .take_writer()
        .map_err(|e| format!("Could not take PTY writer: {e}"))?;

    let writer = Arc::new(Mutex::new(writer));
    let master = Arc::new(Mutex::new(master));

    let session_id = id.clone();
    let app_reader = app.clone();
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let _ = app_reader.emit(
                        EVENT_OUTPUT,
                        TerminalOutputPayload {
                            id: session_id.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    let session = TerminalSession {
        writer,
        _child: child,
        master,
    };

    state
        .sessions
        .lock()
        .map_err(|e| format!("Terminal state lock poisoned: {e}"))?
        .insert(id, session);

    Ok(())
}

#[tauri::command]
pub fn terminal_write(
    state: State<'_, TerminalState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Terminal state lock poisoned: {e}"))?;
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("Unknown terminal session: {id}"))?;
    let mut writer = session
        .writer
        .lock()
        .map_err(|e| format!("Terminal writer lock poisoned: {e}"))?;
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Could not write to terminal: {e}"))?;
    writer
        .flush()
        .map_err(|e| format!("Could not flush terminal: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    state: State<'_, TerminalState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Terminal state lock poisoned: {e}"))?;
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("Unknown terminal session: {id}"))?;
    let master = session
        .master
        .lock()
        .map_err(|e| format!("Terminal master lock poisoned: {e}"))?;
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Could not resize terminal: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn terminal_kill(state: State<'_, TerminalState>, id: String) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Terminal state lock poisoned: {e}"))?;
    sessions.remove(&id);
    Ok(())
}
