mod ai_chat;
mod ai_config;
mod xai_models;
mod ai_workspace;
mod embedded_browser;
mod file_drag;
mod fs;
mod fs_watch;
mod git;
mod github_auth;
mod shell_run;
mod terminal;

use fs::{
    copy_fs_entry, create_fs_entry, find_in_directory, get_user_home_dir, list_directory,
    move_fs_entry, relative_path_from_root, remove_fs_entry, rename_fs_entry,
};
use fs_watch::{sync_project_fs_watchers, FsWatchState};
use git::{
    git_clone, git_commit, git_fetch, git_init, git_pull, git_push, git_status,
};
use ai_chat::{ai_chat_complete, ai_chat_synthesize};
use embedded_browser::{
    browser_webview_close, browser_webview_go_back, browser_webview_go_forward,
    browser_webview_navigate, browser_webview_open, browser_webview_reload,
    browser_webview_set_bounds, browser_webview_set_visible, BrowserWebviewState,
};
use file_drag::start_file_drag;
use shell_run::open_terminal_run_command;
use terminal::{
    terminal_kill, terminal_resize, terminal_spawn, terminal_write, TerminalState,
};
use ai_config::load_dotenv;
use github_auth::{
    github_complete_device_login, github_fetch_user, github_poll_device_token,
    github_start_device_flow, github_wait_for_device_token,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(TerminalState::default())
        .manage(BrowserWebviewState::default())
        .manage(FsWatchState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_user_home_dir,
            list_directory,
            create_fs_entry,
            rename_fs_entry,
            remove_fs_entry,
            copy_fs_entry,
            move_fs_entry,
            find_in_directory,
            relative_path_from_root,
            sync_project_fs_watchers,
            git_status,
            git_pull,
            git_push,
            git_fetch,
            git_init,
            git_clone,
            git_commit,
            github_start_device_flow,
            github_poll_device_token,
            github_wait_for_device_token,
            github_complete_device_login,
            github_fetch_user,
            ai_chat_complete,
            ai_chat_synthesize,
            start_file_drag,
            open_terminal_run_command,
            terminal_spawn,
            terminal_write,
            terminal_resize,
            terminal_kill,
            browser_webview_open,
            browser_webview_navigate,
            browser_webview_go_back,
            browser_webview_go_forward,
            browser_webview_reload,
            browser_webview_set_bounds,
            browser_webview_set_visible,
            browser_webview_close,
        ])
        .setup(|app| {
            load_dotenv();
            let icon = app.default_window_icon().cloned();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_theme(Some(tauri::Theme::Dark));
                let _ = window.set_shadow(false);
                // Frameless windows on Windows use the window icon for the taskbar.
                if let Some(icon) = icon {
                    let _ = window.set_icon(icon);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
