use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use crate::fs::remove_path;

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

fn git_executable() -> PathBuf {
    if let Ok(path) = std::env::var("GIT_EXECUTABLE") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return path;
        }
    }

    if cfg!(windows) {
        const CANDIDATES: &[&str] = &[
            r"C:\Program Files\Git\cmd\git.exe",
            r"C:\Program Files\Git\bin\git.exe",
            r"C:\Program Files (x86)\Git\cmd\git.exe",
        ];
        for candidate in CANDIDATES {
            let path = PathBuf::from(candidate);
            if path.is_file() {
                return path;
            }
        }
    }

    PathBuf::from("git")
}

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    run_git_with_auth(cwd, args, None)
}

fn normalize_github_token(token: Option<String>) -> Option<String> {
    token.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn load_github_token_from_store() -> Option<String> {
    #[cfg(windows)]
    let config_dir = std::env::var("APPDATA").ok()?;
    #[cfg(not(windows))]
    let config_dir = std::env::var("HOME")
        .ok()
        .map(|home| format!("{home}/.config"))?;

    let path = PathBuf::from(config_dir)
        .join("com.forge.desktop")
        .join("auth.v1.json");
    let content = std::fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    let session = json.get("session")?;
    if session.get("provider")?.as_str()? != "github" {
        return None;
    }
    session
        .get("accessToken")
        .or_else(|| session.get("access_token"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn resolve_github_token(github_token: Option<String>) -> Option<String> {
    normalize_github_token(github_token).or_else(load_github_token_from_store)
}

fn run_git_with_auth(
    cwd: &str,
    args: &[&str],
    github_token: Option<&str>,
) -> Result<String, String> {
    let git = git_executable();
    let mut cmd = Command::new(&git);
    cmd.current_dir(cwd);
    cmd.env("GIT_TERMINAL_PROMPT", "0");

    if let Some(token) = github_token.filter(|t| !t.trim().is_empty()) {
        let token = token.trim();
        cmd.arg("-c").arg("credential.helper=");
        cmd.arg("-c").arg(format!(
            "url.https://x-access-token:{token}@github.com/.insteadOf=https://github.com/"
        ));
    }

    cmd.args(args);
    let output = cmd
        .output()
        .map_err(|e| {
            format!(
                "Failed to run git at {}: {e}. Install Git for Windows or set GIT_EXECUTABLE.",
                git.display()
            )
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

fn normalize_pathspec(repo_path: &Path, raw_path: &str) -> String {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let candidate = Path::new(trimmed);
    if candidate.is_absolute() {
        if let Ok(relative) = candidate.strip_prefix(repo_path) {
            return relative.to_string_lossy().replace('\\', "/");
        }
    }
    trimmed.replace('\\', "/")
}

fn is_git_repo(path: &str) -> bool {
    run_git(path, &["rev-parse", "--is-inside-work-tree"])
        .map(|s| s == "true")
        .unwrap_or(false)
}

fn rev_list_count(path: &str, range: &str) -> u32 {
    run_git(path, &["rev-list", "--count", range])
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0)
}

fn remote_branch_ref(path: &str, branch: &str) -> Option<String> {
    let remote_ref = format!("origin/{branch}");
    if run_git(
        path,
        &[
            "rev-parse",
            "--verify",
            "--quiet",
            &format!("refs/remotes/{remote_ref}"),
        ],
    )
    .is_ok()
    {
        Some(remote_ref)
    } else {
        None
    }
}

fn current_branch(path: &str) -> Option<String> {
    run_git(path, &["branch", "--show-current"])
        .ok()
        .filter(|s| !s.is_empty())
}

fn resolve_branch(path: &str, branch: Option<String>) -> Result<String, String> {
    branch
        .map(|b| b.trim().to_string())
        .filter(|b| !b.is_empty())
        .or_else(|| current_branch(path))
        .ok_or_else(|| "Could not determine the current branch.".to_string())
}

fn resolve_ahead_behind(
    path: &str,
    branch: Option<&str>,
    parsed_ahead: u32,
    parsed_behind: u32,
) -> (u32, u32) {
    if parsed_ahead > 0 || parsed_behind > 0 {
        return (parsed_ahead, parsed_behind);
    }

    let Some(branch) = branch.filter(|b| !b.is_empty()) else {
        return (parsed_ahead, parsed_behind);
    };

    if let Some(remote_ref) = remote_branch_ref(path, branch) {
        return (
            rev_list_count(path, &format!("{remote_ref}..HEAD")),
            rev_list_count(path, &format!("HEAD..{remote_ref}")),
        );
    }

    let unpublished = rev_list_count(path, "HEAD --not --remotes");
    if unpublished > 0 {
        return (unpublished, 0);
    }

    (parsed_ahead, parsed_behind)
}

fn format_git_error(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("authentication failed")
        || lower.contains("invalid credentials")
        || lower.contains("could not read username")
        || lower.contains("terminal prompts disabled")
        || lower.contains("permission denied (publickey)")
    {
        return "GitHub authentication failed while pushing. Sign in with GitHub from your profile, then retry Sync Changes."
            .to_string();
    }

    if lower.contains("access denied") || lower.contains("403") || lower.contains("401") {
        return "GitHub denied repository access for this push. Confirm you are signed in with GitHub and have access to this repository."
            .to_string();
    }

    let summary = raw
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or(raw)
        .trim();

    if summary.len() > 220 {
        format!("{}…", &summary[..220])
    } else {
        summary.to_string()
    }
}

fn is_git_auth_error(raw: &str) -> bool {
    let lower = raw.to_lowercase();
    lower.contains("authentication failed")
        || lower.contains("invalid credentials")
        || lower.contains("could not read username")
        || lower.contains("terminal prompts disabled")
        || lower.contains("permission denied (publickey)")
        || lower.contains("access denied")
        || lower.contains("403")
        || lower.contains("401")
}

fn push_branch(path: &str, branch: &str, github_token: Option<&str>) -> Result<String, String> {
    match run_git_with_auth(path, &["push"], github_token) {
        Ok(output) => Ok(output),
        Err(first_error) => match run_git_with_auth(path, &["push", "-u", "origin", branch], github_token)
        {
            Ok(output) => Ok(output),
            Err(second_error) => Err(format_git_error(if second_error.is_empty() {
                &first_error
            } else {
                &second_error
            })),
        },
    }
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

fn parse_porcelain_line(line: &str) -> Vec<GitFileChange> {
    if line.len() < 4 {
        return Vec::new();
    }
    let x = line.chars().next().unwrap_or(' ');
    let y = line.chars().nth(1).unwrap_or(' ');
    if x == '#' || y == '#' {
        return Vec::new();
    }

    let mut rest = line[3..].trim();
    if rest.contains(" -> ") {
        rest = rest.split(" -> ").nth(1).unwrap_or(rest);
    }

    let mut changes = Vec::new();
    if x != ' ' && x != '?' {
        changes.push(GitFileChange {
            path: rest.to_string(),
            status: parse_status_code(&x.to_string()),
            staged: true,
        });
    }
    if y != ' ' {
        let status_code = if y == '?' {
            "??".to_string()
        } else {
            y.to_string()
        };
        changes.push(GitFileChange {
            path: rest.to_string(),
            status: parse_status_code(&status_code),
            staged: false,
        });
    }

    changes
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

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchEntry {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchListResult {
    pub current: Option<String>,
    pub branches: Vec<GitBranchEntry>,
}

fn branch_exists_local(path: &str, branch: &str) -> bool {
    run_git(path, &["show-ref", "--verify", "--quiet", &format!("refs/heads/{branch}")]).is_ok()
}

fn branch_exists_remote(path: &str, branch: &str) -> bool {
    run_git(
        path,
        &[
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/remotes/origin/{branch}"),
        ],
    )
    .is_ok()
}

fn checkout_branch(path: &str, branch: &str) -> Result<String, String> {
    if branch_exists_local(path, branch) {
        return run_git(path, &["switch", branch]);
    }
    if branch_exists_remote(path, branch) {
        if let Ok(output) = run_git(path, &["switch", branch]) {
            return Ok(output);
        }
        return run_git(
            path,
            &["switch", "-c", branch, &format!("origin/{branch}")],
        );
    }
    Err(format!("Branch \"{branch}\" was not found locally or on origin."))
}

#[tauri::command]
pub fn git_list_branches(path: String) -> Result<GitBranchListResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }

    let current = run_git(&path, &["branch", "--show-current"])
        .ok()
        .filter(|s| !s.is_empty());

    let mut seen = std::collections::HashSet::new();
    let mut branches = Vec::new();

    if let Ok(local) = run_git(
        &path,
        &[
            "for-each-ref",
            "refs/heads/",
            "--format=%(refname:short)",
            "--sort=-committerdate",
        ],
    ) {
        for name in local.lines() {
            let name = name.trim();
            if name.is_empty() || !seen.insert(name.to_string()) {
                continue;
            }
            branches.push(GitBranchEntry {
                name: name.to_string(),
                is_current: current.as_deref() == Some(name),
                is_remote: false,
            });
        }
    }

    if let Ok(remote) = run_git(
        &path,
        &[
            "for-each-ref",
            "refs/remotes/origin/",
            "--format=%(refname:short)",
            "--sort=-committerdate",
        ],
    ) {
        for line in remote.lines() {
            let line = line.trim();
            if line.is_empty() || line.ends_with("/HEAD") {
                continue;
            }
            let name = line.strip_prefix("origin/").unwrap_or(line);
            if name == "HEAD" || !seen.insert(name.to_string()) {
                continue;
            }
            branches.push(GitBranchEntry {
                name: name.to_string(),
                is_current: current.as_deref() == Some(name),
                is_remote: true,
            });
        }
    }

    branches.sort_by(|a, b| {
        match (a.is_current, b.is_current) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => match (a.is_remote, b.is_remote) {
                (false, true) => std::cmp::Ordering::Less,
                (true, false) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            },
        }
    });

    Ok(GitBranchListResult { current, branches })
}

#[tauri::command]
pub fn git_checkout_branch(path: String, branch: String) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    let branch = branch.trim();
    if branch.is_empty() {
        return Err("Branch name is required.".to_string());
    }
    match checkout_branch(&path, branch) {
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
pub fn git_sync_branch(
    path: String,
    branch: String,
    github_token: Option<String>,
) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    let branch = branch.trim();
    if branch.is_empty() {
        return Err("Branch name is required.".to_string());
    }
    let token = resolve_github_token(github_token);
    let token_ref = token.as_deref();
    let mut steps = Vec::new();

    if let Err(e) = run_git_with_auth(&path, &["fetch", "--prune"], token_ref) {
        if is_git_auth_error(&e) {
            return Ok(GitCommandResult {
                success: false,
                output: format_git_error(&e),
            });
        }
        steps.push(format!("fetch: {}", format_git_error(&e)));
    } else {
        steps.push("fetch: ok".to_string());
    }

    let current = run_git(&path, &["branch", "--show-current"]).unwrap_or_default();
    if current != branch {
        match checkout_branch(&path, branch) {
            Ok(output) => {
                if !output.is_empty() {
                    steps.push(output);
                }
                steps.push(format!("checked out {branch}"));
            }
            Err(e) => {
                return Ok(GitCommandResult {
                    success: false,
                    output: format_git_error(&e),
                });
            }
        }
    }

    match run_git_with_auth(&path, &["pull", "--ff-only"], token_ref) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output: if output.is_empty() {
                format!("{}\nPull complete.", steps.join("\n"))
            } else {
                format!("{}\n{output}", steps.join("\n"))
            },
        }),
        Err(_) => match run_git_with_auth(&path, &["pull"], token_ref) {
            Ok(output) => Ok(GitCommandResult {
                success: true,
                output: if output.is_empty() {
                    format!("{}\nPull complete.", steps.join("\n"))
                } else {
                    format!("{}\n{output}", steps.join("\n"))
                },
            }),
            Err(e) => Ok(GitCommandResult {
                success: false,
                output: format_git_error(&e),
            }),
        },
    }
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
        } else {
            changes.extend(parse_porcelain_line(line));
        }
    }

    if branch.is_none() {
        branch = current_branch(&path);
    }

    let (ahead, behind) = resolve_ahead_behind(&path, branch.as_deref(), ahead, behind);

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
pub fn git_pull(path: String, github_token: Option<String>) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    let token = resolve_github_token(github_token);
    match run_git_with_auth(&path, &["pull"], token.as_deref()) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output,
        }),
        Err(e) => Ok(GitCommandResult {
            success: false,
            output: format_git_error(&e),
        }),
    }
}

#[tauri::command]
pub fn git_push(
    path: String,
    branch: Option<String>,
    github_token: Option<String>,
) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    let branch = resolve_branch(&path, branch)?;
    let token = resolve_github_token(github_token);
    match push_branch(&path, &branch, token.as_deref()) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output: if output.is_empty() {
                format!("Pushed to origin/{branch}.")
            } else {
                output
            },
        }),
        Err(e) => Ok(GitCommandResult {
            success: false,
            output: e,
        }),
    }
}

#[tauri::command]
pub fn git_sync(
    path: String,
    branch: Option<String>,
    github_token: Option<String>,
) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }

    let branch = resolve_branch(&path, branch)?;
    let token = resolve_github_token(github_token);
    let token_ref = token.as_deref();
    let mut steps: Vec<String> = Vec::new();

    if let Err(e) = run_git_with_auth(&path, &["fetch", "origin"], token_ref) {
        if is_git_auth_error(&e) {
            return Ok(GitCommandResult {
                success: false,
                output: format_git_error(&e),
            });
        }
        steps.push(format!("fetch: {}", format_git_error(&e)));
    } else {
        steps.push("fetch: ok".to_string());
    }

    let current = current_branch(&path).unwrap_or_default();
    if current != branch {
        match checkout_branch(&path, &branch) {
            Ok(output) => {
                if !output.is_empty() {
                    steps.push(output);
                }
                steps.push(format!("checked out {branch}"));
            }
            Err(e) => {
                return Ok(GitCommandResult {
                    success: false,
                    output: format_git_error(&e),
                });
            }
        }
    }

    let (_, behind) = resolve_ahead_behind(&path, Some(&branch), 0, 0);

    if behind > 0 {
        match run_git_with_auth(&path, &["pull", "--ff-only"], token_ref) {
            Ok(output) => {
                if !output.is_empty() {
                    steps.push(output);
                }
                steps.push("pull: ok".to_string());
            }
            Err(_) => match run_git_with_auth(&path, &["pull"], token_ref) {
                Ok(output) => {
                    if !output.is_empty() {
                        steps.push(output);
                    }
                    steps.push("pull: ok".to_string());
                }
                Err(e) => {
                    return Ok(GitCommandResult {
                        success: false,
                        output: format_git_error(&e),
                    });
                }
            },
        }
    }

    let (ahead, _) = resolve_ahead_behind(&path, Some(&branch), 0, 0);

    if ahead > 0 {
        match push_branch(&path, &branch, token_ref) {
            Ok(output) => {
                if !output.is_empty() {
                    steps.push(output);
                }
                steps.push(format!("Pushed {ahead} commit(s) to origin/{branch}."));
            }
            Err(e) => {
                return Ok(GitCommandResult {
                    success: false,
                    output: e,
                });
            }
        }
    } else if behind == 0 {
        steps.push("Already up to date with remote.".to_string());
    }

    Ok(GitCommandResult {
        success: true,
        output: steps
            .iter()
            .rev()
            .find(|step| !step.ends_with(": ok"))
            .cloned()
            .unwrap_or_else(|| "Sync complete.".to_string()),
    })
}

#[tauri::command]
pub fn git_fetch(path: String, github_token: Option<String>) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    let token = resolve_github_token(github_token);
    match run_git_with_auth(&path, &["fetch"], token.as_deref()) {
        Ok(output) => Ok(GitCommandResult {
            success: true,
            output,
        }),
        Err(e) => Ok(GitCommandResult {
            success: false,
            output: format_git_error(&e),
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
pub fn git_clone(
    url: String,
    parent_path: String,
    github_token: Option<String>,
) -> Result<GitCommandResult, String> {
    let parent = Path::new(&parent_path);
    if !parent.exists() || !parent.is_dir() {
        return Err(format!("Parent directory does not exist: {parent_path}"));
    }
    let url = url.trim();
    if url.is_empty() {
        return Err("Repository URL is required.".to_string());
    }

    let token = resolve_github_token(github_token);
    match run_git_with_auth(&parent_path, &["clone", url], token.as_deref()) {
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
pub fn git_restore_paths(path: String, paths: Vec<String>) -> Result<GitCommandResult, String> {
    if !is_git_repo(&path) {
        return Err("Not a git repository.".to_string());
    }
    let repo_path = Path::new(&path);

    let mut restored = 0usize;
    let mut deleted_untracked = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for raw in paths {
        let pathspec = normalize_pathspec(repo_path, &raw);
        if pathspec.is_empty() {
            skipped += 1;
            continue;
        }

        let tracked = run_git(&path, &["ls-files", "--error-unmatch", "--", &pathspec]).is_ok();
        if tracked {
            match run_git(
                &path,
                &["restore", "--staged", "--worktree", "--", &pathspec],
            ) {
                Ok(_) => restored += 1,
                Err(err) => errors.push(format!("{pathspec}: {err}")),
            }
            continue;
        }

        let target = {
            let raw_path = Path::new(raw.trim());
            if raw_path.is_absolute() {
                raw_path.to_path_buf()
            } else {
                repo_path.join(&pathspec)
            }
        };
        if target.exists() {
            if let Err(err) = remove_path(&target) {
                errors.push(format!("{}: {err}", target.display()));
            } else {
                deleted_untracked += 1;
            }
        } else {
            skipped += 1;
        }
    }

    let mut output = format!(
        "Restored {restored} tracked path(s), removed {deleted_untracked} untracked path(s), skipped {skipped} path(s)."
    );
    if !errors.is_empty() {
        output.push_str("\n\n");
        output.push_str(&errors.join("\n"));
    }
    Ok(GitCommandResult {
        success: errors.is_empty(),
        output,
    })
}
