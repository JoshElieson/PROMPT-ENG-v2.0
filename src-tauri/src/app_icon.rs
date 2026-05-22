//! Resolve and apply the app icon for Windows taskbar / window chrome.

use std::path::PathBuf;

use tauri::image::Image;
use tauri::{AppHandle, Manager, path::BaseDirectory};

const ICON_CANDIDATES: &[&str] = &[
    "icons/icon.ico",
    "icons/128x128@2x.png",
    "icons/128x128.png",
    "icons/32x32.png",
];

/// Best on-disk icon path (dev + packaged).
pub fn resolve_icon_path(app: &AppHandle) -> Option<PathBuf> {
    for relative in ICON_CANDIDATES {
        if let Ok(path) = app.path().resolve(relative, BaseDirectory::Resource) {
            if path.exists() {
                return Some(path);
            }
        }
        if let Ok(resource_dir) = app.path().resource_dir() {
            let path = resource_dir.join(relative);
            if path.exists() {
                return Some(path);
            }
        }
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let path = PathBuf::from(&manifest_dir).join(relative);
            if path.exists() {
                return Some(path);
            }
        }
    }
    None
}

fn load_icon(app: &AppHandle) -> Option<Image<'static>> {
    if let Some(path) = resolve_icon_path(app) {
        if let Ok(icon) = Image::from_path(&path) {
            return Some(icon.to_owned());
        }
    }
    let embedded = app.default_window_icon()?;
    let rgba = embedded.rgba().to_vec();
    Some(Image::new_owned(rgba, embedded.width(), embedded.height()))
}

/// Frameless windows on Windows use the HWND icon for the taskbar button.
pub fn apply_window_taskbar_icon(app: &AppHandle) {
    let Some(icon) = load_icon(app) else {
        eprintln!("[forge] no app icon found for taskbar");
        return;
    };

    for window in app.webview_windows().values() {
        if let Err(err) = window.set_icon(icon.clone()) {
            eprintln!("[forge] set_icon failed: {err}");
        }
    }
}

/// Re-apply after the native window is fully created (setup can run too early).
pub fn schedule_taskbar_icon_retry(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        apply_window_taskbar_icon(&handle);
        let handle2 = handle.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(400));
            let retry = handle2.clone();
            let _ = handle2.run_on_main_thread(move || {
                apply_window_taskbar_icon(&retry);
            });
        });
    });
}
