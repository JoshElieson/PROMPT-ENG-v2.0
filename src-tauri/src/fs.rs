use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Component, Path, PathBuf};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
}

fn should_skip(name: &str) -> bool {
    matches!(
        name,
        "node_modules" | ".git" | ".svn" | "target" | "dist" | "build" | ".next" | "__pycache__"
    ) || (name.starts_with('.') && name != ".env" && name != ".cursor")
}

#[tauri::command]
pub fn get_user_home_dir() -> Result<String, String> {
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE").map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOME").map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FsEntry>, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Path does not exist: {path}"));
    }
    if !dir.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }

    let read_dir = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {e}"))?;

    let mut entries = Vec::new();
    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip(&name) {
            continue;
        }
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to read file type: {e}"))?;
        entries.push(FsEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_directory: file_type.is_dir(),
        });
    }

    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

fn join_child(parent: &str, name: &str) -> Result<PathBuf, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Name cannot be empty.".into());
    }
    if trimmed.contains(['/', '\\']) || trimmed == "." || trimmed == ".." {
        return Err("Invalid name.".into());
    }
    Ok(Path::new(parent).join(trimmed))
}

#[tauri::command]
pub fn create_fs_entry(
    parent_path: String,
    name: String,
    is_directory: bool,
) -> Result<String, String> {
    let parent = Path::new(&parent_path);
    if !parent.is_dir() {
        return Err(format!("Not a directory: {parent_path}"));
    }
    let target = join_child(&parent_path, &name)?;
    if target.exists() {
        return Err(format!("Already exists: {}", target.display()));
    }
    if is_directory {
        fs::create_dir(&target).map_err(|e| format!("Failed to create folder: {e}"))?;
    } else {
        if let Some(dir) = target.parent() {
            fs::create_dir_all(dir).map_err(|e| format!("Failed to create parent: {e}"))?;
        }
        fs::File::create(&target).map_err(|e| format!("Failed to create file: {e}"))?;
    }
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn rename_fs_entry(from_path: String, to_path: String) -> Result<(), String> {
    let from = Path::new(&from_path);
    if !from.exists() {
        return Err(format!("Path does not exist: {from_path}"));
    }
    let to = Path::new(&to_path);
    if to.exists() {
        return Err(format!("Destination already exists: {to_path}"));
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent: {e}"))?;
    }
    fs::rename(from, to).map_err(|e| format!("Failed to rename: {e}"))?;
    Ok(())
}

/// Delete a file or directory tree at `path` (must exist).
pub fn remove_path(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete folder: {e}"))?;
    } else {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn remove_fs_entry(path: String) -> Result<(), String> {
    remove_path(Path::new(&path))
}

fn copy_recursive(from: &Path, to: &Path) -> Result<(), String> {
    if from.is_dir() {
        fs::create_dir_all(to).map_err(|e| format!("Failed to create folder: {e}"))?;
        for entry in fs::read_dir(from).map_err(|e| format!("Failed to read directory: {e}"))? {
            let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
            let name = entry.file_name();
            copy_recursive(&entry.path(), &to.join(name))?;
        }
        Ok(())
    } else {
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent: {e}"))?;
        }
        fs::copy(from, to).map_err(|e| format!("Failed to copy file: {e}"))?;
        Ok(())
    }
}

#[tauri::command]
pub fn copy_fs_entry(from_path: String, to_path: String) -> Result<(), String> {
    let from = Path::new(&from_path);
    if !from.exists() {
        return Err(format!("Path does not exist: {from_path}"));
    }
    let to = Path::new(&to_path);
    if to.exists() {
        return Err(format!("Destination already exists: {to_path}"));
    }
    copy_recursive(from, to)
}

#[tauri::command]
pub fn move_fs_entry(from_path: String, to_path: String) -> Result<(), String> {
    let from = Path::new(&from_path);
    if !from.exists() {
        return Err(format!("Path does not exist: {from_path}"));
    }
    let to = Path::new(&to_path);
    if to.exists() {
        return Err(format!("Destination already exists: {to_path}"));
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent: {e}"))?;
    }
    fs::rename(from, to).map_err(|e| format!("Failed to move: {e}"))?;
    Ok(())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FindInFolderMatch {
    pub path: String,
    pub line: u32,
    pub preview: String,
}

fn is_probably_text(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return true;
    };
    !matches!(
        ext.to_ascii_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "ico" | "pdf" | "zip" | "gz"
            | "exe" | "dll" | "so" | "dylib" | "woff" | "woff2" | "ttf" | "otf"
            | "mp3" | "mp4" | "avi" | "mov" | "wasm" | "pdb" | "lock"
    )
}

fn walk_find(dir: &Path, query: &str, out: &mut Vec<FindInFolderMatch>, max: usize) {
    if out.len() >= max {
        return;
    }
    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };
    for entry in read_dir.flatten() {
        if out.len() >= max {
            return;
        }
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();
        if should_skip(name) {
            continue;
        }
        if path.is_dir() {
            walk_find(&path, query, out, max);
            continue;
        }
        if !is_probably_text(&path) {
            continue;
        }
        let Ok(file) = fs::File::open(&path) else {
            continue;
        };
        let reader = BufReader::new(file);
        for (idx, line) in reader.lines().enumerate() {
            if out.len() >= max {
                return;
            }
            let Ok(line) = line else { continue };
            if line.to_ascii_lowercase().contains(query) {
                out.push(FindInFolderMatch {
                    path: path.to_string_lossy().to_string(),
                    line: (idx + 1) as u32,
                    preview: line.chars().take(160).collect(),
                });
            }
        }
    }
}

#[tauri::command]
pub fn find_in_directory(
    dir_path: String,
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<FindInFolderMatch>, String> {
    let dir = Path::new(&dir_path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {dir_path}"));
    }
    let needle = query.trim().to_ascii_lowercase();
    if needle.is_empty() {
        return Err("Search query cannot be empty.".into());
    }
    let max = max_results.unwrap_or(50).min(200);
    let mut out = Vec::new();
    walk_find(dir, &needle, &mut out, max);
    Ok(out)
}

/// Relative path from `root` to `path` using forward slashes.
#[tauri::command]
pub fn relative_path_from_root(root_path: String, path: String) -> Result<String, String> {
    let root = Path::new(&root_path);
    let target = Path::new(&path);
    let mut rel = PathBuf::new();
    let mut it_target = target.components();
    for comp in root.components() {
        match (comp, it_target.next()) {
            (Component::Prefix(p1), Some(Component::Prefix(p2))) if p1.as_os_str() == p2.as_os_str() => {}
            (Component::RootDir, Some(Component::RootDir)) => {}
            (Component::Normal(a), Some(Component::Normal(b))) if a == b => {}
            _ => {
                return Err("Path is not under project root.".into());
            }
        }
    }
    for comp in it_target {
        rel.push(comp);
    }
    Ok(rel
        .to_string_lossy()
        .replace('\\', "/"))
}
