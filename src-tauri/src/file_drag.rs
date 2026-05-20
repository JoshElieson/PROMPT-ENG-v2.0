use std::path::{Path, PathBuf};

use drag::{DragItem, Image, Options};
use tauri::WebviewWindow;

/// Start a native OS drag session for existing file(s) or folder(s).
/// Blocks until the user drops or cancels (same as Explorer drag).
#[tauri::command]
pub fn start_file_drag(window: WebviewWindow, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Err("No paths to drag.".into());
    }

    let mut drag_paths: Vec<PathBuf> = Vec::with_capacity(paths.len());
    for raw in paths {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let path = PathBuf::from(trimmed);
        if !path.exists() {
            return Err(format!("Path does not exist: {trimmed}"));
        }
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("Could not resolve path {trimmed}: {e}"))?;
        drag_paths.push(canonical);
    }

    if drag_paths.is_empty() {
        return Err("No paths to drag.".into());
    }

    let preview = drag_preview_image(&drag_paths[0]);
    let item = DragItem::Files(drag_paths);

    drag::start_drag(
        &window,
        item,
        preview,
        |_result, _cursor| {},
        Options::default(),
    )
    .map_err(|e| e.to_string())
}

fn drag_preview_image(path: &Path) -> Image {
    Image::File(path.to_path_buf())
}
