use std::path::Path;
use std::process::Command;

/// Open the OS terminal in `working_dir` and run a shell snippet (bash/sh/cmd).
#[tauri::command]
pub fn open_terminal_run_command(
    command: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    let script = command.trim().to_string();
    if script.is_empty() {
        return Err("Nothing to run.".into());
    }

    let cwd = resolve_working_dir(working_dir)?;

    std::thread::Builder::new()
        .name("open-terminal".into())
        .spawn(move || {
            if let Err(e) = open_terminal_impl(&cwd, &script) {
                eprintln!("open_terminal_run_command: {e}");
            }
        })
        .map_err(|e| format!("Failed to start terminal: {e}"))?;

    Ok(())
}

fn resolve_working_dir(working_dir: Option<String>) -> Result<String, String> {
    if let Some(dir) = working_dir {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            let path = Path::new(trimmed);
            if path.is_dir() {
                return Ok(trimmed.to_string());
            }
            return Err(format!("Working directory does not exist: {trimmed}"));
        }
    }

    std::env::current_dir()
        .map(|p| p.display().to_string())
        .map_err(|e| format!("Could not resolve working directory: {e}"))
}

fn script_lines_to_chain(script: &str, separator: &str) -> String {
    script
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(separator)
}

fn command_exists(name: &str) -> bool {
    if cfg!(windows) {
        Command::new("where")
            .arg(name)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    } else {
        Command::new("sh")
            .arg("-c")
            .arg(format!("command -v {name}"))
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

#[cfg(windows)]
fn open_terminal_impl(cwd: &str, script: &str) -> Result<(), String> {
    let chain = script_lines_to_chain(script, " && ");
    if chain.is_empty() {
        return Err("Nothing to run.".into());
    }

    if command_exists("wt") {
        let status = Command::new("wt")
            .args(["-w", "0", "nt", "-d", cwd, "cmd", "/K", &chain])
            .status()
            .map_err(|e| format!("Failed to launch Windows Terminal: {e}"))?;
        if status.success() {
            return Ok(());
        }
    }

    let full = format!("cd /d \"{cwd}\" && {chain}");
    Command::new("cmd")
        .args(["/C", "start", "", "cmd", "/K", &full])
        .spawn()
        .map_err(|e| format!("Failed to launch Command Prompt: {e}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn escape_applescript(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(target_os = "macos")]
fn open_terminal_impl(cwd: &str, script: &str) -> Result<(), String> {
    let chain = script_lines_to_chain(script, " && ");
    if chain.is_empty() {
        return Err("Nothing to run.".into());
    }

    let inner = format!("cd \"{cwd}\" && {chain}");
    let osa = format!(
        "tell application \"Terminal\" to activate\n\
         tell application \"Terminal\" to do script \"{}\"",
        escape_applescript(&inner)
    );

    Command::new("osascript")
        .arg("-e")
        .arg(&osa)
        .spawn()
        .map_err(|e| format!("Failed to launch Terminal.app: {e}"))?;
    Ok(())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn shell_escape_single(s: &str) -> String {
    s.replace('\'', "'\"'\"'")
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_terminal_impl(cwd: &str, script: &str) -> Result<(), String> {
    let chain = script_lines_to_chain(script, " && ");
    if chain.is_empty() {
        return Err("Nothing to run.".into());
    }

    let inner = format!(
        "cd '{}' && {} ; exec bash -l",
        shell_escape_single(cwd),
        chain
    );

    let attempts: &[(&str, &[&str])] = &[
        ("gnome-terminal", &["--", "bash", "-lc", &inner]),
        ("konsole", &["-e", "bash", "-lc", &inner]),
        ("xfce4-terminal", &["-e", "bash", "-lc", &inner]),
        ("xterm", &["-e", "bash", "-lc", &inner]),
        ("alacritty", &["-e", "bash", "-lc", &inner]),
        ("kitty", &["bash", "-lc", &inner]),
        (
            "x-terminal-emulator",
            &["-e", "bash", "-lc", &inner],
        ),
    ];

    for (bin, args) in attempts {
        if command_exists(bin) {
            if Command::new(bin).args(*args).spawn().is_ok() {
                return Ok(());
            }
        }
    }

    Command::new("bash")
        .arg("-lc")
        .arg(&inner)
        .spawn()
        .map_err(|e| format!("Failed to launch bash: {e}"))?;
    Ok(())
}

#[cfg(not(any(windows, unix)))]
fn open_terminal_impl(_cwd: &str, _script: &str) -> Result<(), String> {
    Err("Running shell snippets is not supported on this platform.".into())
}
