mod agent_context;
mod agent_notifications;
mod system_tray;
mod app_icon;
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
mod google_auth;
mod shell_run;
mod terminal;
#[cfg(windows)]
mod windows_notifications;

use fs::{
    copy_fs_entry, create_fs_entry, find_in_directory, get_user_home_dir, list_directory,
    move_fs_entry, relative_path_from_root, remove_fs_entry, rename_fs_entry,
};
use fs_watch::{sync_project_fs_watchers, FsWatchState};
use git::{
    git_checkout_branch, git_clone, git_commit, git_fetch, git_head_info, git_init,
    git_list_branches, git_pull, git_push, git_remote_origin_url, git_restore_paths, git_status,
    git_sync, git_sync_branch,
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
use agent_notifications::{
    show_agent_finish_notification, show_automation_complete_notification,
};

use system_tray::set_system_tray_visible;
use ai_config::{ai_connection_status, load_dotenv};
use github_auth::{
    github_complete_device_login, github_fetch_user, github_poll_device_token,
    github_start_device_flow, github_wait_for_device_token,
};
use google_auth::google_complete_oauth;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(TerminalState::default())
        .manage(BrowserWebviewState::default())
        .manage(FsWatchState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
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
            git_list_branches,
            git_checkout_branch,
            git_sync_branch,
            git_pull,
            git_push,
            git_sync,
            git_fetch,
            git_init,
            git_clone,
            git_commit,
            git_restore_paths,
            git_head_info,
            git_remote_origin_url,
            github_start_device_flow,
            github_poll_device_token,
            github_wait_for_device_token,
            github_complete_device_login,
            github_fetch_user,
            google_complete_oauth,
            ai_chat_complete,
            ai_chat_synthesize,
            ai_connection_status,
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
            show_agent_finish_notification,
            show_automation_complete_notification,
            set_system_tray_visible,
        ])
        .setup(|app| {
            load_dotenv();
            #[cfg(windows)]
            windows_notifications::init(app.handle());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_theme(Some(tauri::Theme::Dark));
                let _ = window.set_shadow(false);
            }
            #[cfg(windows)]
            {
                app_icon::apply_window_taskbar_icon(app.handle());
                app_icon::schedule_taskbar_icon_retry(app.handle());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
