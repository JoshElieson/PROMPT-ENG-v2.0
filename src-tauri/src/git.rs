use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitFileChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub changes: Vec<GitFileChange>,
    pub clean: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitCommandResult {
    pub success: bool,
    pub output: String,
}

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git: {e}. Is Git installed and on PATH?"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

fn is_git_repo(path: &str) -> bool {
    run_git(path, &["rev-parse", "--is-inside-work-tree"])
        .map(|s| s == "true")
        .unwrap_or(false)
}

fn parse_status_code(code: &str) -> String {
    match code {
        "M" | "MM" => "modified".to_string(),
        "A" | "AM" => "added".to_string(),
        "D" | "DM" => "deleted".to_string(),
        "R" | "RM" => "renamed".to_string(),
        "U" | "UU" => "conflicted".to_string(),
        "?" | "??" => "untracked".to_string(),
        _ => "modified".to_string(),
    }
}

fn parse_porcelain_line(line: &str) -> Option<GitFileChange> {
    if line.len() < 4 {
        return None;
    }
    let x = line.chars().next()?;
    let y = line.chars().nth(1)?;
    if x == '#' || y == '#' {
        return None;
    }

    let staged = x != ' ' && x != '?';
    let unstaged = y != ' ';
    if !staged && !unstaged {
        return None;
    }

    let mut rest = line[3..].trim();
    if rest.contains(" -> ") {
        rest = rest.split(" -> ").nth(1).unwrap_or(rest);
    }

    let status_code = if x != ' ' {
        x.to_string()
    } else {
        y.to_string()
    };

    Some(GitFileChange {
        path: rest.to_string(),
        status: parse_status_code(&status_code),
        staged,
    })
}

fn parse_branch_line(line: &str) -> (Option<String>, u32, u32) {
    // ## main...origin/main [ahead 2, behind 1]
    let mut branch = None;
    let mut ahead = 0u32;
    let mut behind = 0u32;

    let content = line.strip_prefix("## ").unwrap_or(line);
    let head = content.split_whitespace().next().unwrap_or("");
    if !head.is_empty() && head != "HEAD" && !head.starts_with("No commits") {
        let name = head.split("...").next().unwrap_or(head);
        if name != "(no branch)" {
            branch = Some(name.to_string());
        }
    }

    if let Some(start) = content.find('[') {
        let inner = &content[start + 1..content.len().saturating_sub(1)];
        for part in inner.split(',') {
            let part = part.trim();
            if let Some(n) = part.strip_prefix("ahead ") {
                ahead = n.trim().parse().unwrap_or(0);
            } else if let Some(n) = part.strip_prefix("behind ") {
                behind = n.trim().parse().unwrap_or(0);
            }
        }
    }

    (branch, ahead, behind)
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatusResult, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Path does not exist: {path}"));
    }
    if !dir.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }

    if !is_git_repo(&path) {
        return Ok(GitStatusResult {
            is_repo: false,
            branch: None,
            ahead: 0,
            behind: 0,
            changes: vec![],
            clean: true,
        });
    }

    let porcelain = run_git(&path, &["status", "--porcelain=v1", "-b"])?;
    let mut branch = None;
    let mut ahead = 0u32;
    let mut behind = 0u32;
    let mut changes = Vec::new();

    for line in porcelain.lines() {
        if line.starts_with("## ") {
            let parsed = parse_branch_line(line);
            branch = parsed.0;
            ahead = parsed.1;
            behind = parsed.2;
        } else if let Some(change) = parse_porcelain_line(line) {
            changes.push(change);
        }
    }

    if branch.is_none() {
        branch = run_git(&path, &["branch", "--show-current"])
            .ok()
            .filter(|s| !s.is_empty());
    }

    let clean = changes.is_empty();
    Ok(GitStatusResult {
        is_repo: true,
        branch,
        ahead,
        behind,
        changes,
        clean,
    })
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    match run_git(&path, &["pull"]) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output,
        }),
        Err(e) => Ok(GitCommandResult {
            success: false,
            output: e,
        }),
    }
}

#[tauri::command]
pub fn git_push(path: String) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    match run_git(&path, &["push"]) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output,
        }),
        Err(e) => Ok(GitCommandResult {
            success: false,
            output: e,
        }),
    }
}

#[tauri::command]
pub fn git_fetch(path: String) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    match run_git(&path, &["fetch"]) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output,
        }),
        Err(e) => Ok(GitCommandResult {
            success: false,
            output: e,
        }),
    }
}

#[tauri::command]
pub fn git_init(path: String) -> Result<GitCommandResult, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Path does not exist: {path}"));
    }
    if is_git_repo(&path) {
        return Err("Already a git repository.".to_string());
    }
    match run_git(&path, &["init"]) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output,
        }),
        Err(e) => Ok(GitCommandResult {
            success: false,
            output: e,
        }),
    }
}

#[tauri::command]
pub fn git_commit(
    path: String,
    message: String,
    stage_all: bool,
) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    let message = message.trim();
    if message.is_empty() {
        return Err("Commit message cannot be empty.".to_string());
    }

    if stage_all {
        if let Err(e) = run_git(&path, &["add", "-A"]) {
            return Ok(GitCommandResult {
                success: false,
                output: e,
            });
        }
    }

    match run_git(&path, &["commit", "-m", message]) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output,
        }),
        Err(e) => Ok(GitCommandResult {
            success: false,
            output: e,
        }),
    }
}

#[tauri::command]
pub fn git_clone(url: String, parent_path: String) -> Result<GitCommandResult, String> {
    let parent = Path::new(&parent_path);
    if !parent.exists() || !parent.is_dir() {
        return Err(format!("Parent directory does not exist: {parent_path}"));
    }
    let url = url.trim();
    if url.is_empty() {
        return Err("Repository URL is required.".to_string());
    }

    match run_git(&parent_path, &["clone", url]) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output,
        }),
        Err(e) => Ok(GitCommandResult {
            success: false,
            output: e,
        }),
    }
}
