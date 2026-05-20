use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::fs::{list_directory, remove_path, FsEntry};

const MAX_READ_BYTES: usize = 512 * 1024;
const MAX_LIST_ENTRIES: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiWorkspace {
    /// Absolute paths the user enabled in the project tree (folder or file).
    pub enabled_paths: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct WorkspacePolicy {
    roots: Vec<std::path::PathBuf>,
}

impl WorkspacePolicy {
    pub fn from_workspace(ws: &AiWorkspace) -> Option<Self> {
        let roots: Vec<std::path::PathBuf> = ws
            .enabled_paths
            .iter()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(std::path::PathBuf::from)
            .collect();
        if roots.is_empty() {
            return None;
        }
        Some(Self { roots })
    }

    /// True if `path` is an enabled root, lies under one, or is a parent of one
    /// (so `clear_directory` can target a folder that contains enabled files).
    pub fn allows_path(&self, path: &Path) -> bool {
        self.roots.iter().any(|root| {
            path_is_within_workspace(path, root) || path_is_within_workspace(root, path)
        })
    }

    pub fn roots_summary(&self) -> String {
        self.roots
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// True when `path` is exactly one of the user's enabled roots (not a child).
    pub fn is_enabled_root(&self, path: &Path) -> bool {
        let target_key = path_key(path);
        self.roots
            .iter()
            .any(|root| path_key(root) == target_key)
    }
}

fn path_key(path: &Path) -> std::path::PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn path_is_within_workspace(path: &Path, root: &Path) -> bool {
    let root_canon = match fs::canonicalize(root) {
        Ok(p) => p,
        Err(_) => root.to_path_buf(),
    };

    let mut candidate = path.to_path_buf();
    loop {
        if let Ok(canon) = fs::canonicalize(&candidate) {
            return canon.starts_with(&root_canon);
        }
        if !candidate.pop() {
            break;
        }
    }

    path.starts_with(root)
}

pub fn tool_read_file(policy: &WorkspacePolicy, path_str: &str) -> Result<String, String> {
    let path = Path::new(path_str.trim());
    if path_str.trim().is_empty() {
        return Err("read_file: path is empty".to_string());
    }
    if !policy.allows_path(path) {
        return Err(format!(
            "read_file: path is not inside an AI-enabled folder or file: {}",
            path.display()
        ));
    }
    if !path.exists() {
        return Err(format!("read_file: file does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("read_file: not a file: {}", path.display()));
    }
    let meta = fs::metadata(path).map_err(|e| format!("read_file: {e}"))?;
    if meta.len() as usize > MAX_READ_BYTES {
        return Err(format!(
            "read_file: file too large (max {} bytes): {}",
            MAX_READ_BYTES,
            path.display()
        ));
    }
    let bytes = fs::read(path).map_err(|e| format!("read_file: {e}"))?;
    String::from_utf8(bytes).map_err(|_| {
        format!(
            "read_file: file is not valid UTF-8 (binary files are not supported): {}",
            path.display()
        )
    })
}

pub fn tool_write_file(policy: &WorkspacePolicy, path_str: &str, content: &str) -> Result<String, String> {
    let path = Path::new(path_str.trim());
    if path_str.trim().is_empty() {
        return Err("write_file: path is empty".to_string());
    }
    if !policy.allows_path(path) {
        return Err(format!(
            "write_file: path is not inside an AI-enabled folder or file: {}",
            path.display()
        ));
    }
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("write_file: could not create parent dirs: {e}"))?;
        }
    }
    fs::write(path, content.as_bytes()).map_err(|e| format!("write_file: {e}"))?;
    Ok(format!("Wrote {} bytes to {}", content.len(), path.display()))
}

pub fn tool_list_directory(policy: &WorkspacePolicy, path_str: &str) -> Result<String, String> {
    let path = Path::new(path_str.trim());
    if path_str.trim().is_empty() {
        return Err("list_directory: path is empty".to_string());
    }
    if !policy.allows_path(path) {
        return Err(format!(
            "list_directory: path is not inside an AI-enabled folder: {}",
            path.display()
        ));
    }
    if !path.exists() {
        return Err(format!(
            "list_directory: path does not exist: {}",
            path.display()
        ));
    }
    if !path.is_dir() {
        return Err(format!(
            "list_directory: not a directory: {}",
            path.display()
        ));
    }

    let entries: Vec<FsEntry> = list_directory(path.to_string_lossy().to_string())?;
    let mut lines: Vec<String> = Vec::new();
    for e in entries.iter().take(MAX_LIST_ENTRIES) {
        let kind = if e.is_directory { "dir" } else { "file" };
        lines.push(format!("{} {}\t{}", kind, e.name, e.path));
    }
    if entries.len() > MAX_LIST_ENTRIES {
        lines.push(format!(
            "\n… truncated (showing first {} of {} entries)",
            MAX_LIST_ENTRIES,
            entries.len()
        ));
    }
    Ok(lines.join("\n"))
}

fn delete_path_allowed(policy: &WorkspacePolicy, path: &Path, tool: &str) -> Result<(), String> {
    if !policy.allows_path(path) {
        return Err(format!(
            "{tool}: path is not inside an AI-enabled folder or file: {}",
            path.display()
        ));
    }
    if !path.exists() {
        return Err(format!("{tool}: path does not exist: {}", path.display()));
    }
    remove_path(path)
}

pub fn tool_remove_path(policy: &WorkspacePolicy, path_str: &str) -> Result<String, String> {
    let path = Path::new(path_str.trim());
    if path_str.trim().is_empty() {
        return Err("remove_path: path is empty".to_string());
    }
    if !policy.allows_path(path) {
        return Err(format!(
            "remove_path: path is not inside an AI-enabled folder or file: {}",
            path.display()
        ));
    }
    if policy.is_enabled_root(path) && path.is_dir() {
        return Err(
            "remove_path: cannot delete an AI-enabled folder root; use clear_directory on that folder path to empty it instead.".to_string(),
        );
    }
    let kind = if path.is_dir() { "directory" } else { "file" };
    delete_path_allowed(policy, path, "remove_path")?;
    Ok(format!("Deleted {kind}: {}", path.display()))
}

pub fn tool_clear_directory(policy: &WorkspacePolicy, path_str: &str) -> Result<String, String> {
    let path = Path::new(path_str.trim());
    if path_str.trim().is_empty() {
        return Err("clear_directory: path is empty".to_string());
    }
    if !policy.allows_path(path) {
        return Err(format!(
            "clear_directory: path is not inside an AI-enabled folder: {}",
            path.display()
        ));
    }
    if !path.exists() {
        return Err(format!(
            "clear_directory: path does not exist: {}",
            path.display()
        ));
    }
    if !path.is_dir() {
        return Err(format!(
            "clear_directory: not a directory: {}",
            path.display()
        ));
    }

    let entries: Vec<FsEntry> = list_directory(path.to_string_lossy().to_string())?;
    if entries.is_empty() {
        return Ok(format!("Directory already empty: {}", path.display()));
    }

    let mut removed = 0usize;
    let mut errors: Vec<String> = Vec::new();
    for entry in &entries {
        let child = Path::new(&entry.path);
        match delete_path_allowed(policy, child, "clear_directory") {
            Ok(()) => removed += 1,
            Err(e) => errors.push(format!("{}: {e}", entry.path)),
        }
    }

    if errors.is_empty() {
        return Ok(format!(
            "Cleared {} item(s) from {}",
            removed,
            path.display()
        ));
    }
    Err(format!(
        "clear_directory: removed {removed} item(s); {} failed:\n{}",
        errors.len(),
        errors.join("\n")
    ))
}
