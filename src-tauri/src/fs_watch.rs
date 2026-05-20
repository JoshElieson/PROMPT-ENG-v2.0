use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use notify::event::{Event, EventKind};
use notify::{Config, Error, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const EVENT_FS_CHANGED: &str = "project-fs-changed";
const DEBOUNCE: Duration = Duration::from_millis(250);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFsChangedPayload {
    pub root_path: String,
    pub paths: Vec<String>,
}

struct RootWatch {
    _watcher: RecommendedWatcher,
}

pub struct FsWatchState {
    roots: Mutex<HashMap<String, RootWatch>>,
}

impl Default for FsWatchState {
    fn default() -> Self {
        Self {
            roots: Mutex::new(HashMap::new()),
        }
    }
}

fn normalize_root(path: &str) -> String {
    path.trim_end_matches(|c| c == '/' || c == '\\').to_string()
}

fn is_relevant(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_) | EventKind::Any
    )
}

fn spawn_debounce_loop(app: AppHandle, root_path: String, rx: mpsc::Receiver<String>) {
    thread::spawn(move || {
        loop {
            let Ok(first) = rx.recv() else {
                break;
            };
            let mut batch = HashSet::from([first]);
            let deadline = Instant::now() + DEBOUNCE;
            loop {
                let remaining = deadline.saturating_duration_since(Instant::now());
                if remaining.is_zero() {
                    break;
                }
                match rx.recv_timeout(remaining) {
                    Ok(path) => {
                        batch.insert(path);
                    }
                    Err(RecvTimeoutError::Timeout) => break,
                    Err(RecvTimeoutError::Disconnected) => {
                        if !batch.is_empty() {
                            emit_batch(&app, &root_path, batch);
                        }
                        return;
                    }
                }
            }
            emit_batch(&app, &root_path, batch);
        }
    });
}

fn emit_batch(app: &AppHandle, root_path: &str, paths: HashSet<String>) {
    if paths.is_empty() {
        return;
    }
    let _ = app.emit(
        EVENT_FS_CHANGED,
        ProjectFsChangedPayload {
            root_path: root_path.to_string(),
            paths: paths.into_iter().collect(),
        },
    );
}

fn start_watcher(app: AppHandle, root_path: String) -> Result<RootWatch, String> {
    let (tx, rx) = mpsc::channel();
    let app_for_events = app.clone();
    let root_for_events = root_path.clone();

    let watcher = RecommendedWatcher::new(
        move |res: Result<Event, Error>| {
            let Ok(event) = res else {
                return;
            };
            if !is_relevant(&event.kind) {
                return;
            }
            for path in event.paths {
                let _ = tx.send(path.to_string_lossy().to_string());
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create filesystem watcher: {e}"))?;

    let mut watcher = watcher;
    watcher
        .watch(Path::new(&root_path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch {root_path}: {e}"))?;

    spawn_debounce_loop(app_for_events, root_for_events, rx);

    Ok(RootWatch { _watcher: watcher })
}

#[tauri::command]
pub fn sync_project_fs_watchers(
    app: AppHandle,
    state: State<'_, FsWatchState>,
    root_paths: Vec<String>,
) -> Result<(), String> {
    let desired: HashSet<String> = root_paths
        .into_iter()
        .map(|p| normalize_root(&p))
        .filter(|p| !p.is_empty())
        .collect();

    let mut roots = state
        .roots
        .lock()
        .map_err(|e| format!("Filesystem watch state lock poisoned: {e}"))?;

    roots.retain(|key, _| desired.contains(key));

    for root in desired {
        if roots.contains_key(&root) {
            continue;
        }
        let path = Path::new(&root);
        if !path.is_dir() {
            continue;
        }
        let watch = start_watcher(app.clone(), root.clone())?;
        roots.insert(root, watch);
    }

    Ok(())
}
